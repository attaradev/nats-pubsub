# frozen_string_literal: true

module NatsPubsub
  module ActiveRecord
    # Include this concern in your ActiveRecord models to automatically publish events
    #
    # Example:
    #   class User < ApplicationRecord
    #     include NatsPubsub::ActiveRecord::Publishable
    #
    #     publishes_events domain: 'users', resource: 'user'
    #   end
    module Publishable
      extend ActiveSupport::Concern

      class_methods do
        # Configure event publishing for this model
        #
        # @param domain [String] Domain for pubsub subject (default: pluralized model name)
        # @param resource [String] Resource type (default: underscored model name)
        # @param options [Hash] Additional options
        # @option options [Boolean] :on_create Publish created events (default: true)
        # @option options [Boolean] :on_update Publish updated events (default: true)
        # @option options [Boolean] :on_destroy Publish deleted events (default: true)
        def publishes_events(domain: nil, resource: nil, **options)
          @publish_domain = domain || name.underscore.pluralize
          @publish_resource = resource || name.underscore
          @publish_options = options

          after_create :publish_created_event if options.fetch(:on_create, true)
          after_update :publish_updated_event if options.fetch(:on_update, true)
          after_destroy :publish_deleted_event if options.fetch(:on_destroy, true)
        end

        attr_reader :publish_domain, :publish_resource, :publish_options
      end

      private

      def publish_created_event
        publish_event('created')
      end

      def publish_updated_event
        return unless saved_changes?

        publish_event('updated', changes: previous_changes.keys)
      end

      def publish_deleted_event
        publish_event('deleted')
      end

      def publish_event(action, extra = {})
        domain = self.class.publish_domain
        resource = self.class.publish_resource

        payload = publishable_attributes.merge(extra)

        NatsPubsub.publish(domain, resource, action, **payload)
      rescue StandardError => e
        # Don't fail the transaction if publishing fails
        logger.error("Failed to publish #{resource}.#{action}: #{e.message}")
      end

      def publishable_attributes
        attrs = attributes.symbolize_keys

        # Exclude sensitive fields by default
        attrs.except(:password_digest, :encrypted_password, :reset_password_token,
                     :reset_password_sent_at, :remember_created_at, :confirmation_token)
      end
    end
  end
end
