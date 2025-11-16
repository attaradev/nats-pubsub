# frozen_string_literal: true

require 'rails/generators'
require 'rails/generators/active_record'

module NatsPubsub
  module Generators
    # Migrations generator that creates Inbox and Outbox event tables
    #
    # Usage:
    #   rails generate nats_pubsub:migrations
    #
    # This will create:
    #   db/migrate/[timestamp]_create_nats_pubsub_outbox.rb
    #   db/migrate/[timestamp]_create_nats_pubsub_inbox.rb
    #
    # The outbox table stores events to be published to NATS:
    #   - Implements transactional outbox pattern
    #   - Tracks publishing status and attempts
    #   - Provides at-least-once delivery guarantee
    #
    # The inbox table stores received events from NATS:
    #   - Prevents duplicate processing
    #   - Tracks processing status
    #   - Supports idempotency via event_id
    #
    # Example:
    #   rails generate nats_pubsub:migrations
    #   rake db:migrate
    class MigrationsGenerator < Rails::Generators::Base
      include Rails::Generators::Migration

      source_root File.expand_path('templates', __dir__)
      desc 'Creates Inbox/Outbox migrations for NatsPubsub'

      def create_outbox_migration
        name = 'create_nats_pubsub_outbox'
        return say_status :skip, "migration #{name} already exists", :yellow if migration_exists?('db/migrate', name)

        migration_template 'create_nats_pubsub_outbox.rb.erb', "db/migrate/#{name}.rb"
        say_status :created, "db/migrate/#{name}.rb", :green
      rescue StandardError => e
        say_status :error, "Failed to create outbox migration: #{e.message}", :red
        raise
      end

      def create_inbox_migration
        name = 'create_nats_pubsub_inbox'
        return say_status :skip, "migration #{name} already exists", :yellow if migration_exists?('db/migrate', name)

        migration_template 'create_nats_pubsub_inbox.rb.erb', "db/migrate/#{name}.rb"
        say_status :created, "db/migrate/#{name}.rb", :green
      rescue StandardError => e
        say_status :error, "Failed to create inbox migration: #{e.message}", :red
        raise
      end

      # -- Rails::Generators::Migration plumbing --
      def self.next_migration_number(dirname)
        if ActiveRecord::Base.timestamped_migrations
          Time.now.utc.strftime('%Y%m%d%H%M%S')
        else
          format('%.3d', current_migration_number(dirname) + 1)
        end
      end

      private

      def migration_exists?(dirname, file_name)
        Dir.glob(File.join(dirname, '[0-9]*_*.rb')).grep(/\d+_#{file_name}\.rb$/).any?
      end
    end
  end
end
