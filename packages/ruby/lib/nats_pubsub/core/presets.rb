# frozen_string_literal: true

module NatsPubsub
  module Core
    # Configuration presets for common environments
    #
    # Provides pre-configured settings optimized for different deployment scenarios.
    #
    # @example Development preset
    #   NatsPubsub.configure do |config|
    #     Presets.development(config, app_name: 'my-service')
    #   end
    #
    # @example Production preset
    #   NatsPubsub.configure do |config|
    #     Presets.production(
    #       config,
    #       app_name: 'my-service',
    #       nats_urls: ENV.fetch('NATS_CLUSTER_URLS').split(',')
    #     )
    #   end
    #
    module Presets
      # Development preset optimized for local development
      #
      # Features:
      # - Lower concurrency for easier debugging
      # - Shorter timeouts for faster feedback
      # - DLQ enabled for error visibility
      # - Debug logging
      #
      # @param config [Config] Configuration object
      # @param options [Hash] Additional options
      # @option options [String] :app_name Application name (required)
      # @option options [String, Array<String>] :nats_urls NATS server URLs (default: 'nats://localhost:4222')
      #
      # @example
      #   NatsPubsub.configure do |config|
      #     Presets.development(config, app_name: 'my-service')
      #   end
      #
      def self.development(config, **options)
        validate_required_options!(options, :app_name)

        config.app_name = options[:app_name]
        config.nats_urls = options.fetch(:nats_urls, 'nats://localhost:4222')
        config.env = options.fetch(:env, 'development')

        # Lower concurrency for easier debugging
        config.concurrency = 5

        # Faster feedback during development
        config.max_deliver = 3
        config.ack_wait = 15_000 # 15 seconds
        config.backoff = [1_000, 3_000, 5_000] # Shorter backoff

        # DLQ enabled for visibility
        config.use_dlq = true

        # Inbox/Outbox typically not needed in dev
        config.use_inbox = false
        config.use_outbox = false

        config
      end

      # Production preset optimized for reliability and performance
      #
      # Features:
      # - Higher concurrency for throughput
      # - Longer timeouts for network latency
      # - Aggressive retry strategy
      # - DLQ enabled for operational safety
      # - Info-level logging
      #
      # @param config [Config] Configuration object
      # @param options [Hash] Additional options
      # @option options [String] :app_name Application name (required)
      # @option options [String, Array<String>] :nats_urls NATS server URLs (required)
      #
      # @example
      #   NatsPubsub.configure do |config|
      #     Presets.production(
      #       config,
      #       app_name: 'my-service',
      #       nats_urls: ENV.fetch('NATS_CLUSTER_URLS').split(',')
      #     )
      #   end
      #
      def self.production(config, **options)
        validate_required_options!(options, :app_name, :nats_urls)

        config.app_name = options[:app_name]
        config.nats_urls = options[:nats_urls]
        config.env = options.fetch(:env, 'production')

        # Higher concurrency for throughput
        config.concurrency = 20

        # More aggressive retry strategy
        config.max_deliver = 5
        config.ack_wait = 30_000 # 30 seconds
        config.backoff = [1_000, 5_000, 15_000, 30_000, 60_000] # Exponential backoff

        # DLQ enabled for operational safety
        config.use_dlq = true

        # Consider enabling for transactional guarantees
        config.use_inbox = options.fetch(:use_inbox, false)
        config.use_outbox = options.fetch(:use_outbox, false)

        config
      end

      # Staging preset balanced between development and production
      #
      # Features:
      # - Moderate concurrency
      # - Production-like retry strategy
      # - DLQ enabled
      # - Debug logging for troubleshooting
      #
      # @param config [Config] Configuration object
      # @param options [Hash] Additional options
      # @option options [String] :app_name Application name (required)
      # @option options [String, Array<String>] :nats_urls NATS server URLs (required)
      #
      # @example
      #   NatsPubsub.configure do |config|
      #     Presets.staging(
      #       config,
      #       app_name: 'my-service',
      #       nats_urls: 'nats://staging-nats:4222'
      #     )
      #   end
      #
      def self.staging(config, **options)
        validate_required_options!(options, :app_name, :nats_urls)

        config.app_name = options[:app_name]
        config.nats_urls = options[:nats_urls]
        config.env = options.fetch(:env, 'staging')

        # Moderate concurrency
        config.concurrency = 10

        # Production-like retry strategy
        config.max_deliver = 5
        config.ack_wait = 30_000
        config.backoff = [1_000, 5_000, 15_000, 30_000, 60_000]

        # DLQ enabled
        config.use_dlq = true

        # Inbox/Outbox optional
        config.use_inbox = options.fetch(:use_inbox, false)
        config.use_outbox = options.fetch(:use_outbox, false)

        config
      end

      # Testing preset optimized for unit and integration tests
      #
      # Features:
      # - Minimal concurrency
      # - Very short timeouts for fast tests
      # - No retries for deterministic behavior
      # - DLQ disabled
      #
      # @param config [Config] Configuration object
      # @param options [Hash] Additional options
      # @option options [String] :app_name Application name (required)
      # @option options [String, Array<String>] :nats_urls NATS server URLs (default: 'nats://localhost:4222')
      #
      # @example
      #   NatsPubsub.configure do |config|
      #     Presets.testing(config, app_name: 'test-service')
      #   end
      #
      def self.testing(config, **options)
        validate_required_options!(options, :app_name)

        config.app_name = options[:app_name]
        config.nats_urls = options.fetch(:nats_urls, 'nats://localhost:4222')
        config.env = options.fetch(:env, 'test')

        # Minimal concurrency
        config.concurrency = 1

        # No retries for deterministic behavior
        config.max_deliver = 1
        config.ack_wait = 5_000 # 5 seconds
        config.backoff = []

        # DLQ disabled for simpler testing
        config.use_dlq = false

        # Inbox/Outbox disabled
        config.use_inbox = false
        config.use_outbox = false

        config
      end

      # Validate required options
      #
      # @param options [Hash] Options hash
      # @param required [Array<Symbol>] Required option keys
      # @raise [ArgumentError] If required options are missing
      #
      # @api private
      def self.validate_required_options!(options, *required)
        missing = required - options.keys
        return if missing.empty?

        raise ArgumentError, "Missing required options: #{missing.join(', ')}"
      end

      private_class_method :validate_required_options!
    end
  end
end
