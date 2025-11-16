# frozen_string_literal: true

require_relative 'constants'

module NatsPubsub
  # Configuration presets for common deployment scenarios
  # Provides smart defaults for development, production, and testing environments
  #
  # @example Using a preset
  #   NatsPubsub.setup_with_preset!(:production) do |config|
  #     config.nats_urls = ENV['NATS_URLS']
  #     config.app_name = 'my-app'
  #   end
  class ConfigPresets
    class << self
      # Apply a preset to a configuration object
      #
      # @param config [Config] Configuration object to modify
      # @param preset [Symbol] Preset name (:development, :production, :testing)
      # @raise [ArgumentError] if preset is unknown
      def apply!(config, preset)
        case preset
        when :development
          apply_development!(config)
        when :production
          apply_production!(config)
        when :testing, :test
          apply_testing!(config)
        else
          raise ArgumentError, "Unknown preset: #{preset}. Available: :development, :production, :testing"
        end
      end

      # Get preset description
      #
      # @param preset [Symbol] Preset name
      # @return [String] Description of the preset
      def description(preset)
        DESCRIPTIONS[preset] || "Unknown preset: #{preset}"
      end

      # List all available presets
      #
      # @return [Array<Symbol>] Available preset names
      def available_presets
        %i[development production testing]
      end

      private

      # Development preset - optimized for local development
      # - Verbose logging for debugging
      # - Lower concurrency to avoid resource exhaustion
      # - DLQ enabled for debugging failed messages
      # - Shorter timeouts for faster feedback
      # - Outbox/Inbox disabled by default (can enable for testing)
      def apply_development!(config)
        config.env = 'development' unless config.env
        config.concurrency = Constants::Consumer::DEFAULT_CONCURRENCY
        config.max_deliver = 3 # Fail faster in development
        config.ack_wait = '10s' # Shorter timeout for faster feedback
        config.backoff = %w[500ms 2s 5s] # Faster retries

        # Features
        config.use_dlq = true
        config.use_outbox = false
        config.use_inbox = false
        config.dlq_max_attempts = 2 # Fail to DLQ faster for debugging

        # Logging - verbose for development
        config.logger ||= create_logger(:debug)
      end

      # Production preset - optimized for reliability and performance
      # - Error-level logging to reduce noise
      # - Higher concurrency for throughput
      # - DLQ enabled for failure recovery
      # - Longer timeouts for stability
      # - Outbox/Inbox available (must explicitly enable)
      def apply_production!(config)
        config.env = 'production' unless config.env
        config.concurrency = 20 # Higher throughput
        config.max_deliver = Constants::Retry::MAX_ATTEMPTS
        config.ack_wait = "#{Constants::Timeouts::ACK_WAIT_DEFAULT / 1000}s"
        config.backoff = Constants::Retry::DEFAULT_BACKOFF.map { |ms| "#{ms}ms" }

        # Features
        config.use_dlq = true
        config.use_outbox = false # Explicitly enable when needed
        config.use_inbox = false # Explicitly enable when needed
        config.dlq_max_attempts = Constants::DLQ::MAX_ATTEMPTS

        # Logging - errors only in production
        config.logger ||= create_logger(:error)
      end

      # Testing preset - optimized for test suite performance
      # - Synchronous processing (no background workers)
      # - Minimal logging to avoid test output noise
      # - DLQ disabled (tests should verify behavior directly)
      # - Fast timeouts
      # - Fake mode enabled by default
      def apply_testing!(config)
        config.env = 'test' unless config.env
        config.concurrency = 1 # Synchronous processing
        config.max_deliver = 2 # Fail fast in tests
        config.ack_wait = '1s' # Fast timeout
        config.backoff = %w[100ms 500ms] # Minimal retries

        # Features - disabled for speed
        config.use_dlq = false
        config.use_outbox = false
        config.use_inbox = false
        config.dlq_max_attempts = 1

        # Logging - minimal for tests
        config.logger ||= create_logger(:fatal) # Only fatal errors
      end

      # Create a logger with specified level
      def create_logger(level)
        require 'logger'
        logger = Logger.new($stdout)
        logger.level = Logger.const_get(level.to_s.upcase)
        logger.formatter = proc do |severity, datetime, _progname, msg|
          "[#{datetime.strftime('%Y-%m-%d %H:%M:%S')}] #{severity}: #{msg}\n"
        end
        logger
      end

      # Preset descriptions for documentation
      DESCRIPTIONS = {
        development: 'Optimized for local development with verbose logging and fast feedback',
        production: 'Optimized for reliability and performance in production environments',
        testing: 'Optimized for test suite performance with synchronous processing'
      }.freeze
    end
  end
end
