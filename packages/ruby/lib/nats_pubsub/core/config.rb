# frozen_string_literal: true

module NatsPubsub
  class Config
    attr_accessor :nats_urls, :env, :app_name, :destination_app,
                  :max_deliver, :ack_wait, :backoff,
                  :use_outbox, :use_inbox, :inbox_model, :outbox_model,
                  :use_dlq, :dlq_max_attempts, :dlq_stream_suffix,
                  :logger, :concurrency

    def initialize
      @nats_urls = ENV['NATS_URLS'] || ENV['NATS_URL'] || 'nats://localhost:4222'
      @env       = ENV['NATS_ENV']  || 'development'
      @app_name  = ENV['APP_NAME']  || 'app'
      @destination_app = ENV.fetch('DESTINATION_APP', nil)

      @max_deliver = 5
      @ack_wait    = '30s'
      @backoff     = %w[1s 5s 15s]

      @use_outbox   = false
      @use_inbox    = false
      @use_dlq      = true
      @dlq_max_attempts = 3
      @dlq_stream_suffix = '-dlq'
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

    # PubSub event subject format
    # Format: {env}.{app_name}.{domain}.{resource}.{action}
    def event_subject(domain, resource, action)
      "#{env}.#{app_name}.#{domain}.#{resource}.#{action}"
    end

    # DLQ subject for failed messages
    def dlq_subject
      "#{env}.#{app_name}.dlq"
    end

    # DLQ stream name
    def dlq_stream_name
      "#{stream_name}#{dlq_stream_suffix}"
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
