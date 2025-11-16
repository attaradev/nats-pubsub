# frozen_string_literal: true

module NatsPubsub
  # Include this module in your subscriber classes to handle NATS JetStream messages.
  # Uses topic-based subscriptions as the foundation with domain/resource/action as a convenience layer.
  #
  # Example (Topic-based - recommended):
  #   class NotificationSubscriber
  #     include NatsPubsub::Subscriber
  #
  #     subscribe_to_topic 'notifications.email'
  #     # or with wildcards
  #     subscribe_to_topic 'users.user.*'
  #     subscribe_to_topic_wildcard 'notifications'
  #
  #     jetstream_options retry: 3, ack_wait: 60
  #
  #     def call(message, metadata)
  #       # Handle the message
  #     end
  #   end
  #
  # Example (Domain/Resource/Action - convenience):
  #   class UserActivitySubscriber
  #     include NatsPubsub::Subscriber
  #
  #     subscribe_to_event domain: 'users', resource: 'user', action: 'created'
  #
  #     def call(message, metadata)
  #       # Handle the message
  #     end
  #   end
  module Subscriber
    def self.included(base)
      base.extend(ClassMethods)
      base.include(InstanceMethods)
    end

    module ClassMethods
      # ===== Topic-Based Subscriptions (Foundation) =====

      # Subscribe to one or more topics
      # @param topics [Array<String>] Topic names to subscribe to
      # @param options [Hash] Additional subscription options
      #
      # Examples:
      #   subscribe_to_topics 'notifications', 'audit'
      #   subscribe_to_topics 'analytics', ack_wait: 60
      #   subscribe_to_topics 'users.user.*'  # With wildcard
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
      #   subscribe_to_topic_wildcard 'notifications'  # Subscribes to notifications.>
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

      # ===== Domain/Resource/Action Layer (Convenience) =====

      # Subscribe to events using domain/resource/action pattern
      # This is a convenience method that maps to topic subscriptions internally
      #
      # @param domain [String] Domain (e.g., 'users', 'orders')
      # @param resource [String] Resource type (e.g., 'user', 'order')
      # @param action [String, Symbol] Action (e.g., 'created', '*' for wildcard)
      # @param options [Hash] Additional subscription options
      #
      # Examples:
      #   subscribe_to_event domain: 'users', resource: 'user', action: 'created'
      #   subscribe_to_event domain: 'users', resource: 'user', action: '*'  # All actions
      def subscribe_to_event(domain:, resource:, action:, **options)
        # Map to topic format: domain.resource.action
        topic = "#{domain}.#{resource}.#{action}"
        subscribe_to_topic(topic, **options)
      end

      # ===== Raw Subject Subscription =====

      # Declare subscription patterns (supports NATS wildcards: * and >)
      #
      # @param patterns [Array<String>] Subject patterns to subscribe to
      # @param options [Hash] Additional subscription options
      #
      # Examples:
      #   subscribe_to 'production.myapp.users.user.*'
      def subscribe_to(*patterns, **options)
        @subscriptions ||= []
        patterns.each do |pattern|
          @subscriptions << { pattern: pattern.to_s, options: options }
        end
      end

      # Get all raw subscriptions (legacy)
      # @return [Array<Hash>] Array of subscription hashes
      def subscriptions
        @subscriptions || []
      end

      # Get all subscriptions (combines topic, event, and legacy subscriptions)
      # @return [Array<Hash>] Array of all subscription hashes
      def all_subscriptions
        topic_subs = topic_subscriptions
        legacy_subs = subscriptions
        topic_subs + legacy_subs
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
      def jetstream_options_value
        @jetstream_options || jetstream_options
      end

      private

      # Build NATS subject pattern for topic subscription
      # Format: {env}.#{app_name}.{topic_name}
      def build_topic_pattern(topic)
        env = defined?(NatsPubsub) ? NatsPubsub.config.env : 'development'
        app = defined?(NatsPubsub) ? NatsPubsub.config.app_name : 'app'
        "#{env}.#{app}.#{normalize_topic_name(topic)}"
      end

      # Build NATS subject pattern for wildcard topic subscription
      # Format: {env}.#{app_name}.{topic_name}.>
      def build_topic_wildcard_pattern(topic)
        env = defined?(NatsPubsub) ? NatsPubsub.config.env : 'development'
        app = defined?(NatsPubsub) ? NatsPubsub.config.app_name : 'app'
        "#{env}.#{app}.#{normalize_topic_name(topic)}.>"
      end

      # Normalize topic name (preserve dots and wildcards)
      def normalize_topic_name(name)
        name.to_s.downcase.gsub(/[^a-z0-9_.>*-]/, '_')
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

      # Helper method to check if message is from a specific topic
      # @param metadata [Hash] Message metadata
      # @param topic_name [String] Topic name to check
      # @return [Boolean]
      def from_topic?(metadata, topic_name)
        metadata[:topic] == topic_name.to_s
      end

      # Helper method to check if message is from a specific domain/resource/action
      # @param metadata [Hash] Message metadata
      # @param domain [String] Domain to check
      # @param resource [String] Resource to check
      # @param action [String] Action to check
      # @return [Boolean]
      def from_event?(metadata, domain:, resource:, action:)
        metadata[:domain] == domain.to_s &&
          metadata[:resource] == resource.to_s &&
          metadata[:action] == action.to_s
      end
    end
  end
end
