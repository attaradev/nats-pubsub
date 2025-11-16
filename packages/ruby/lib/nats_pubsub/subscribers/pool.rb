# frozen_string_literal: true

require_relative '../core/logging'
require_relative 'worker'
require_relative 'message_router'
require_relative 'registry'

module NatsPubsub
  module Subscribers
    # Manages a pool of subscriber workers for processing messages.
    # Formerly known as ConsumerPool - renamed for consistency with Subscriber terminology.
    class Pool
      def initialize(registry: nil, concurrency: 5)
        @registry = registry || Registry.instance
        @concurrency = concurrency
        @workers = []
        @running = true
      end

      def start!
        setup_workers

        Logging.info(
          "Started #{@workers.size} worker(s) for #{@registry.all_subscribers.size} subscriber(s)",
          tag: 'NatsPubsub::Subscribers::Pool'
        )

        # Wait for all worker threads
        @workers.each { |w| w[:thread].join }
      end

      def stop!
        @running = false
        @workers.each { |w| w[:worker].stop! }
      end

      private

      def setup_workers
        # In pubsub mode, create workers for subscription patterns
        if NatsPubsub.config.pubsub_mode
          setup_pubsub_workers
        else
          setup_legacy_worker
        end
      end

      def setup_pubsub_workers
        pattern_groups = group_by_patterns

        if pattern_groups.empty?
          Logging.warn(
            'No subscription patterns found',
            tag: 'NatsPubsub::Subscribers::Pool'
          )
          return
        end

        pattern_groups.each do |pattern, subscribers|
          create_worker_for_pattern(pattern, subscribers)
        end
      end

      def setup_legacy_worker
        # Legacy: single worker for destination_subject
        @concurrency.times do |i|
          worker = Worker.new do |event, subject, deliveries|
            # Process with message router
            router = MessageRouter.new(@registry)
            router.route(event, subject, deliveries)
          end

          thread = Thread.new do
            Thread.current.name = "worker-legacy-#{i}"

            loop do
              break unless @running

              worker.run!
            rescue StandardError => e
              Logging.error(
                "Worker crashed: #{e.class} #{e.message}",
                tag: 'NatsPubsub::Subscribers::Pool'
              )
              Logging.error(e.backtrace.join("\n"), tag: 'NatsPubsub::Subscribers::Pool')
              sleep 5
              retry if @running
            end
          end

          @workers << { worker: worker, thread: thread, pattern: 'legacy' }
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

      def create_worker_for_pattern(pattern, subscribers)
        durable_name = generate_durable_name(pattern)

        Logging.info(
          "Creating worker for pattern: #{pattern} (durable: #{durable_name})",
          tag: 'NatsPubsub::Subscribers::Pool'
        )

        # Create one worker (it will handle batches internally)
        worker = Worker.new(
          durable_name: durable_name,
          filter_subject: pattern
        ) do |event, subject, deliveries|
          route_to_subscribers(event, subject, deliveries, subscribers)
        end

        thread = Thread.new do
          Thread.current.name = "worker-#{sanitize_pattern(pattern)}"

          loop do
            break unless @running

            begin
              worker.run!
            rescue StandardError => e
              Logging.error(
                "Worker crashed for #{pattern}: #{e.class} #{e.message}",
                tag: 'NatsPubsub::Subscribers::Pool'
              )
              Logging.error(e.backtrace.join("\n"), tag: 'NatsPubsub::Subscribers::Pool')
              sleep 5
              retry if @running
            end
          end
        end

        @workers << { worker: worker, thread: thread, pattern: pattern }
      end

      def route_to_subscribers(event, subject, deliveries, _subscribers)
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
          .tr('.', '-')
          .gsub(/[^a-zA-Z0-9\-_]/, '')
          .slice(0, 100) # Limit length for NATS
      end
    end
  end
end
