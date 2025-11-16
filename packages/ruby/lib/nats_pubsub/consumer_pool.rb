# frozen_string_literal: true

require_relative 'core/logging'
require_relative 'consumer/consumer'
require_relative 'message_router'
require_relative 'subscriber_registry'

module NatsPubsub
  # Manages a pool of consumers for processing messages
  class ConsumerPool
    def initialize(registry: nil, concurrency: 5)
      @registry = registry || SubscriberRegistry.instance
      @concurrency = concurrency
      @consumers = []
      @running = true
    end

    def start!
      setup_consumers

      Logging.info(
        "Started #{@consumers.size} consumer(s) for #{@registry.all_subscribers.size} subscriber(s)",
        tag: 'NatsPubsub::ConsumerPool'
      )

      # Wait for all consumer threads
      @consumers.each { |c| c[:thread].join }
    end

    def stop!
      @running = false
      @consumers.each { |c| c[:consumer].stop! }
    end

    private

    def setup_consumers
      # In pubsub mode, create consumers for subscription patterns
      if NatsPubsub.config.pubsub_mode
        setup_pubsub_consumers
      else
        setup_legacy_consumer
      end
    end

    def setup_pubsub_consumers
      pattern_groups = group_by_patterns

      if pattern_groups.empty?
        Logging.warn(
          "No subscription patterns found",
          tag: 'NatsPubsub::ConsumerPool'
        )
        return
      end

      pattern_groups.each do |pattern, subscribers|
        create_consumer_for_pattern(pattern, subscribers)
      end
    end

    def setup_legacy_consumer
      # Legacy: single consumer for destination_subject
      @concurrency.times do |i|
        consumer = Consumer.new do |event, subject, deliveries|
          # Process with message router
          router = MessageRouter.new(@registry)
          router.route(event, subject, deliveries)
        end

        thread = Thread.new do
          Thread.current.name = "consumer-legacy-#{i}"

          loop do
            break unless @running
            consumer.run!
          rescue => e
            Logging.error(
              "Consumer crashed: #{e.class} #{e.message}",
              tag: 'NatsPubsub::ConsumerPool'
            )
            Logging.error(e.backtrace.join("\n"), tag: 'NatsPubsub::ConsumerPool')
            sleep 5
            retry if @running
          end
        end

        @consumers << { consumer: consumer, thread: thread, pattern: 'legacy' }
      end
    end

    def group_by_patterns
      groups = Hash.new { |h, k| h[k] = [] }

      @registry.all_subscribers.each do |sub_class|
        sub_class.subscriptions.each do |subscription|
          groups[subscription[:pattern]] << sub_class
        end
      end

      groups
    end

    def create_consumer_for_pattern(pattern, subscribers)
      durable_name = generate_durable_name(pattern)

      Logging.info(
        "Creating consumer for pattern: #{pattern} (durable: #{durable_name})",
        tag: 'NatsPubsub::ConsumerPool'
      )

      # Create one consumer (it will handle batches internally)
      consumer = Consumer.new(
        durable_name: durable_name,
        filter_subject: pattern
      ) do |event, subject, deliveries|
        route_to_subscribers(event, subject, deliveries, subscribers)
      end

      thread = Thread.new do
        Thread.current.name = "consumer-#{sanitize_pattern(pattern)}"

        loop do
          break unless @running

          begin
            consumer.run!
          rescue => e
            Logging.error(
              "Consumer crashed for #{pattern}: #{e.class} #{e.message}",
              tag: 'NatsPubsub::ConsumerPool'
            )
            Logging.error(e.backtrace.join("\n"), tag: 'NatsPubsub::ConsumerPool')
            sleep 5
            retry if @running
          end
        end
      end

      @consumers << { consumer: consumer, thread: thread, pattern: pattern }
    end

    def route_to_subscribers(event, subject, deliveries, subscribers)
      router = MessageRouter.new(@registry)
      router.route(event, subject, deliveries)
    end

    def generate_durable_name(pattern)
      sanitized = sanitize_pattern(pattern)
      "#{NatsPubsub.config.app_name}-#{sanitized}"
    end

    def sanitize_pattern(pattern)
      pattern
        .gsub('.>', '-all')
        .gsub('.*', '-wildcard')
        .gsub('.', '-')
        .gsub(/[^a-zA-Z0-9\-_]/, '')
        .slice(0, 100) # Limit length for NATS
    end
  end
end
