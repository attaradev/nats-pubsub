# frozen_string_literal: true

require_relative '../core/logging'

module NatsPubsub
  module Middleware
    # Middleware that logs retry attempts
    class RetryLogger
      def call(subscriber, _payload, metadata)
        if metadata[:deliveries] && metadata[:deliveries] > 1
          max_deliver = NatsPubsub.config.max_deliver

          NatsPubsub::Logging.warn(
            "Retrying #{metadata[:subject]} with #{subscriber.class.name} " \
            "(attempt #{metadata[:deliveries]}/#{max_deliver})",
            tag: 'NatsPubsub::Middleware::RetryLogger'
          )
        end

        yield
      end
    end
  end
end
