# frozen_string_literal: true

require_relative '../core/logging'

module NatsPubsub
  module Middleware
    # Middleware that logs message processing start and completion
    class Logging
      def call(subscriber, _payload, metadata)
        start = Time.now

        log_start(subscriber, metadata)

        yield

        elapsed = ((Time.now - start) * 1000).round(2)
        log_complete(subscriber, metadata, elapsed)
      rescue StandardError => e
        elapsed = ((Time.now - start) * 1000).round(2)
        log_error(subscriber, metadata, elapsed, e)
        raise
      end

      private

      def log_start(subscriber, metadata)
        NatsPubsub::Logging.info(
          "Processing #{metadata[:subject]} with #{subscriber.class.name} (attempt #{metadata[:deliveries]})",
          tag: 'NatsPubsub::Middleware::Logging'
        )
      end

      def log_complete(subscriber, _metadata, elapsed)
        NatsPubsub::Logging.info(
          "Completed #{subscriber.class.name} in #{elapsed}ms",
          tag: 'NatsPubsub::Middleware::Logging'
        )
      end

      def log_error(subscriber, _metadata, elapsed, error)
        NatsPubsub::Logging.error(
          "Failed #{subscriber.class.name} after #{elapsed}ms: #{error.class} #{error.message}",
          tag: 'NatsPubsub::Middleware::Logging'
        )
      end
    end
  end
end
