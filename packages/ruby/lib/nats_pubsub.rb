# frozen_string_literal: true

# NatsPubsub - Declarative PubSub messaging for NATS JetStream
module NatsPubsub
  class Error < StandardError; end
  class ConfigurationError < Error; end
  class ConnectionError < Error; end
  class PublishError < Error; end
  class SubscriptionError < Error; end
end

# Load version first
require_relative 'nats_pubsub/version'

# Core dependencies
require_relative 'nats_pubsub/core/constants'
require_relative 'nats_pubsub/core/config'
require_relative 'nats_pubsub/core/config_presets'
require_relative 'nats_pubsub/core/duration'
require_relative 'nats_pubsub/core/subject'
require_relative 'nats_pubsub/core/event'
require_relative 'nats_pubsub/core/logging'
require_relative 'nats_pubsub/core/structured_logger'
require_relative 'nats_pubsub/core/connection'
require_relative 'nats_pubsub/core/retry_strategy'
require_relative 'nats_pubsub/core/base_repository'
require_relative 'nats_pubsub/core/message_context'
require_relative 'nats_pubsub/core/error_action'
require_relative 'nats_pubsub/core/presets'
require_relative 'nats_pubsub/core/health_check'

# Model utilities
require_relative 'nats_pubsub/models/model_utils'
require_relative 'nats_pubsub/models/model_codec_setup'
require_relative 'nats_pubsub/models/event_model'

# Publisher components
require_relative 'nats_pubsub/publisher/envelope_builder'
require_relative 'nats_pubsub/publisher/publish_result'
require_relative 'nats_pubsub/publisher/publish_argument_parser'
require_relative 'nats_pubsub/publisher/outbox_repository'
require_relative 'nats_pubsub/publisher/outbox_publisher'
require_relative 'nats_pubsub/publisher/publisher'
require_relative 'nats_pubsub/publisher/fluent_batch'

# Subscriber system (consolidated from consumer)
require_relative 'nats_pubsub/subscribers/worker'
require_relative 'nats_pubsub/subscribers/message_context'
require_relative 'nats_pubsub/subscribers/error_context'
require_relative 'nats_pubsub/subscribers/error_handler'
require_relative 'nats_pubsub/subscribers/graceful_shutdown'
require_relative 'nats_pubsub/subscribers/message_processor'
require_relative 'nats_pubsub/subscribers/subscription_manager'
require_relative 'nats_pubsub/subscribers/dlq_handler'
require_relative 'nats_pubsub/subscribers/message_router'
require_relative 'nats_pubsub/subscribers/pool'
require_relative 'nats_pubsub/subscribers/inbox/inbox_message'
require_relative 'nats_pubsub/subscribers/inbox/inbox_processor'
require_relative 'nats_pubsub/subscribers/inbox/inbox_repository'
require_relative 'nats_pubsub/subscribers/subscriber'
require_relative 'nats_pubsub/subscribers/registry'

# Topology management
require_relative 'nats_pubsub/topology/subject_matcher'
require_relative 'nats_pubsub/topology/overlap_guard'
require_relative 'nats_pubsub/topology/stream_support'
require_relative 'nats_pubsub/topology/stream'
require_relative 'nats_pubsub/topology/topology'

# Middleware
require_relative 'nats_pubsub/middleware/chain'
require_relative 'nats_pubsub/middleware/logging'
require_relative 'nats_pubsub/middleware/structured_logging'
require_relative 'nats_pubsub/middleware/active_record'
require_relative 'nats_pubsub/middleware/retry_logger'

# Models
require_relative 'nats_pubsub/models/inbox_event'
require_relative 'nats_pubsub/models/outbox_event'

# Optional: ActiveRecord integration
require_relative 'nats_pubsub/active_record/publishable' if defined?(ActiveRecord)

# Optional: Rails integration
require_relative 'nats_pubsub/railtie' if defined?(Rails::Railtie)

# Optional: Web UI (requires Sinatra)
begin
  require 'sinatra/base'
  require_relative 'nats_pubsub/web'
rescue LoadError
  # Sinatra not installed, skip Web UI
end

# Optional: Testing utilities
require_relative 'nats_pubsub/testing' if defined?(RSpec)
require_relative 'nats_pubsub/testing/test_harness' if defined?(RSpec)

