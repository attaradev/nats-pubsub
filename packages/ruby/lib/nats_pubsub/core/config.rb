# frozen_string_literal: true

module NatsPubsub
  class Config
    attr_accessor :nats_urls, :env, :app_name,
                  :max_deliver, :ack_wait, :backoff,
                  :use_outbox, :use_inbox, :inbox_model, :outbox_model,
                  :use_dlq, :logger, :concurrency

    attr_reader :server_middleware

    def initialize
      @nats_urls = ENV['NATS_URLS'] || ENV['NATS_URL'] || 'nats://localhost:4222'
      @env       = ENV['NATS_ENV']  || 'development'
      @app_name  = ENV['APP_NAME']  || 'app'

      @max_deliver = 5
      @ack_wait    = '30s'
      @backoff     = %w[1s 5s 15s 30s 60s]

      @use_outbox   = false
      @use_inbox    = false
      @use_dlq      = true
      @outbox_model = 'NatsPubsub::OutboxEvent'
      @inbox_model  = 'NatsPubsub::InboxEvent'
      @logger       = nil
      @concurrency  = 5

      # Middleware chain (lazy loaded to avoid circular dependency)
      @server_middleware = nil
    end

    # Stream name per environment
    def stream_name
      "#{env}-events-stream"
    end

    # PubSub event subject format: {env}.events.{domain}.{resource}.{action}
    def event_subject(domain, resource, action)
      "#{env}.events.#{domain}.#{resource}.#{action}"
    end

    # DLQ subject for failed messages
    def dlq_subject
      "#{env}.events.dlq"
    end

    # Durable consumer name
    def durable_name
      "#{env}-#{app_name}-workers"
    end

    # Access/configure server middleware
    def server_middleware
      @server_middleware ||= begin
        require_relative '../middleware/chain'
        Middleware::Chain.new
      end

      yield @server_middleware if block_given?
      @server_middleware
    end
  end
end
