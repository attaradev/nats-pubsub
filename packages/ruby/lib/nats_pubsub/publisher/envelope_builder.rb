# frozen_string_literal: true

require 'securerandom'
require_relative '../core/config'
require_relative '../core/subject'

module NatsPubsub
  # Service object responsible for building message envelopes.
  # Extracted from Publisher to follow Single Responsibility Principle.
  #
  # Supports three envelope formats:
  # 1. Event envelope (domain/resource/action pattern)
  # 2. Topic envelope (topic-based messaging)
  # 3. Legacy envelope (backward compatibility)
  class EnvelopeBuilder
    # Build envelope for domain/resource/action events
    # More specific name makes it clear this builds an event envelope
    #
    # @param domain [String] Domain name (e.g., 'users', 'orders')
    # @param resource [String] Resource type (e.g., 'user', 'order')
    # @param action [String] Action performed (e.g., 'created', 'updated')
    # @param payload [Hash] Event payload
    # @param options [Hash] Additional options
    # @return [Hash] Event envelope
    def self.build_event_envelope(domain, resource, action, payload, options = {})
      {
        'event_id' => options[:event_id] || SecureRandom.uuid,
        'schema_version' => 1,
        'domain' => domain.to_s,
        'resource' => resource.to_s,
        'action' => action.to_s,
        'producer' => NatsPubsub.config.app_name,
        'resource_id' => extract_resource_id(payload),
        'occurred_at' => format_timestamp(options[:occurred_at]),
        'trace_id' => options[:trace_id] || SecureRandom.hex(8),
        'payload' => payload
      }
    end

    # Build envelope for topic-based messages
    # More specific name makes it clear this builds a topic envelope
    #
    # @param topic [String] Topic name
    # @param message [Hash] Message payload
    # @param options [Hash] Additional options
    # @return [Hash] Topic envelope
    def self.build_topic_envelope(topic, message, options = {})
      envelope = {
        'event_id' => options[:event_id] || SecureRandom.uuid,
        'schema_version' => 1,
        'topic' => topic.to_s,
        'message_type' => options[:message_type]&.to_s,
        'producer' => NatsPubsub.config.app_name,
        'occurred_at' => format_timestamp(options[:occurred_at]),
        'trace_id' => options[:trace_id] || SecureRandom.hex(8),
        'message' => message
      }

      # Add domain/resource/action fields if provided (for backward compatibility)
      envelope['domain'] = options[:domain].to_s if options[:domain]
      envelope['resource'] = options[:resource].to_s if options[:resource]
      envelope['action'] = options[:action].to_s if options[:action]
      envelope['resource_id'] = options[:resource_id].to_s if options[:resource_id]

      envelope.compact
    end

    # Build NATS subject for topic
    # Delegates to Subject class for centralized subject building logic
    #
    # @param topic [String] Topic name
    # @return [String] NATS subject
    def self.build_subject(topic)
      Subject.from_topic(
        env: NatsPubsub.config.env,
        app_name: NatsPubsub.config.app_name,
        topic: topic
      ).to_s
    end

    # Extract resource ID from payload
    #
    # @param payload [Hash] Event payload
    # @return [String] Resource ID
    def self.extract_resource_id(payload)
      (payload['id'] || payload[:id]).to_s
    end
    private_class_method :extract_resource_id

    # Format timestamp to ISO8601
    #
    # @param timestamp [Time, nil] Timestamp
    # @return [String] ISO8601 formatted timestamp
    def self.format_timestamp(timestamp)
      (timestamp || Time.now.utc).iso8601
    end
    private_class_method :format_timestamp
  end
end
