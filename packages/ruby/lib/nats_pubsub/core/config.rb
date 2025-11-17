# frozen_string_literal: true

require_relative 'subject'
require_relative 'constants'

module NatsPubsub
  class Config
    attr_accessor :nats_urls, :env, :app_name, :destination_app,
                  :max_deliver, :ack_wait, :backoff,
                  :use_outbox, :use_inbox, :inbox_model, :outbox_model,
                  :use_dlq, :dlq_max_attempts, :dlq_stream_suffix,
                  :logger, :concurrency,
                  :connection_pool_size, :connection_pool_timeout
    attr_reader :preset

    def initialize(preset: nil)
      @preset = preset

      # Default values (can be overridden by preset)
      @nats_urls = ENV['NATS_URLS'] || ENV['NATS_URL'] || 'nats://localhost:4222'
      @env       = ENV['NATS_ENV']  || 'development'
      @app_name  = ENV['APP_NAME']  || 'app'
      @destination_app = ENV.fetch('DESTINATION_APP', nil)

      @max_deliver = Constants::Retry::MAX_ATTEMPTS
      @ack_wait    = "#{Constants::Timeouts::ACK_WAIT_DEFAULT / 1000}s"
      @backoff     = Constants::Retry::DEFAULT_BACKOFF.map { |ms| "#{ms}ms" }

      @use_outbox   = false
      @use_inbox    = false
      @use_dlq      = true
      @dlq_max_attempts = Constants::DLQ::MAX_ATTEMPTS
      @dlq_stream_suffix = Constants::DLQ::STREAM_SUFFIX
      @outbox_model = 'NatsPubsub::OutboxEvent'
      @inbox_model  = 'NatsPubsub::InboxEvent'
      @logger       = nil
      @concurrency  = Constants::Consumer::DEFAULT_CONCURRENCY

      # Connection pool settings
      @connection_pool_size = ENV.fetch('NATS_POOL_SIZE', 5).to_i
      @connection_pool_timeout = ENV.fetch('NATS_POOL_TIMEOUT', 5).to_i

      # Middleware chain (lazy loaded to avoid circular dependency)
      @server_middleware = nil

      # Apply preset if provided
      apply_preset!(preset) if preset
    end

    # Stream name per environment
    def stream_name
      "#{env}-events-stream"
    end

    # PubSub event subject format
    # Delegates to Subject class for centralized subject building
    # Format: {env}.{app_name}.{domain}.{resource}.{action}
    def event_subject(domain, resource, action)
      Subject.from_event(
        env: env,
        app_name: app_name,
        domain: domain,
        resource: resource,
        action: action
      ).to_s
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

    # Apply a configuration preset
    #
    # @param preset_name [Symbol] Preset name (:development, :production, :testing)
    # @raise [ArgumentError] if preset is unknown
    # @return [void]
    def apply_preset!(preset_name)
      require_relative 'config_presets'
      ConfigPresets.apply!(self, preset_name)
      @preset = preset_name
    end

    # Validate configuration values
    # Raises ConfigurationError if invalid
    #
    # @raise [ConfigurationError] if configuration is invalid
    # @return [void]
    def validate!
      validate_required_fields!
      validate_numeric_ranges!
      validate_urls!
      validate_concurrency_bounds!
    end

    private

    def validate_required_fields!
      raise ConfigurationError, 'app_name cannot be blank' if app_name.nil? || app_name.to_s.strip.empty?
      raise ConfigurationError, 'env cannot be blank' if env.nil? || env.to_s.strip.empty?
      raise ConfigurationError, 'nats_urls cannot be empty' if nats_urls.nil? || nats_urls.empty?
    end

    def validate_numeric_ranges!
      raise ConfigurationError, 'concurrency must be positive' if concurrency && concurrency <= 0
      raise ConfigurationError, 'max_deliver must be positive' if max_deliver && max_deliver <= 0
      raise ConfigurationError, 'dlq_max_attempts must be positive' if dlq_max_attempts && dlq_max_attempts <= 0
    end

    def validate_concurrency_bounds!
      return unless concurrency

      min = Constants::Consumer::MIN_CONCURRENCY
      max = Constants::Consumer::MAX_CONCURRENCY

      if concurrency < min
        raise ConfigurationError, "concurrency must be at least #{min}, got #{concurrency}"
      elsif concurrency > max
        raise ConfigurationError, "concurrency cannot exceed #{max}, got #{concurrency}"
      end
    end

    def validate_urls!
      return unless nats_urls

      Array(nats_urls).each do |url|
        raise ConfigurationError, "Invalid NATS URL: #{url}" unless url =~ %r{\Anats://}i
      end
    end
  end
end