# NatsPubsub main module extensions.
module NatsPubsub
  class << self
    def config
      @config ||= Config.new
    end

    def configure(overrides = {})
      cfg = config
      overrides.each { |k, v| assign!(cfg, k, v) } unless overrides.nil? || overrides.empty?
      yield(cfg) if block_given?
      cfg
    end

    def reset!
      @config = nil
    end

    def use_outbox?
      config.use_outbox
    end

    def use_inbox?
      config.use_inbox
    end

    def use_dlq?
      config.use_dlq
    end

    # Establishes a connection and ensures stream topology.
    # This is the recommended way to initialize the system.
    #
    # @return [Object] JetStream context
    def ensure_topology!
      jts = Connection.connect!
      Topology.ensure!(jts)
      jts
    end

    # Publish a message to a topic
    #
    # @param topic [String] Topic name (e.g., 'orders.created', 'notifications.email.send')
    # @param message [Hash] Message payload
    # @param options [Hash] Additional options (event_id, trace_id, correlation_id, occurred_at, message_type)
    # @return [PublishResult] Result object with success status and details
    #
    # @example Simple publish
    #   result = NatsPubsub.publish(topic: 'orders.created', message: { order_id: '123', amount: 99.99 })
    #   puts "Published: #{result.event_id}" if result.success?
    #
    # @example With metadata
    #   result = NatsPubsub.publish(
    #     topic: 'orders.created',
    #     message: { order_id: '123' },
    #     trace_id: 'trace-123',
    #     correlation_id: 'corr-456'
    #   )
    def publish(topic:, message:, **options)
      Publisher.new.publish(topic: topic, message: message, **options)
    end

    # Create a batch publisher for publishing multiple messages efficiently
    #
    # @yield [FluentBatch] Batch publisher instance
    # @return [FluentBatch] Batch publisher instance for chaining
    #
    # @example Block syntax
    #   result = NatsPubsub.batch do |b|
    #     b.add 'user.created', { id: 1, name: 'Alice' }
    #     b.add 'user.created', { id: 2, name: 'Bob' }
    #     b.with_options trace_id: 'batch-123'
    #   end.publish
    #
    # @example Chaining syntax
    #   result = NatsPubsub.batch
    #     .add('user.created', { id: 1 })
    #     .add('notification.sent', { user_id: 1 })
    #     .publish
    #
    def batch(&block)
      batch_publisher = FluentBatch.new
      yield(batch_publisher) if block_given?
      batch_publisher
    end

    # Convenience method: Configure and initialize in one call
    # Combines configure + ensure_topology! for simpler setup
    #
    # @yield [Config] Configuration block
    # @return [Object] JetStream context
    #
    # @example
    #   NatsPubsub.setup! do |config|
    #     config.app_name = 'my_app'
    #     config.nats_urls = ['nats://localhost:4222']
    #     config.env = 'production'
    #   end
    def setup!
      configure { |cfg| yield(cfg) if block_given? }
      config.validate!
      ensure_topology!
    end

    # Setup with a configuration preset
    # Applies preset defaults, then allows customization, then initializes
    #
    # @param preset [Symbol] Preset name (:development, :production, :testing)
    # @yield [Config] Configuration block for customization
    # @return [Object] JetStream context
    #
    # @example
    #   NatsPubsub.setup_with_preset!(:production) do |config|
    #     config.nats_urls = ENV['NATS_URLS']
    #     config.app_name = 'my-app'
    #   end
    def setup_with_preset!(preset)
      # Reset to fresh config
      @config = Config.new(preset: preset)

      # Allow customization
      yield(config) if block_given?

      # Validate and connect
      config.validate!
      ensure_topology!
    end

    # Convenience method: Connect to NATS (idempotent)
    # Alias for ensure_topology! with clearer intent
    #
    # @return [Object] JetStream context
    def connect!
      ensure_topology!
    end

    # Perform comprehensive health check
    #
    # @return [Core::HealthCheck::Result] Health check result
    #
    # @example
    #   status = NatsPubsub.health_check
    #   puts "Status: #{status.status}"
    #   puts "Healthy: #{status.healthy?}"
    def health_check
      Core::HealthCheck.check
    end

    # Perform quick health check (connection only)
    #
    # @return [Core::HealthCheck::Result] Health check result
    #
    # @example
    #   status = NatsPubsub.quick_health_check
    #   puts "Healthy: #{status.healthy?}"
    def quick_health_check
      Core::HealthCheck.quick_check
    end

    # Get health check middleware for Rack apps
    #
    # @return [Proc] Rack middleware
    #
    # @example Sinatra
    #   get '/health' do
    #     status, headers, body = NatsPubsub.health_check_middleware.call(env)
    #     [status, headers, body]
    #   end
    #
    # @example Rails
    #   get '/health', to: NatsPubsub.health_check_middleware
    def health_check_middleware
      Core::HealthCheck.middleware
    end

    # Get quick health check middleware for Rack apps
    #
    # @return [Proc] Rack middleware
    def quick_health_check_middleware
      Core::HealthCheck.quick_middleware
    end

    private

    def assign!(cfg, key, val)
      setter = :"#{key}="
      raise ArgumentError, "Unknown configuration option: #{key}" unless cfg.respond_to?(setter)

      cfg.public_send(setter, val)
    end
  end
end
