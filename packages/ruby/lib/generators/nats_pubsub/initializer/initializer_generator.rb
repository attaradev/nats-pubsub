# frozen_string_literal: true

require 'rails/generators'

module NatsPubsub
  module Generators
    # Initializer generator that creates NatsPubsub configuration file
    #
    # Usage:
    #   rails generate nats_pubsub:initializer
    #
    # This will create:
    #   config/initializers/nats_pubsub.rb
    #
    # The initializer contains configuration for:
    #   - NATS server connection
    #   - Application settings
    #   - JetStream options
    #   - Logging configuration
    #
    # Example:
    #   rails generate nats_pubsub:initializer
    class InitializerGenerator < Rails::Generators::Base
      source_root File.expand_path('templates', __dir__)
      desc 'Creates NatsPubsub initializer at config/initializers/nats_pubsub.rb'

      def create_initializer
        template 'nats_pubsub.rb', 'config/initializers/nats_pubsub.rb'
        say_status :created, 'config/initializers/nats_pubsub.rb', :green
      rescue StandardError => e
        say_status :error, "Failed to create initializer: #{e.message}", :red
        raise
      end
    end
  end
end
