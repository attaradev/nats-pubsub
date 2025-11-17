# frozen_string_literal: true

module NatsPubsub
  # Instrumentation for NatsPubsub using ActiveSupport::Notifications
  #
  # Provides instrumentation hooks for monitoring and observability.
  #
  # @example Subscribe to all events
  #   ActiveSupport::Notifications.subscribe(/nats_pubsub/) do |name, start, finish, id, payload|
  #     duration = (finish - start) * 1000
  #     puts "#{name}: #{duration}ms"
  #   end
  #
  # @example Subscribe to specific events
  #   ActiveSupport::Notifications.subscribe('nats_pubsub.publish') do |*args|
  #     event = ActiveSupport::Notifications::Event.new(*args)
  #     puts "Published: #{event.payload[:subject]} in #{event.duration}ms"
  #   end
  #
  module Instrumentation
    # Available instrumentation events:
    #
    # - nats_pubsub.publish - Message publishing
    # - nats_pubsub.receive - Message reception
    # - nats_pubsub.process - Message processing
    # - nats_pubsub.subscribe - Subscription creation
    # - nats_pubsub.health_check - Health check execution
    # - nats_pubsub.outbox.enqueue - Outbox event enqueued
    # - nats_pubsub.outbox.publish - Outbox event published
    # - nats_pubsub.inbox.store - Inbox event stored
    # - nats_pubsub.inbox.process - Inbox event processed
    # - nats_pubsub.connection.connect - Connection established
    # - nats_pubsub.connection.disconnect - Connection closed
    # - nats_pubsub.error - Error occurred

    class << self
      # Check if ActiveSupport::Notifications is available
      #
      # @return [Boolean] True if available
      def available?
        defined?(ActiveSupport::Notifications)
      end

      # Instrument a block of code
      #
      # @param event [String] Event name (will be prefixed with 'nats_pubsub.')
      # @param payload [Hash] Event payload
      # @yield Block to instrument
      # @return [Object] Block result
      #
      # @example
      #   Instrumentation.instrument('publish', subject: 'users.created') do
      #     # Publishing code
      #   end
      def instrument(event, payload = {}, &block)
        return yield unless available?

        ActiveSupport::Notifications.instrument("nats_pubsub.#{event}", payload, &block)
      end

      # Publish an instrumentation event without a block
      #
      # @param event [String] Event name (will be prefixed with 'nats_pubsub.')
      # @param payload [Hash] Event payload
      #
      # @example
      #   Instrumentation.publish('error', error: e, context: context)
      def publish(event, payload = {})
        return unless available?

        ActiveSupport::Notifications.publish("nats_pubsub.#{event}", payload)
      end

      # Subscribe to instrumentation events
      #
      # @param pattern [String, Regexp] Event pattern to subscribe to
      # @yield Block to execute for matching events
      # @return [Object] Subscription handle
      #
      # @example Subscribe to all events
      #   Instrumentation.subscribe(/nats_pubsub/) do |event|
      #     puts "Event: #{event.name}, Duration: #{event.duration}ms"
      #   end
      #
      # @example Subscribe to specific event
      #   Instrumentation.subscribe('nats_pubsub.publish') do |event|
      #     puts "Published: #{event.payload[:subject]}"
      #   end
      def subscribe(pattern = /nats_pubsub/, &block)
        return unless available?

        ActiveSupport::Notifications.subscribe(pattern) do |*args|
          event = ActiveSupport::Notifications::Event.new(*args)
          block.call(event)
        end
      end

      # Unsubscribe from instrumentation events
      #
      # @param subscriber [Object] Subscription handle
      def unsubscribe(subscriber)
        return unless available?

        ActiveSupport::Notifications.unsubscribe(subscriber)
      end
    end

    # Publishing instrumentation
    module Publisher
      # Instrument message publishing
      #
      # @param subject [String] NATS subject
      # @param payload [Hash] Message payload
      # @yield Block performing the publish
      def self.instrument_publish(subject:, **payload, &block)
        Instrumentation.instrument('publish', { subject: subject }.merge(payload), &block)
      end

      # Instrument outbox enqueuing
      #
      # @param event_id [String] Event ID
      # @param subject [String] NATS subject
      # @yield Block performing the enqueue
      def self.instrument_outbox_enqueue(event_id:, subject:, &block)
        Instrumentation.instrument('outbox.enqueue', event_id: event_id, subject: subject, &block)
      end

      # Instrument outbox publishing
      #
      # @param event_id [String] Event ID
      # @param subject [String] NATS subject
      # @yield Block performing the publish
      def self.instrument_outbox_publish(event_id:, subject:, &block)
        Instrumentation.instrument('outbox.publish', event_id: event_id, subject: subject, &block)
      end
    end

    # Subscriber instrumentation
    module Subscriber
      # Instrument message reception
      #
      # @param subject [String] NATS subject
      # @param event_id [String] Event ID
      # @yield Block receiving the message
      def self.instrument_receive(subject:, event_id:, &block)
        Instrumentation.instrument('receive', subject: subject, event_id: event_id, &block)
      end

      # Instrument message processing
      #
      # @param subject [String] NATS subject
      # @param event_id [String] Event ID
      # @param subscriber [String] Subscriber class name
      # @yield Block processing the message
      def self.instrument_process(subject:, event_id:, subscriber:, &block)
        Instrumentation.instrument(
          'process',
          subject: subject,
          event_id: event_id,
          subscriber: subscriber,
          &block
        )
      end

      # Instrument inbox storage
      #
      # @param event_id [String] Event ID
      # @param subject [String] NATS subject
      # @yield Block storing the event
      def self.instrument_inbox_store(event_id:, subject:, &block)
        Instrumentation.instrument('inbox.store', event_id: event_id, subject: subject, &block)
      end

      # Instrument inbox processing
      #
      # @param event_id [String] Event ID
      # @param subject [String] NATS subject
      # @yield Block processing the event
      def self.instrument_inbox_process(event_id:, subject:, &block)
        Instrumentation.instrument('inbox.process', event_id: event_id, subject: subject, &block)
      end

      # Instrument subscription creation
      #
      # @param subject [String] NATS subject pattern
      # @param subscriber [String] Subscriber class name
      def self.instrument_subscribe(subject:, subscriber:)
        Instrumentation.publish('subscribe', subject: subject, subscriber: subscriber)
      end
    end

    # Connection instrumentation
    module Connection
      # Instrument connection establishment
      #
      # @param urls [Array<String>] NATS server URLs
      # @yield Block establishing connection
      def self.instrument_connect(urls:, &block)
        Instrumentation.instrument('connection.connect', urls: urls, &block)
      end

      # Instrument connection close
      #
      # @param urls [Array<String>] NATS server URLs
      def self.instrument_disconnect(urls:)
        Instrumentation.publish('connection.disconnect', urls: urls)
      end
    end

    # Health check instrumentation
    module HealthCheck
      # Instrument health check execution
      #
      # @param type [Symbol] Health check type (:full, :quick)
      # @yield Block performing health check
      def self.instrument_check(type: :full, &block)
        Instrumentation.instrument('health_check', type: type, &block)
      end
    end

    # Error instrumentation
    module Error
      # Instrument error occurrence
      #
      # @param error [Exception] Error that occurred
      # @param context [Hash] Error context
      def self.instrument_error(error:, **context)
        Instrumentation.publish(
          'error',
          {
            error_class: error.class.name,
            error_message: error.message,
            backtrace: error.backtrace&.first(5)
          }.merge(context)
        )
      end
    end

    # Metrics collector for instrumentation events
    #
    # Collects metrics from ActiveSupport::Notifications events.
    #
    # @example Basic usage
    #   collector = NatsPubsub::Instrumentation::MetricsCollector.new
    #   collector.start
    #
    #   # Later
    #   metrics = collector.metrics
    #   puts "Published: #{metrics[:publish][:count]}"
    #
    class MetricsCollector
      attr_reader :metrics, :subscriber

      def initialize
        @metrics = Hash.new do |h, k|
          h[k] = { count: 0, total_duration: 0.0, errors: 0 }
        end
        @subscriber = nil
        @started_at = nil
      end

      # Start collecting metrics
      def start
        return unless Instrumentation.available?
        return if @subscriber

        @started_at = Time.now
        @subscriber = Instrumentation.subscribe do |event|
          record_event(event)
        end
      end

      # Stop collecting metrics
      def stop
        return unless @subscriber

        Instrumentation.unsubscribe(@subscriber)
        @subscriber = nil
      end

      # Reset metrics
      def reset
        @metrics.clear
        @started_at = Time.now
      end

      # Get metrics summary
      #
      # @return [Hash] Metrics summary
      def summary
        {
          uptime: uptime,
          events: @metrics.transform_values do |stats|
            {
              count: stats[:count],
              total_duration_ms: stats[:total_duration].round(2),
              avg_duration_ms: avg_duration(stats),
              errors: stats[:errors]
            }
          end
        }
      end

      private

      def record_event(event)
        name = event.name.sub('nats_pubsub.', '')

        @metrics[name][:count] += 1
        @metrics[name][:total_duration] += event.duration if event.duration
        @metrics[name][:errors] += 1 if name.include?('error')
      end

      def avg_duration(stats)
        return 0.0 if stats[:count].zero?

        (stats[:total_duration] / stats[:count]).round(2)
      end

      def uptime
        return 0.0 unless @started_at

        Time.now - @started_at
      end
    end
  end
end
