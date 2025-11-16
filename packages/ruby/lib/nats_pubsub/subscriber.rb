# frozen_string_literal: true

module NatsPubsub
  # Include this module in your subscriber classes to handle NATS JetStream messages.
  # Provides a Sidekiq-like declarative interface for subscribing to events.
  #
  # Example:
  #   class UserActivitySubscriber
  #     include NatsPubsub::Subscriber
  #
  #     subscribe_to 'production.events.users.user.*'
  #
  #     jetstream_options retry: 3, ack_wait: 60
  #
  #     def call(event, metadata)
  #       # Handle the event
  #     end
  #   end
  module Subscriber
    def self.included(base)
      base.extend(ClassMethods)
      base.include(InstanceMethods)
    end

    module ClassMethods
      # Declare subscription patterns (supports NATS wildcards: * and >)
      #
      # @param patterns [Array<String>] Subject patterns to subscribe to
      # @param options [Hash] Additional subscription options
      #
      # Examples:
      #   subscribe_to 'production.events.users.user.*'
      #   subscribe_to 'production.events.users.user.created', 'production.events.users.user.updated'
      #   subscribe_to 'production.events.>'  # Subscribe to all events
      def subscribe_to(*patterns, **options)
        @subscriptions ||= []
        patterns.each do |pattern|
          @subscriptions << { pattern: pattern.to_s, options: options }
        end
      end

      # Get all subscriptions for this subscriber
      #
      # @return [Array<Hash>] Array of subscription hashes
      def subscriptions
        @subscriptions || []
      end

      # Configure JetStream-specific options (Sidekiq-style)
      #
      # @param opts [Hash] Options hash
      # @option opts [Integer] :retry Number of retries (default: 5)
      # @option opts [Integer] :ack_wait ACK wait timeout in seconds (default: 30)
      # @option opts [Integer] :max_deliver Maximum delivery attempts (default: 5)
      # @option opts [Boolean] :dead_letter Enable DLQ (default: true)
      # @option opts [Integer] :batch_size Batch size for fetching (default: 25)
      #
      # @return [Hash] Merged options
      def jetstream_options(opts = {})
        @jetstream_options ||= {
          retry: 5,
          ack_wait: 30,
          max_deliver: 5,
          dead_letter: true,
          batch_size: 25
        }
        @jetstream_options.merge!(opts) if opts.any?
        @jetstream_options
      end

      # Get the current jetstream options
      #
      # @return [Hash] Options hash
      def get_jetstream_options
        @jetstream_options || jetstream_options
      end
    end

    module InstanceMethods
      # Override this method in your subscriber class to handle events
      #
      # @param event [Hash] The event payload
      # @param metadata [Hash] Event metadata (subject, deliveries, event_id, etc.)
      #
      # @raise [NotImplementedError] if not overridden
      def call(event, metadata)
        raise NotImplementedError, "#{self.class.name} must implement #call(event, metadata)"
      end

      # Access to logger
      #
      # @return [Logger] Logger instance
      def logger
        NatsPubsub.config.logger || (defined?(Rails) ? Rails.logger : Logger.new($stdout))
      end
    end
  end
end
