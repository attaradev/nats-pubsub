# frozen_string_literal: true

require 'oj'
require 'securerandom'
require_relative '../core/logging'
require_relative 'dlq_publisher'

module NatsPubsub
  # Immutable per-message metadata.
  MessageContext = Struct.new(
    :event_id, :deliveries, :subject, :seq, :consumer, :stream,
    keyword_init: true
  ) do
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
  end

  # Simple exponential backoff strategy for transient failures.
  class BackoffStrategy
    TRANSIENT_ERRORS = [Timeout::Error, IOError].freeze
    MAX_EXPONENT     = 6
    MAX_DELAY        = 60
    MIN_DELAY        = 1

    # Returns a bounded delay in seconds
    def delay(deliveries, error)
      base = transient?(error) ? 0.5 : 2.0
      power = [deliveries - 1, MAX_EXPONENT].min
      raw = (base * (2**power)).to_i
      raw.clamp(MIN_DELAY, MAX_DELAY)
    end

    private

    def transient?(error)
      TRANSIENT_ERRORS.any? { |k| error.is_a?(k) }
    end
  end

  # Orchestrates parse → handler → ack/nak → DLQ
  class MessageProcessor
    UNRECOVERABLE_ERRORS = [ArgumentError, TypeError].freeze

    def initialize(jts, handler, dlq: nil, backoff: nil)
      @jts     = jts
      @handler = handler
      @dlq     = dlq || DlqPublisher.new(jts)
      @backoff = backoff || BackoffStrategy.new
    end

    def handle_message(msg)
      ctx   = MessageContext.build(msg)
      event = parse_message(msg, ctx)
      return unless event

      ensure_dlq_stream if NatsPubsub.config.use_dlq

      process_event(msg, event, ctx)
    rescue StandardError => e
      Logging.error(
        "Processor crashed event_id=#{ctx&.event_id} subject=#{ctx&.subject} seq=#{ctx&.seq} " \
        "deliveries=#{ctx&.deliveries} err=#{e.class}: #{e.message}",
        tag: 'NatsPubsub::Consumer'
      )
      safe_nak(msg)
    end

    private

    def parse_message(msg, ctx)
      data = msg.data
      Oj.load(data, mode: :strict)
    rescue Oj::ParseError => e
      published = @dlq.publish(msg, ctx,
                               reason: 'malformed_json', error_class: e.class.name, error_message: e.message)
      msg.ack if published || !NatsPubsub.config.use_dlq
      safe_nak(msg) unless published || !NatsPubsub.config.use_dlq
      Logging.warn(
        "Malformed JSON → DLQ event_id=#{ctx.event_id} subject=#{ctx.subject} " \
        "seq=#{ctx.seq} deliveries=#{ctx.deliveries}: #{e.message}",
        tag: 'NatsPubsub::Consumer'
      )
      nil
    end

    def process_event(msg, event, ctx)
      @handler.call(event, ctx.subject, ctx.deliveries)
      msg.ack
      Logging.info(
        "ACK event_id=#{ctx.event_id} subject=#{ctx.subject} seq=#{ctx.seq} deliveries=#{ctx.deliveries}",
        tag: 'NatsPubsub::Consumer'
      )
    rescue *UNRECOVERABLE_ERRORS => e
      published = @dlq.publish(msg, ctx,
                               reason: 'unrecoverable', error_class: e.class.name, error_message: e.message)
      msg.ack if published || !NatsPubsub.config.use_dlq
      safe_nak(msg, ctx, e) unless published || !NatsPubsub.config.use_dlq
      Logging.warn(
        "DLQ (unrecoverable) event_id=#{ctx.event_id} subject=#{ctx.subject} " \
        "seq=#{ctx.seq} deliveries=#{ctx.deliveries} err=#{e.class}: #{e.message}",
        tag: 'NatsPubsub::Consumer'
      )
    rescue StandardError => e
      ack_or_nak(msg, ctx, e)
    end

    def ack_or_nak(msg, ctx, error)
      max_deliver = NatsPubsub.config.max_deliver.to_i
      dlq_max_attempts = NatsPubsub.config.dlq_max_attempts.to_i
      if ctx.deliveries >= max_deliver || ctx.deliveries >= dlq_max_attempts
        published = @dlq.publish(msg, ctx,
                                 reason: 'max_deliver_exceeded', error_class: error.class.name, error_message: error.message)
        if published || !NatsPubsub.config.use_dlq
          # term to avoid infinite loops when DLQ is failing repeatedly
          msg.term
        else
          safe_nak(msg, ctx, error)
        end
        Logging.warn(
          "DLQ (max_deliver) event_id=#{ctx.event_id} subject=#{ctx.subject} " \
          "seq=#{ctx.seq} deliveries=#{ctx.deliveries} err=#{error.class}: #{error.message}",
          tag: 'NatsPubsub::Consumer'
        )
      else
        safe_nak(msg, ctx, error)
        Logging.warn(
          "NAK event_id=#{ctx.event_id} subject=#{ctx.subject} seq=#{ctx.seq} " \
          "deliveries=#{ctx.deliveries} err=#{error.class}: #{error.message}",
          tag: 'NatsPubsub::Consumer'
        )
      end
    end

    def safe_nak(msg, ctx = nil, _error = nil)
      delay = @backoff.delay(ctx&.deliveries.to_i, _error) if ctx
      if delay
        msg.nak(next_delivery_delay: delay)
      else
        msg.nak
      end
    rescue StandardError => e
      Logging.error(
        "Failed to NAK event_id=#{ctx&.event_id} deliveries=#{ctx&.deliveries}: " \
        "#{e.class} #{e.message}",
        tag: 'NatsPubsub::Consumer'
      )
    end

    def ensure_dlq_stream
      return if @dlq_stream_checked

      dlq_stream = NatsPubsub.config.dlq_stream_name
      @jts.stream_info(dlq_stream)
      @dlq_stream_checked = true
    rescue NATS::JetStream::Error::NotFound
      Logging.info(
        "Creating DLQ stream #{dlq_stream} for subject #{NatsPubsub.config.dlq_subject}",
        tag: 'NatsPubsub::Consumer'
      )
      @jts.add_stream(
        name: dlq_stream,
        subjects: [NatsPubsub.config.dlq_subject],
        retention: :limits,
        max_age: 60 * 60 * 24 * 30 # 30 days in seconds
      )
      @dlq_stream_checked = true
    rescue StandardError => e
      Logging.error(
        "Failed to ensure DLQ stream: #{e.class} #{e.message}",
        tag: 'NatsPubsub::Consumer'
      )
      raise
    end
  end
end
