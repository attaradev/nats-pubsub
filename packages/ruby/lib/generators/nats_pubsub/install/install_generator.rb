# frozen_string_literal: true

require 'rails/generators'

module NatsPubsub
  module Generators
    # Install generator that creates NatsPubsub initializer and migrations
    #
    # Usage:
    #   rails generate nats_pubsub:install
    #
    # Options:
    #   --skip-initializer  Skip initializer generation
    #   --skip-migrations   Skip migration generation
    #
    # Example:
    #   rails generate nats_pubsub:install --skip-migrations
    class InstallGenerator < Rails::Generators::Base
      desc 'Creates NatsPubsub initializer and migrations'

      class_option :skip_initializer, type: :boolean, default: false,
                                      desc: 'Skip initializer generation'
      class_option :skip_migrations, type: :boolean, default: false,
                                     desc: 'Skip migration generation'

      def create_initializer
        return if options[:skip_initializer]

        say_status :invoke, 'nats_pubsub:initializer', :green
        Rails::Generators.invoke('nats_pubsub:initializer', [],
                                 behavior: behavior,
                                 destination_root: destination_root)
      rescue StandardError => e
        say_status :error, "Failed to create initializer: #{e.message}", :red
        raise unless behavior == :revoke
      end

      def create_migrations
        return if options[:skip_migrations]

        say_status :invoke, 'nats_pubsub:migrations', :green
        Rails::Generators.invoke('nats_pubsub:migrations', [],
                                 behavior: behavior,
                                 destination_root: destination_root)
      rescue StandardError => e
        say_status :error, "Failed to create migrations: #{e.message}", :red
        raise unless behavior == :revoke
      end

      def show_next_steps
        say "\n"
        say_status :info, 'NatsPubsub installed successfully!', :green
        say "\n"
        say 'Next steps:', :yellow
        say '  1. Review and configure:', :white
        say '     config/initializers/nats_pubsub.rb', :white
        say "\n"
        say '  2. Run migrations (if using outbox/inbox):', :white
        say '     rails db:migrate', :white
        say "\n"
        say '  3. Create your first subscriber:', :white
        say '     rails generate nats_pubsub:subscriber UserNotification users.user', :white
        say "\n"
        say 'Additional generators:', :yellow
        say '  • rails generate nats_pubsub:subscriber NAME [topics...]', :white
        say '  • rails generate nats_pubsub:config [--outbox] [--inbox]', :white
        say "\n"
        say 'Documentation:', :yellow
        say '  • Testing Guide: packages/ruby/TESTING_GUIDE.md', :white
        say '  • Main README: README.md', :white
        say "\n"
      end
    end
  end
end
