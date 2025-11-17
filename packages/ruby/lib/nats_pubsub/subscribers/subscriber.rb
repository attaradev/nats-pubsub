# frozen_string_literal: true

module NatsPubsub
  # Include this module in your subscriber classes to handle NATS JetStream messages.
  # Uses topic-based subscriptions.
  #
  # Example:
  #   class NotificationSubscriber < NatsPubsub::Subscriber
  #     subscribe_to 'notifications.email'
  #     # or with wildcards
  #     subscribe_to 'users.user.*'
  #     subscribe_to_wildcard 'notifications'
  #
  #     jetstream_options retry: 3, ack_wait: 60
  #
  #     def handle(message, context)
  #       # Handle the message
  #       # context is a MessageContext object with event_id, trace_id, deliveries, etc.
  #     end
  #   end
  module Subscriber
    def self.included(base)
      base.extend(ClassMethods)
      base.include(InstanceMethods)
    end

    module ClassMethods
      # ===== Topic-Based Subscriptions =====

      # Subscribe to one or more topics
      # @param topics [Array<String>] Topic names to subscribe to
      # @param options [Hash] Additional subscription options
      #
      # Examples:
      #   subscribe_to 'notifications', 'audit'
      #   subscribe_to 'analytics', ack_wait: 60
      #   subscribe_to 'users.user.*'  # With wildcard
      #
      # Supports wildcards for matching:
      #   subscribe_to 'users.user.*'      # Match one level
      #   subscribe_to_wildcard 'users'    # Match all subtopics with >
      def subscribe_to(*topics, **options)
        @topic_subscriptions ||= []
        topics.each do |topic|
          pattern = build_topic_pattern(topic)
          @topic_subscriptions << {
            pattern: pattern,
            topic: topic.to_s,
            type: :topic,
            options: options
          }
        end
      end

      # Subscribe to all subtopics within a topic using wildcard (>)
      # @param topic [String] Topic name
      # @param options [Hash] Additional subscription options
      #
      # Example:
      #   subscribe_to_wildcard 'notifications'  # Subscribes to notifications.>
      def subscribe_to_wildcard(topic, **options)
        @topic_subscriptions ||= []
        pattern = build_topic_wildcard_pattern(topic)
        @topic_subscriptions << {
          pattern: pattern,
          topic: topic.to_s,
          type: :topic_wildcard,
          options: options
        }
      end

      # Get all topic subscriptions
      # @return [Array<Hash>] Array of subscription hashes
      def topic_subscriptions
        @topic_subscriptions || []
      end

      # Get all subscriptions
      # @return [Array<Hash>] Array of all subscription hashes
      def all_subscriptions
        topic_subscriptions
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

      private

      # Build NATS subject pattern for topic subscription
      # Format: {env}.#{app_name}.{topic_name}
      def build_topic_pattern(topic)
        "#{env_prefix}.#{normalize_topic_name(topic)}"
      end

      # Build NATS subject pattern for wildcard topic subscription
      # Format: {env}.#{app_name}.{topic_name}.>
      def build_topic_wildcard_pattern(topic)
        "#{env_prefix}.#{normalize_topic_name(topic)}.>"
      end

      # Get environment prefix for subject patterns
      # @return [String] Environment and app prefix
      def env_prefix
        env = defined?(NatsPubsub) ? NatsPubsub.config.env : 'development'
        app = defined?(NatsPubsub) ? NatsPubsub.config.app_name : 'app'
        "#{env}.#{app}"
      end

      # Normalize topic name (preserve dots and wildcards)
      # Delegates to Subject class for consistency
      def normalize_topic_name(name)
        require_relative '../core/subject' unless defined?(NatsPubsub::Subject)
        Subject.normalize_topic(name)
      end
    end

    module InstanceMethods
      # Override this method in your subscriber class to handle messages
      #
      # @param message [Hash] The message payload
      # @param context [MessageContext] Message context with event_id, trace_id, deliveries, etc.
      #
      # @raise [NotImplementedError] if not overridden
      def handle(message, context)
        raise NotImplementedError, "#{self.class.name} must implement #handle(message, context)"
      end

      # Optional: Override this method to provide custom error handling
      # Return an ErrorAction constant to control how errors are handled
      #
      # @param error_context [Core::ErrorContext] Error context with error, message, context, attempts
      # @return [Symbol] Error action (:retry, :discard, :dlq)
      #
      # @example Custom error handling
      #   def on_error(error_context)
      #     case error_context.error
      #     when ValidationError
      #       Core::ErrorAction::DISCARD
      #     when NetworkError
      #       Core::ErrorAction::RETRY
      #     else
      #       Core::ErrorAction::DLQ
      #     end
      #   end
      def on_error(error_context)
        # Default implementation - delegates to error handler
        # Subclasses can override for custom behavior
        nil
      end

      # Access to logger
      #
      # @return [Logger] Logger instance
      def logger
        NatsPubsub.config.logger || (defined?(Rails) ? Rails.logger : Logger.new($stdout))
      end

      # Helper method to check if message is from a specific topic
      # @param context [MessageContext] Message context
      # @param topic_name [String] Topic name to check
      # @return [Boolean]
      def from_topic?(context, topic_name)
        context.topic == topic_name.to_s
      end
    end
  end
end
