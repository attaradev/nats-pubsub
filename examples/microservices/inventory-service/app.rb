require 'bundler/setup'
require 'sinatra/base'
require 'json'
require 'nats_pubsub'

require_relative 'lib/config'
require_relative 'lib/inventory_repository'
require_relative 'lib/inventory_service'
require_relative 'lib/subscribers/order_created_subscriber'

module InventoryService
  class App < Sinatra::Base
    set :port, Config.port
    set :bind, '0.0.0.0'

    configure do
      # Configure NatsPubsub
      NatsPubsub.configure do |config|
        config.nats_urls = [Config.nats_urls]
        config.env = Config.env
        config.app_name = Config.app_name
        config.concurrency = 5
        config.max_deliver = 3
        config.ack_wait = 30_000
        config.use_dlq = true
      end

      # Setup topology
      NatsPubsub.ensure_topology!
      puts 'NatsPubsub topology setup complete'

      # Initialize repository
      @@inventory_repository = InventoryRepository.new
      @@inventory_repository.initialize_db

      # Initialize service
      @@inventory_service = InventoryService::Service.new(@@inventory_repository)

      # Start subscribers in background thread
      Thread.new do
        subscriber = Subscribers::OrderCreatedSubscriber.new(@@inventory_service)
        NatsPubsub::Subscribers::Registry.register(subscriber)
        NatsPubsub::Subscribers::Pool.start
        puts 'Inventory Service subscribers started'
      end
    end

    # Health check endpoints
    get '/health' do
      content_type :json
      begin
        health = NatsPubsub.health_check
        status health.healthy? ? 200 : 503
        health.to_h.to_json
      rescue => e
        status 503
        { status: 'error', healthy: false, error: e.message }.to_json
      end
    end

    get '/health/ready' do
      content_type :json
      begin
        health = NatsPubsub.quick_health_check
        status health.healthy? ? 200 : 503
        health.to_h.to_json
      rescue => e
        status 503
        { status: 'error', healthy: false, error: e.message }.to_json
      end
    end

    # Inventory endpoints
    get '/inventory/:product_id' do
      content_type :json
      product_id = params['product_id']

      product = @@inventory_service.get_product(product_id)
      if product
        product.to_json
      else
        status 404
        { error: 'Product not found' }.to_json
      end
    end

    post '/inventory' do
      content_type :json
      begin
        data = JSON.parse(request.body.read)
        product = @@inventory_service.add_product(
          data['product_id'],
          data['name'],
          data['quantity'],
          data['price']
        )
        status 201
        product.to_json
      rescue => e
        status 400
        { error: e.message }.to_json
      end
    end

    # Error handling
    error do
      content_type :json
      status 500
      { error: env['sinatra.error'].message }.to_json
    end
  end
end

# Start the application if run directly
if __FILE__ == $0
  puts 'Starting Inventory Service...'
  InventoryService::App.run!
end
