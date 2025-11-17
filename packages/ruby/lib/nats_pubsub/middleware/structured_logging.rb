# frozen_string_literal: true

require_relative '../core/structured_logger'

module NatsPubsub
  module Middleware
    # Structured logging middleware for message processing
    # Logs with consistent JSON format and correlation IDs
    class StructuredLogging
      def initialize(logger: nil)
        @logger = logger || Core::LoggerFactory.create_from_config(NatsPubsub.config)
      end

      def call(subscriber, payload, metadata)
        start_time = Time.now
        context = build_log_context(subscriber, payload, metadata)

        logger.with_context(context).info('Processing message started')

        begin
          yield

          elapsed_ms = ((Time.now - start_time) * 1000).round(2)
          logger.with_context(context).info('Processing message completed', {
            elapsed_ms: elapsed_ms,
            status: 'success'
          })
        rescue StandardError => e
          elapsed_ms = ((Time.now - start_time) * 1000).round(2)
          logger.with_context(context).error('Processing message failed', {
            elapsed_ms: elapsed_ms,
            status: 'error',
            error_class: e.class.name,
            error_message: e.message,
            backtrace: e.backtrace&.first(5)
          })
          raise
        end
      end

      private

      attr_reader :logger

      def build_log_context(subscriber, payload, metadata)
        {
          subscriber: subscriber.class.name,
          event_id: metadata[:event_id],
          trace_id: metadata[:trace_id],
          subject: metadata[:subject],
          topic: metadata[:topic],
          delivery_count: metadata[:deliveries] || 1
        }.compact
      end
    end
  end
end
