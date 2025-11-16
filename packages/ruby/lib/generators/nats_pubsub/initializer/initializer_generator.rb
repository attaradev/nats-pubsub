# frozen_string_literal: true

require 'rails/generators'

module NatsPubsub
  module Generators
    class InitializerGenerator < Rails::Generators::Base
      source_root File.expand_path('templates', __dir__)
      desc 'Creates config/initializers/nats_pubsub.rb'

      def create_initializer
        template 'nats_pubsub.rb', 'config/initializers/nats_pubsub.rb'
      end
    end
  end
end
