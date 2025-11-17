# frozen_string_literal: true

require 'oj'
require_relative '../core/logging'
require_relative '../core/error_action'
require_relative 'dlq_handler'
require_relative 'message_context'
require_relative 'error_context'
require_relative 'error_handler'

module NatsPubsub
  module Subscribers
    # Simple exponential backoff strategy for transient failures.
    class BackoffStrategy
      TRANSIENT_ERRORS = [Timeout::Error, IOError].freeze
      MAX_EXPONENT     = 6
      MAX_DELAY        = 60
      MIN_DELAY        = 1

      # Calculates bounded backoff delay in seconds based on attempt number and error type
      #
      # @param attempt_number [Integer] Delivery attempt count
      # @param error [Exception] Error that occurred
      # @return [Integer] Delay in seconds
      def calculate_backoff_delay(attempt_number, error)
        base = transient_error?(error) ? 0.5 : 2.0
        power = [attempt_number - 1, MAX_EXPONENT].min
        raw = (base * (2**power)).to_i
        raw.clamp(MIN_DELAY, MAX_DELAY)
      end

      private

      # Check if error is transient (temporary) vs permanent
      #
      # @param error [Exception] Error to check
      # @return [Boolean] True if error is transient
      def transient_error?(error)
        TRANSIENT_ERRORS.any? { |k| error.is_a?(k) }
      end
    end

    # Orchestrates parse → handler → ack/nak → DLQ
    class MessageProcessor
      UNRECOVERABLE_ERRORS = [ArgumentError, TypeError].freeze

      def initialize(jts, handler, dlq: nil, backoff: nil, subscriber: nil)
        @jts     = jts
        @handler = handler
        @dlq     = dlq || DlqHandler.new(jts)
        @backoff = backoff || BackoffStrategy.new
        @subscriber = subscriber
        @error_handler = subscriber ? ErrorHandler.new(subscriber) : nil
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
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
        )
        safe_nak(msg)
      end

      private

      def parse_message(msg, ctx)
        data = msg.data
        Oj.load(data, mode: :strict)
      rescue Oj::ParseError => e
        error_ctx = ErrorContext.from_exception(e, reason: 'malformed_json')
        published = @dlq.publish_to_dlq(msg, ctx, error_context: error_ctx)
        msg.ack if published || !NatsPubsub.config.use_dlq
        safe_nak(msg) unless published || !NatsPubsub.config.use_dlq
        Logging.warn(
          "Malformed JSON → DLQ event_id=#{ctx.event_id} subject=#{ctx.subject} " \
          "seq=#{ctx.seq} deliveries=#{ctx.deliveries}: #{error_ctx.to_log_string}",
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
        )
        nil
      end

      def process_event(msg, event, ctx)
        @handler.call(event, ctx.subject, ctx.deliveries)
        msg.ack
        Logging.info(
          "ACK event_id=#{ctx.event_id} subject=#{ctx.subject} seq=#{ctx.seq} deliveries=#{ctx.deliveries}",
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
        )
      rescue *UNRECOVERABLE_ERRORS => e
        error_ctx = ErrorContext.from_exception(e, reason: 'unrecoverable')
        published = @dlq.publish_to_dlq(msg, ctx, error_context: error_ctx)
        msg.ack if published || !NatsPubsub.config.use_dlq
        safe_nak(msg, ctx, e) unless published || !NatsPubsub.config.use_dlq
        Logging.warn(
          "DLQ (unrecoverable) event_id=#{ctx.event_id} subject=#{ctx.subject} " \
          "seq=#{ctx.seq} deliveries=#{ctx.deliveries} err=#{error_ctx.to_log_string}",
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
        )
      rescue StandardError => e
        acknowledge_or_retry(msg, ctx, e)
      end

      # Decide whether to acknowledge message or retry based on delivery attempts
      # Now uses ErrorHandler for fine-grained error handling
      #
      # @param msg [NATS::Msg] NATS message
      # @param ctx [MessageContext] Message context
      # @param error [Exception] Error that occurred
      def acknowledge_or_retry(msg, ctx, error)
        error_ctx = ErrorContext.from_exception(error, reason: 'processing_failed')

        # Use ErrorHandler if available (subscriber has on_error method)
        action = if @error_handler
                   event_data = parse_event_from_msg(msg)
                   @error_handler.handle_error(error, event_data, ctx, ctx.deliveries)
                 else
                   determine_legacy_action(ctx, error)
                 end

        execute_error_action(action, msg, ctx, error, error_ctx)
      end

      # Execute the determined error action
      def execute_error_action(action, msg, ctx, error, error_ctx)
        case action
        when Core::ErrorAction::RETRY
          safe_nak(msg, ctx, error)
          Logging.warn(
            "NAK (retry) event_id=#{ctx.event_id} subject=#{ctx.subject} seq=#{ctx.seq} " \
            "deliveries=#{ctx.deliveries} err=#{error_ctx.to_log_string}",
            tag: 'NatsPubsub::Subscribers::MessageProcessor'
          )
        when Core::ErrorAction::DISCARD
          msg.ack
          Logging.warn(
            "ACK (discard) event_id=#{ctx.event_id} subject=#{ctx.subject} seq=#{ctx.seq} " \
            "deliveries=#{ctx.deliveries} err=#{error_ctx.to_log_string}",
            tag: 'NatsPubsub::Subscribers::MessageProcessor'
          )
        when Core::ErrorAction::DLQ
          published = @dlq.publish_to_dlq(msg, ctx, error_context: error_ctx)
          if published || !NatsPubsub.config.use_dlq
            msg.term
          else
            safe_nak(msg, ctx, error)
          end
          Logging.warn(
            "DLQ event_id=#{ctx.event_id} subject=#{ctx.subject} seq=#{ctx.seq} " \
            "deliveries=#{ctx.deliveries} err=#{error_ctx.to_log_string}",
            tag: 'NatsPubsub::Subscribers::MessageProcessor'
          )
        end
      end

      # Legacy behavior for backward compatibility
      def determine_legacy_action(ctx, error)
        max_deliver = NatsPubsub.config.max_deliver.to_i
        dlq_max_attempts = NatsPubsub.config.dlq_max_attempts.to_i

        if ctx.deliveries >= max_deliver || ctx.deliveries >= dlq_max_attempts
          Core::ErrorAction::DLQ
        else
          Core::ErrorAction::RETRY
        end
      end

      # Parse event data from message for error handler
      def parse_event_from_msg(msg)
        Oj.load(msg.data, mode: :strict)
      rescue Oj::ParseError
        {}
      end

      def safe_nak(msg, ctx = nil, error = nil)
        delay = @backoff.calculate_backoff_delay(ctx&.deliveries.to_i, error) if ctx
        if delay
          msg.nak(next_delivery_delay: delay)
        else
          msg.nak
        end
      rescue StandardError => e
        Logging.error(
          "Failed to NAK event_id=#{ctx&.event_id} deliveries=#{ctx&.deliveries}: " \
          "#{e.class} #{e.message}",
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
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
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
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
          tag: 'NatsPubsub::Subscribers::MessageProcessor'
        )
        raise
      end
    end
  end
end
