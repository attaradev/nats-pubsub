# frozen_string_literal: true

require 'oj'

module NatsPubsub
  # Shared behavior for ActiveRecord-based event models (Inbox/Outbox)
  # Provides safe column checking, common validations, and payload handling
  module EventModel
    def self.included(base)
      base.extend(ClassMethods)
      base.include(InstanceMethods)
    end

    module ClassMethods
      # Safe column presence check that never boots a connection during class load.
      # rubocop:disable Naming/PredicateNames
      def has_column?(name)
        return false unless ar_connected?

        connection.schema_cache.columns_hash(table_name).key?(name.to_s)
      rescue ActiveRecord::ConnectionNotEstablished, ActiveRecord::NoDatabaseError
        false
      end
      # rubocop:enable Naming/PredicateNames

      def ar_connected?
        ActiveRecord::Base.connected? && connection_pool.active_connection?
      rescue StandardError
        false
      end
    end

    module InstanceMethods
      # Parse and return payload as a Hash
      # Handles String (JSON), Hash, and objects with as_json
      def payload_hash
        v = self[:payload]
        case v
        when String
          begin
            Oj.load(v, mode: :strict)
          rescue Oj::Error
            {}
          end
        when Hash then v
        else
          v.respond_to?(:as_json) ? v.as_json : {}
        end
      end
    end

    # Create a shim class when ActiveRecord is not available
    # @param class_name [String] Name of the class (e.g., 'InboxEvent')
    # @param feature_name [String] Feature name for error message (e.g., 'Inbox')
    def self.create_shim(class_name, feature_name)
      Class.new do
        class << self
          define_method(:method_missing) do |method_name, *_args, &_block|
            raise(
              "#{feature_name} requires ActiveRecord (tried to call ##{method_name}). " \
              "Enable `use_#{feature_name.downcase}` only in apps with ActiveRecord, or add " \
              '`gem "activerecord"` to your Gemfile.'
            )
          end

          def respond_to_missing?(_method_name, _include_private = false)
            false
          end
        end
      end
    end
  end
end
