module InventoryService
  module Config
    class << self
      def env
        ENV['RACK_ENV'] || 'development'
      end

      def port
        (ENV['PORT'] || '3003').to_i
      end

      def nats_urls
        ENV['NATS_URLS'] || 'nats://localhost:4222'
      end

      def database_url
        ENV['DATABASE_URL'] || 'postgres://postgres:postgres@localhost:5432/inventory'
      end

      def app_name
        ENV['APP_NAME'] || 'inventory-service'
      end
    end
  end
end
