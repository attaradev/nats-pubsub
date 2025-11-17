# frozen_string_literal: true

require 'oj'
require 'time'
require 'base64'
require_relative '../core/logging'
require_relative '../core/config'

module NatsPubsub
  module Subscribers
    class DlqHandler
      def initialize(jts)
        @jts = jts
      end

      # Publishes failed message to Dead Letter Queue with explanatory headers/context
      #
      # @param msg [NATS::Msg] NATS message object
      # @param ctx [MessageContext] Message context
      # @param error_context [ErrorContext] Error context with failure details
      # @return [Boolean] True if published successfully, false otherwise
      def publish_to_dlq(msg, ctx, error_context:)
        unless NatsPubsub.config.use_dlq
          Logging.warn("DLQ disabled; skipping publish for event_id=#{ctx.event_id}", tag: 'NatsPubsub::Subscribers::DlqHandler')
          return false
        end

        raw_base64 = Base64.strict_encode64(msg.data.to_s)
        envelope = build_envelope(ctx, error_context, raw_base64)
        headers  = build_headers(msg.header, error_context.reason, ctx.deliveries, envelope)
        @jts.publish(NatsPubsub.config.dlq_subject, msg.data, header: headers)
        true
      rescue StandardError => e
        Logging.error(
          "DLQ publish failed event_id=#{ctx.event_id}: #{e.class} #{e.message}",
          tag: 'NatsPubsub::Subscribers::DlqHandler'
        )
        false
      end

      private

      def build_envelope(ctx, error_context, raw_base64)
        {
          event_id: ctx.event_id,
          reason: error_context.reason,
          error_class: error_context.error_class,
          error_message: error_context.error_message,
          deliveries: ctx.deliveries,
          original_subject: ctx.subject,
          sequence: ctx.seq,
          consumer: ctx.consumer,
          stream: ctx.stream,
          published_at: Time.now.utc.iso8601,
          raw_base64: raw_base64
        }
      end

      def build_headers(original_headers, reason, deliveries, envelope)
        headers = (original_headers || {}).dup
        headers['x-dead-letter'] = 'true'
        headers['x-dlq-reason']  = reason
        headers['x-deliveries']  = deliveries.to_s
        headers['x-dlq-context'] = Oj.dump(envelope, mode: :compat)
        headers
      end
    end
  end
end
