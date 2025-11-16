# frozen_string_literal: true

module NatsPubsub
  module Middleware
    # Middleware that ensures ActiveRecord connections are properly managed
    class ActiveRecord
      def call(_subscriber, _payload, _metadata, &)
        if defined?(::ActiveRecord::Base)
          ::ActiveRecord::Base.connection_pool.with_connection(&)
        else
          yield
        end
      ensure
        ::ActiveRecord::Base.clear_active_connections! if defined?(::ActiveRecord::Base)
      end
    end
  end
end
