# frozen_string_literal: true

module NatsPubsub
  # @deprecated Use Subscriber directly instead. Topic methods have been moved to the base Subscriber module.
  #
  # TopicSubscriber is now deprecated. The base Subscriber module includes all topic methods:
  #   - subscribe_to_topic
  #   - subscribe_to_topics
  #   - subscribe_to_topic_wildcard
  #
  # Migration:
  #   Before: include NatsPubsub::TopicSubscriber
  #   After:  include NatsPubsub::Subscriber
  #
  # All topic methods are available on the base Subscriber module, which uses topic-based
  # subscriptions as its foundation with domain/resource/action as a convenience layer.
  #
  # This module is kept for backward compatibility and will be removed in a future version.
  #
  # Example:
  #   class NotificationSubscriber
  #     include NatsPubsub::Subscriber  # Use this instead of TopicSubscriber
  #
  #     subscribe_to_topic 'notifications.email'
  #
  #     def call(message, metadata)
  #       # Handle the message
  #     end
  #   end
  module TopicSubscriber
    def self.included(base)
      base.extend(ClassMethods)
      base.include(InstanceMethods)
    end

    module ClassMethods
      # Subscribe to one or more topics
      # @param topics [Array<String>] Topic names to subscribe to
      # @param options [Hash] Additional subscription options
      #
      # Examples:
      #   subscribe_to_topics 'notifications', 'audit'
      #   subscribe_to_topics 'analytics', ack_wait: 60
      def subscribe_to_topics(*topics, **options)
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

      # Subscribe to a single topic (alias for subscribe_to_topics)
      # @param topic [String] Topic name
      # @param options [Hash] Additional subscription options
      def subscribe_to_topic(topic, **options)
        subscribe_to_topics(topic, **options)
      end

      # Subscribe to all subtopics within a topic using wildcard
      # @param topic [String] Topic name
      # @param options [Hash] Additional subscription options
      #
      # Example:
      #   subscribe_to_topic_wildcard 'notifications'  # Subscribes to all subtopics in notifications
      def subscribe_to_topic_wildcard(topic, **options)
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

      # Get all subscriptions (combines regular and topic subscriptions)
      # @return [Array<Hash>] Array of all subscription hashes
      def all_subscriptions
        regular = respond_to?(:subscriptions) ? subscriptions : []
        topic = topic_subscriptions
        regular + topic
      end

      # Configure JetStream-specific options for topic subscriptions
      # @param opts [Hash] Options hash
      # @option opts [Integer] :retry Number of retries (default: 5)
      # @option opts [Integer] :ack_wait ACK wait timeout in seconds (default: 30)
      # @option opts [Integer] :max_deliver Maximum delivery attempts (default: 5)
      # @option opts [Boolean] :dead_letter Enable DLQ (default: true)
      # @option opts [Integer] :batch_size Batch size for fetching (default: 25)
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
        env = defined?(NatsPubsub) ? NatsPubsub.config.env : 'development'
        "#{env}.#{app_name}.#{normalize_topic_name(topic)}"
      end

      # Build NATS subject pattern for wildcard topic subscription
      # Format: {env}.#{app_name}.{topic_name}.>
      def build_topic_wildcard_pattern(topic)
        env = defined?(NatsPubsub) ? NatsPubsub.config.env : 'development'
        "#{env}.#{app_name}.#{normalize_topic_name(topic)}.>"
      end

      def normalize_topic_name(name)
        name.to_s.downcase.gsub(/[^a-z0-9_.>*-]/, '_')
      end
    end

    module InstanceMethods
      # Override this method in your subscriber class to handle topic messages
      # @param message [Hash] The message payload
      # @param metadata [Hash] Message metadata (topic, subject, event_id, etc.)
      #
      # @raise [NotImplementedError] if not overridden
      def call(message, metadata)
        raise NotImplementedError, "#{self.class.name} must implement #call(message, metadata)"
      end

      # Access to logger
      # @return [Logger] Logger instance
      def logger
        NatsPubsub.config.logger || (defined?(Rails) ? Rails.logger : Logger.new($stdout))
      end

      # Helper method to check if message is from a specific topic
      # @param metadata [Hash] Message metadata
      # @param topic_name [String] Topic name to check
      # @return [Boolean]
      def from_topic?(metadata, topic_name)
        metadata[:topic] == topic_name.to_s
      end
    end
  end
end
