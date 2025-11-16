# frozen_string_literal: true

module NatsPubsub
  module Core
    # Unified message context
    #
    # Consolidates all message metadata into a single, well-typed context object.
    #
    # @!attribute [r] event_id
    #   @return [String] Unique event identifier (UUID)
    # @!attribute [r] subject
    #   @return [String] Full NATS subject
    # @!attribute [r] topic
    #   @return [String] Extracted topic from subject
    # @!attribute [r] trace_id
    #   @return [String, nil] Optional distributed tracing ID
    # @!attribute [r] correlation_id
    #   @return [String, nil] Optional correlation ID for request tracking
    # @!attribute [r] occurred_at
    #   @return [Time] Timestamp when the event occurred
    # @!attribute [r] deliveries
    #   @return [Integer] Number of delivery attempts
    # @!attribute [r] stream
    #   @return [String, nil] JetStream stream name
    # @!attribute [r] stream_seq
    #   @return [Integer, nil] JetStream stream sequence number
    # @!attribute [r] producer
    #   @return [String, nil] Application that produced the event
    # @!attribute [r] domain
    #   @return [String, nil] Legacy: domain field (for backward compatibility)
    # @!attribute [r] resource
    #   @return [String, nil] Legacy: resource field (for backward compatibility)
    # @!attribute [r] action
    #   @return [String, nil] Legacy: action field (for backward compatibility)
    #
    # @example Using in a subscriber
    #   class EmailSubscriber < NatsPubsub::Subscriber
    #     subscribe_to 'notifications.email'
    #
    #     def handle(message, context)
    #       puts "Processing event #{context.event_id}"
    #       puts "Trace ID: #{context.trace_id}"
    #       puts "Delivery attempt: #{context.deliveries}"
    #     end
    #   end
    #
    class MessageContext
      attr_reader :event_id, :subject, :topic, :trace_id, :correlation_id,
                  :occurred_at, :deliveries, :stream, :stream_seq, :producer,
                  :domain, :resource, :action

      # Initialize a new message context
      #
      # @param event_id [String] Unique event identifier
      # @param subject [String] Full NATS subject
      # @param topic [String] Extracted topic
      # @param trace_id [String, nil] Distributed tracing ID
      # @param correlation_id [String, nil] Request correlation ID
      # @param occurred_at [Time] Event timestamp
      # @param deliveries [Integer] Number of delivery attempts
      # @param stream [String, nil] JetStream stream name
      # @param stream_seq [Integer, nil] JetStream stream sequence
      # @param producer [String, nil] Producer application name
      # @param domain [String, nil] Legacy domain field
      # @param resource [String, nil] Legacy resource field
      # @param action [String, nil] Legacy action field
      def initialize(
        event_id:,
        subject:,
        topic:,
        trace_id: nil,
        correlation_id: nil,
        occurred_at:,
        deliveries:,
        stream: nil,
        stream_seq: nil,
        producer: nil,
        domain: nil,
        resource: nil,
        action: nil
      )
        @event_id = event_id
        @subject = subject
        @topic = topic
        @trace_id = trace_id
        @correlation_id = correlation_id
        @occurred_at = occurred_at
        @deliveries = deliveries
        @stream = stream
        @stream_seq = stream_seq
        @producer = producer
        @domain = domain
        @resource = resource
        @action = action

        freeze
      end

      # Create context from legacy metadata hash
      #
      # @param metadata [Hash] Legacy metadata hash
      # @return [MessageContext] New context instance
      #
      # @example
      #   context = MessageContext.from_metadata(metadata)
      #
      def self.from_metadata(metadata)
        # Extract topic from subject
        subject = metadata[:subject] || metadata['subject']
        topic = extract_topic_from_subject(subject)

        new(
          event_id: metadata[:event_id] || metadata['event_id'],
          subject: subject,
          topic: topic,
          trace_id: metadata[:trace_id] || metadata['trace_id'],
          correlation_id: metadata[:correlation_id] || metadata['correlation_id'],
          occurred_at: parse_time(metadata[:occurred_at] || metadata['occurred_at']),
          deliveries: metadata[:deliveries] || metadata['deliveries'] || 1,
          stream: metadata[:stream] || metadata['stream'],
          stream_seq: metadata[:stream_seq] || metadata['stream_seq'],
          producer: metadata[:producer] || metadata['producer'],
          domain: metadata[:domain] || metadata['domain'],
          resource: metadata[:resource] || metadata['resource'],
          action: metadata[:action] || metadata['action']
        )
      end

      # Convert to hash
      #
      # @return [Hash] Hash representation
      def to_h
        {
          event_id: event_id,
          subject: subject,
          topic: topic,
          trace_id: trace_id,
          correlation_id: correlation_id,
          occurred_at: occurred_at,
          deliveries: deliveries,
          stream: stream,
          stream_seq: stream_seq,
          producer: producer,
          domain: domain,
          resource: resource,
          action: action
        }
      end

      alias to_hash to_h

      private

      # Extract topic from NATS subject
      #
      # @param subject [String] Full NATS subject
      # @return [String] Extracted topic
      #
      # @example
      #   extract_topic_from_subject('production.myapp.notifications.email')
      #   # => 'notifications.email'
      #
      def self.extract_topic_from_subject(subject)
        return '' if subject.nil? || subject.empty?

        parts = subject.split('.')
        # Remove env and app_name (first two parts)
        parts[2..-1]&.join('.') || ''
      end

      # Parse time from various formats
      #
      # @param value [Time, String, Integer, nil] Time value
      # @return [Time] Parsed time
      def self.parse_time(value)
        case value
        when Time
          value
        when String
          Time.parse(value)
        when Integer
          Time.at(value)
        else
          Time.now
        end
      rescue StandardError
        Time.now
      end

      private_class_method :extract_topic_from_subject, :parse_time
    end
  end
end
