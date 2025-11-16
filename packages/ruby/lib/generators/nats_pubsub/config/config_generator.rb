# frozen_string_literal: true

require 'rails/generators'

module NatsPubsub
  module Generators
    # Config generator that updates NatsPubsub configuration
    #
    # Usage:
    #   rails generate nats_pubsub:config [options]
    #
    # Examples:
    #   rails generate nats_pubsub:config --outbox
    #   rails generate nats_pubsub:config --inbox
    #   rails generate nats_pubsub:config --outbox --inbox
    #   rails generate nats_pubsub:config --concurrency=10
    #   rails generate nats_pubsub:config --env-file
    #
    # Options:
    #   --outbox              Enable outbox pattern
    #   --inbox               Enable inbox pattern
    #   --concurrency=N       Set concurrency level (default: 5)
    #   --max-deliver=N       Set max delivery attempts (default: 5)
    #   --ack-wait=DURATION   Set ack wait timeout (default: 30s)
    #   --env-file            Generate .env.example file
    #   --force               Overwrite existing configuration
    #
    # This will:
    #   - Update config/initializers/nats_pubsub.rb
    #   - Optionally generate .env.example
    class ConfigGenerator < Rails::Generators::Base
      source_root File.expand_path('templates', __dir__)
      desc 'Updates NatsPubsub configuration'

      class_option :outbox, type: :boolean, default: false,
                            desc: 'Enable outbox pattern'
      class_option :inbox, type: :boolean, default: false,
                           desc: 'Enable inbox pattern'
      class_option :concurrency, type: :numeric, default: nil,
                                 desc: 'Set concurrency level'
      class_option :max_deliver, type: :numeric, default: nil,
                                 desc: 'Set max delivery attempts'
      class_option :ack_wait, type: :string, default: nil,
                              desc: 'Set ack wait timeout (e.g., 30s, 1m)'
      class_option :env_file, type: :boolean, default: false,
                              desc: 'Generate .env.example file'
      class_option :force, type: :boolean, default: false,
                           desc: 'Overwrite existing configuration'

      def check_initializer_exists
        @initializer_path = 'config/initializers/nats_pubsub.rb'
        @initializer_exists = File.exist?(File.join(destination_root, @initializer_path))

        unless @initializer_exists
          say_status :error, 'NatsPubsub initializer not found. Run: rails generate nats_pubsub:initializer', :red
          exit(1) unless options[:force]
        end
      end

      def update_or_create_initializer
        if @initializer_exists && !options[:force]
          update_existing_initializer
        else
          create_new_initializer
        end
      end

      def generate_env_file
        return unless options[:env_file]

        template 'env.example.tt', '.env.example'
        say_status :created, '.env.example', :green
      rescue StandardError => e
        say_status :error, "Failed to create .env.example: #{e.message}", :red
      end

      def show_instructions
        say "\n"
        say_status :info, 'Configuration updated successfully!', :green
        say "\n"

        if options[:outbox] || options[:inbox]
          say 'Next steps:', :yellow
          say '  1. Run migrations if you enabled outbox/inbox:', :yellow
          say '     rails db:migrate', :white
          say "\n"
        end

        if options[:env_file]
          say '  2. Copy .env.example to .env and configure:', :yellow
          say '     cp .env.example .env', :white
          say "\n"
        end

        say '  3. Restart your Rails server', :yellow
        say "\n"
      end

      private

      def update_existing_initializer
        content = File.read(File.join(destination_root, @initializer_path))

        content = update_outbox_setting(content) if options[:outbox]
        content = update_inbox_setting(content) if options[:inbox]
        content = update_concurrency_setting(content) if options[:concurrency]
        content = update_max_deliver_setting(content) if options[:max_deliver]
        content = update_ack_wait_setting(content) if options[:ack_wait]

        File.write(File.join(destination_root, @initializer_path), content)
        say_status :updated, @initializer_path, :green
      end

      def create_new_initializer
        template 'nats_pubsub.rb.tt', @initializer_path
        say_status :created, @initializer_path, :green
      end

      def update_outbox_setting(content)
        content.gsub(/config\.use_outbox\s*=\s*\w+/, 'config.use_outbox = true')
      end

      def update_inbox_setting(content)
        content.gsub(/config\.use_inbox\s*=\s*\w+/, 'config.use_inbox = true')
      end

      def update_concurrency_setting(content)
        if content.match?(/config\.concurrency\s*=/)
          content.gsub(/config\.concurrency\s*=\s*\d+/, "config.concurrency = #{options[:concurrency]}")
        else
          # Add concurrency setting after consumer tuning section
          content.gsub(/(# Consumer Tuning\n)/, "\\1  config.concurrency = #{options[:concurrency]}\n")
        end
      end

      def update_max_deliver_setting(content)
        content.gsub(/config\.max_deliver\s*=\s*\d+/, "config.max_deliver = #{options[:max_deliver]}")
      end

      def update_ack_wait_setting(content)
        content.gsub(/config\.ack_wait\s*=\s*['"][^'"]+['"]/, "config.ack_wait = '#{options[:ack_wait]}'")
      end

      # Template helper methods
      def use_outbox?
        options[:outbox]
      end

      def use_inbox?
        options[:inbox]
      end

      def concurrency_value
        options[:concurrency] || 5
      end

      def max_deliver_value
        options[:max_deliver] || 5
      end

      def ack_wait_value
        options[:ack_wait] || '30s'
      end

      def app_name
        Rails.application.class.module_parent_name.underscore rescue 'app'
      end

      def rails_env
        Rails.env rescue 'development'
      end
    end
  end
end
