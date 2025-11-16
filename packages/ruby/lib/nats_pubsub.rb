# frozen_string_literal: true

require_relative 'nats_pubsub/version'
require_relative 'nats_pubsub/core/config'
require_relative 'nats_pubsub/core/duration'
require_relative 'nats_pubsub/core/logging'
require_relative 'nats_pubsub/core/connection'
require_relative 'nats_pubsub/publisher/publisher'
require_relative 'nats_pubsub/consumer/consumer'

# Load pubsub features
require_relative 'nats_pubsub/subscriber'
require_relative 'nats_pubsub/subscriber_registry'
require_relative 'nats_pubsub/message_router'
require_relative 'nats_pubsub/pubsub'

# Load middleware
require_relative 'nats_pubsub/middleware/chain'
require_relative 'nats_pubsub/middleware/logging'
require_relative 'nats_pubsub/middleware/active_record'
require_relative 'nats_pubsub/middleware/retry_logger'

# If you have a Railtie for tasks/eager-loading
require_relative 'nats_pubsub/railtie' if defined?(Rails::Railtie)

# Load gem-provided models from lib/
require_relative 'nats_pubsub/inbox_event'
require_relative 'nats_pubsub/outbox_event'

# Optionally load Web UI (requires sinatra)
begin
  require 'sinatra/base'
  require_relative 'nats_pubsub/web'
rescue LoadError
  # Sinatra not installed, skip Web UI
end

# Optionally load ActiveRecord integration
require_relative 'nats_pubsub/active_record/publishable' if defined?(ActiveRecord)

# NatsPubsub main module.
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
    #
    # @return [Object] JetStream context
    def ensure_topology!
      Connection.connect!
      Connection.jetstream
    end

    private

    def assign!(cfg, key, val)
      setter = :"#{key}="
      raise ArgumentError, "Unknown configuration option: #{key}" unless cfg.respond_to?(setter)

      cfg.public_send(setter, val)
    end
  end
end
