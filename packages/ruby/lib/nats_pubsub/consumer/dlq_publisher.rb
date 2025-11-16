# frozen_string_literal: true

require 'oj'
require 'time'
require 'base64'
require_relative '../core/logging'
require_relative '../core/config'

module NatsPubsub
  class DlqPublisher
    def initialize(jts)
      @jts = jts
    end

    # Sends original payload to DLQ with explanatory headers/context
    def publish(msg, ctx, reason:, error_class:, error_message:)
      unless NatsPubsub.config.use_dlq
        Logging.warn("DLQ disabled; skipping publish for event_id=#{ctx.event_id}", tag: 'NatsPubsub::Consumer')
        return false
      end

      raw_base64 = Base64.strict_encode64(msg.data.to_s)
      envelope = build_envelope(ctx, reason, error_class, error_message, raw_base64)
      headers  = build_headers(msg.header, reason, ctx.deliveries, envelope)
      @jts.publish(NatsPubsub.config.dlq_subject, msg.data, header: headers)
      true
    rescue StandardError => e
      Logging.error(
        "DLQ publish failed event_id=#{ctx.event_id}: #{e.class} #{e.message}",
        tag: 'NatsPubsub::Consumer'
      )
      false
    end

    private

    def build_envelope(ctx, reason, error_class, error_message, raw_base64)
      {
        event_id: ctx.event_id,
        reason: reason,
        error_class: error_class,
        error_message: error_message,
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
