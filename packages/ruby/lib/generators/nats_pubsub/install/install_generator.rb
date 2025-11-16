# frozen_string_literal: true

require 'rails/generators'

module NatsPubsub
  module Generators
    # Install generator.
    class InstallGenerator < Rails::Generators::Base
      desc 'Creates NatsPubsub initializer and migrations'
      def create_initializer
        Rails::Generators.invoke('nats_pubsub:initializer', [], behavior: behavior,
                                                                destination_root: destination_root)
      end

      def create_migrations
        Rails::Generators.invoke('nats_pubsub:migrations', [], behavior: behavior,
                                                               destination_root: destination_root)
      end
    end
  end
end
