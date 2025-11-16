# frozen_string_literal: true

module NatsPubsub
  module Middleware
    # Middleware that ensures ActiveRecord connections are properly managed
    class ActiveRecord
      def call(subscriber, payload, metadata)
        if defined?(::ActiveRecord::Base)
          ::ActiveRecord::Base.connection_pool.with_connection do
            yield
          end
        else
          yield
        end
      ensure
        ::ActiveRecord::Base.clear_active_connections! if defined?(::ActiveRecord::Base)
      end
    end
  end
end
