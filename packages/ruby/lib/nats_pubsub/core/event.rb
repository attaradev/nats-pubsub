# frozen_string_literal: true

require 'time'

module NatsPubsub
  # Immutable value object representing a domain event or message.
  # Provides a structured interface for accessing event envelope data.
  #
  # Events follow the envelope pattern with metadata and payload:
  # - Metadata: event_id, timestamp, producer, domain/resource/action or topic
  # - Payload: The actual event data
  #
  # @example Creating an event from envelope
  #   envelope = {
  #     'event_id' => '123',
  #     'domain' => 'users',
  #     'resource' => 'user',
  #     'action' => 'created',
  #     'payload' => { 'id' => 1, 'name' => 'John' },
  #     'occurred_at' => '2025-01-01T00:00:00Z'
  #   }
  #   event = Event.from_envelope(envelope)
  #   event.domain # => 'users'
  #   event.payload # => { 'id' => 1, 'name' => 'John' }
  class Event
    attr_reader :event_id, :schema_version, :payload, :occurred_at,
                :trace_id, :producer, :resource_id

    # Domain/Resource/Action fields (for event-based messages)
    attr_reader :domain, :resource, :action

    # Topic field (for topic-based messages)
    attr_reader :topic, :message_type

    # Create event from envelope hash
    #
    # @param envelope [Hash] Event envelope
    # @return [Event] New event instance
    # @raise [ArgumentError] if envelope is missing required fields
    def self.from_envelope(envelope)
      new(
        event_id: envelope['event_id'] || envelope[:event_id],
        schema_version: envelope['schema_version'] || envelope[:schema_version] || 1,
        domain: envelope['domain'] || envelope[:domain],
        resource: envelope['resource'] || envelope[:resource],
        action: envelope['action'] || envelope[:action],
        topic: envelope['topic'] || envelope[:topic],
        message_type: envelope['message_type'] || envelope[:message_type],
        producer: envelope['producer'] || envelope[:producer],
        resource_id: envelope['resource_id'] || envelope[:resource_id],
        occurred_at: parse_timestamp(envelope['occurred_at'] || envelope[:occurred_at]),
        trace_id: envelope['trace_id'] || envelope[:trace_id],
        payload: extract_payload(envelope)
      )
    end

    # Initialize a new Event
    #
    # @param event_id [String] Unique event identifier
    # @param schema_version [Integer] Event schema version
    # @param payload [Hash] Event payload data
    # @param occurred_at [Time] When event occurred
    # @param producer [String, nil] Application that produced the event
    # @param trace_id [String, nil] Distributed tracing ID
    # @param resource_id [String, nil] ID of the resource
    # @param domain [String, nil] Domain name (event-based)
    # @param resource [String, nil] Resource type (event-based)
    # @param action [String, nil] Action performed (event-based)
    # @param topic [String, nil] Topic name (topic-based)
    # @param message_type [String, nil] Message type (topic-based)
    def initialize(event_id:, schema_version: 1, payload:, occurred_at: nil,
                   producer: nil, trace_id: nil, resource_id: nil,
                   domain: nil, resource: nil, action: nil,
                   topic: nil, message_type: nil)
      @event_id = event_id.to_s
      @schema_version = schema_version.to_i
      @payload = payload || {}
      @occurred_at = occurred_at || Time.now.utc
      @producer = producer
      @trace_id = trace_id
      @resource_id = resource_id

      # Event-based fields
      @domain = domain
      @resource = resource
      @action = action

      # Topic-based fields
      @topic = topic
      @message_type = message_type

      validate!
      freeze
    end

    # Check if this is an event-based message
    #
    # @return [Boolean] True if has domain/resource/action
    def event_based?
      !@domain.nil? && !@resource.nil? && !@action.nil?
    end

    # Check if this is a topic-based message
    #
    # @return [Boolean] True if has topic
    def topic_based?
      !@topic.nil?
    end

    # Get event type identifier
    # Returns domain.resource.action for events, or topic for topic messages
    #
    # @return [String] Event type
    def event_type
      if event_based?
        "#{@domain}.#{@resource}.#{@action}"
      elsif topic_based?
        @topic
      else
        'unknown'
      end
    end

    # Check if event matches domain/resource/action pattern
    #
    # @param domain [String, nil] Domain to match (nil matches any)
    # @param resource [String, nil] Resource to match (nil matches any)
    # @param action [String, nil] Action to match (nil matches any)
    # @return [Boolean] True if matches
    def matches_event?(domain: nil, resource: nil, action: nil)
      return false unless event_based?

      (domain.nil? || @domain == domain.to_s) &&
        (resource.nil? || @resource == resource.to_s) &&
        (action.nil? || @action == action.to_s)
    end

    # Check if event matches topic pattern
    #
    # @param topic [String] Topic to match
    # @return [Boolean] True if matches
    def matches_topic?(topic)
      return false unless topic_based?

      @topic == topic.to_s
    end

    # Convert event to envelope hash (for serialization)
    #
    # @return [Hash] Event envelope
    def to_envelope
      envelope = {
        'event_id' => @event_id,
        'schema_version' => @schema_version,
        'occurred_at' => @occurred_at.iso8601,
        'producer' => @producer,
        'trace_id' => @trace_id
      }

      if event_based?
        envelope.merge!(
          'domain' => @domain,
          'resource' => @resource,
          'action' => @action,
          'resource_id' => @resource_id,
          'payload' => @payload
        )
      elsif topic_based?
        envelope.merge!(
          'topic' => @topic,
          'message_type' => @message_type,
          'message' => @payload
        )
      else
        envelope['payload'] = @payload
      end

      envelope.compact
    end

    # Convert to hash
    #
    # @return [Hash] Event as hash
    def to_h
      {
        event_id: @event_id,
        schema_version: @schema_version,
        domain: @domain,
        resource: @resource,
        action: @action,
        topic: @topic,
        message_type: @message_type,
        producer: @producer,
        resource_id: @resource_id,
        occurred_at: @occurred_at,
        trace_id: @trace_id,
        payload: @payload
      }.compact
    end

    # String representation
    #
    # @return [String] Event description
    def to_s
      "Event(#{event_type}, id=#{@event_id})"
    end

    # Inspect representation
    #
    # @return [String] Detailed inspection
    def inspect
      "#<Event:#{event_type} id=#{@event_id} occurred_at=#{@occurred_at.iso8601}>"
    end

    # Equality comparison
    #
    # @param other [Object] Object to compare
    # @return [Boolean] True if equal
    def ==(other)
      other.is_a?(Event) && @event_id == other.event_id
    end

    alias eql? ==

    # Hash code for use in hash tables
    #
    # @return [Integer] Hash code
    def hash
      @event_id.hash
    end

    private

    # Parse timestamp string to Time object
    #
    # @param timestamp [String, Time, nil] Timestamp
    # @return [Time] Parsed time
    def self.parse_timestamp(timestamp)
      case timestamp
      when Time
        timestamp
      when String
        Time.parse(timestamp)
      else
        Time.now.utc
      end
    end

    # Extract payload from envelope
    #
    # @param envelope [Hash] Event envelope
    # @return [Hash] Payload data
    def self.extract_payload(envelope)
      # For event-based messages, payload is in 'payload'
      # For topic-based messages, payload is in 'message'
      envelope['payload'] || envelope[:payload] ||
        envelope['message'] || envelope[:message] ||
        {}
    end

    # Validate event data
    #
    # @raise [ArgumentError] if invalid
    def validate!
      raise ArgumentError, 'event_id is required' if @event_id.nil? || @event_id.empty?
      raise ArgumentError, 'payload must be a Hash' unless @payload.is_a?(Hash)
      raise ArgumentError, 'occurred_at must be a Time' unless @occurred_at.is_a?(Time)

      # Must be either event-based or topic-based
      unless event_based? || topic_based?
        raise ArgumentError, 'Event must have either (domain, resource, action) or (topic)'
      end
    end
  end
end
