# frozen_string_literal: true

require 'securerandom'

module NatsPubsub
  module Subscribers
    # Immutable value object representing per-message metadata.
    # Extracted from MessageProcessor to follow Single Responsibility Principle.
    #
    # This class encapsulates all metadata associated with a NATS JetStream message,
    # providing a clean interface for accessing message context throughout the
    # processing pipeline.
    #
    # @example Building context from a NATS message
    #   context = MessageContext.build(nats_msg)
    #   puts "Event ID: #{context.event_id}"
    #   puts "Deliveries: #{context.deliveries}"
    #
    # @attr_reader event_id [String] Unique event identifier from message header or generated UUID
    # @attr_reader deliveries [Integer] Number of times this message has been delivered
    # @attr_reader subject [String] NATS subject the message was published to
    # @attr_reader seq [Integer, nil] JetStream sequence number
    # @attr_reader consumer [String, nil] JetStream consumer name
    # @attr_reader stream [String, nil] JetStream stream name
    class MessageContext
      attr_reader :event_id, :deliveries, :subject, :seq, :consumer, :stream

      # Initialize a new MessageContext
      #
      # @param event_id [String] Unique event identifier
      # @param deliveries [Integer] Number of delivery attempts
      # @param subject [String] NATS subject
      # @param seq [Integer, nil] JetStream sequence number
      # @param consumer [String, nil] JetStream consumer name
      # @param stream [String, nil] JetStream stream name
      def initialize(event_id:, deliveries:, subject:, seq: nil, consumer: nil, stream: nil)
        @event_id = event_id
        @deliveries = deliveries
        @subject = subject
        @seq = seq
        @consumer = consumer
        @stream = stream
        freeze # Make immutable
      end

      # Build MessageContext from a NATS JetStream message
      #
      # Extracts metadata from the NATS message headers and metadata,
      # falling back to sensible defaults when information is unavailable.
      #
      # @param msg [NATS::Msg] NATS JetStream message object
      # @return [MessageContext] Immutable message context
      def self.build(msg)
        new(
          event_id: msg.header&.[]('nats-msg-id') || SecureRandom.uuid,
          deliveries: msg.metadata&.num_delivered.to_i,
          subject: msg.subject,
          seq: msg.metadata&.sequence,
          consumer: msg.metadata&.consumer,
          stream: msg.metadata&.stream
        )
      end

      # String representation for debugging
      #
      # @return [String] Human-readable context information
      def to_s
        "MessageContext(event_id=#{event_id}, subject=#{subject}, seq=#{seq}, deliveries=#{deliveries})"
      end

      # Hash representation for logging
      #
      # @return [Hash] Context as hash
      def to_h
        {
          event_id: event_id,
          deliveries: deliveries,
          subject: subject,
          seq: seq,
          consumer: consumer,
          stream: stream
        }
      end
    end
  end
end
