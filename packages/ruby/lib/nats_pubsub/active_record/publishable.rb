# frozen_string_literal: true

module NatsPubsub
  module ActiveRecord
    # Include this concern in your ActiveRecord models to automatically publish events
    #
    # @example Basic usage
    #   class User < ApplicationRecord
    #     include NatsPubsub::ActiveRecord::Publishable
    #
    #     publishes_events domain: 'users', resource: 'user'
    #   end
    #
    # @example Advanced usage with conditional publishing
    #   class Order < ApplicationRecord
    #     include NatsPubsub::ActiveRecord::Publishable
    #
    #     publishes_events domain: 'orders',
    #                      resource: 'order',
    #                      on_create: true,
    #                      on_update: -> { status_changed? },
    #                      on_destroy: false,
    #                      if: :should_publish?,
    #                      except: [:internal_notes]
    #
    #     def should_publish?
    #       !imported?
    #     end
    #   end
    module Publishable
      extend ActiveSupport::Concern

      # Default sensitive attributes to exclude from events
      DEFAULT_SENSITIVE_ATTRIBUTES = %i[
        password password_digest encrypted_password
        reset_password_token reset_password_sent_at
        remember_created_at confirmation_token
        unlock_token otp_secret_key otp_backup_codes
        api_key api_secret access_token refresh_token
        ssn credit_card_number bank_account
      ].freeze

      included do
        class_attribute :publish_config, default: {}
        class_attribute :sensitive_attributes, default: DEFAULT_SENSITIVE_ATTRIBUTES
      end

      class_methods do
        # Configure event publishing for this model
        #
        # @param domain [String] Domain for pubsub subject (default: pluralized model name)
        # @param resource [String] Resource type (default: underscored model name)
        # @param options [Hash] Additional options
        # @option options [Boolean, Proc] :on_create Publish created events (default: true)
        # @option options [Boolean, Proc] :on_update Publish updated events (default: true)
        # @option options [Boolean, Proc] :on_destroy Publish deleted events (default: true)
        # @option options [Symbol, Proc] :if Conditional publishing
        # @option options [Symbol, Proc] :unless Conditional publishing (inverted)
        # @option options [Array<Symbol>] :only Whitelist attributes to publish
        # @option options [Array<Symbol>] :except Blacklist attributes (in addition to sensitive)
        # @option options [Symbol] :error_handler Custom error handler method name
        def publishes_events(domain: nil, resource: nil, **options)
          self.publish_config = {
            domain: domain || name.underscore.pluralize,
            resource: resource || name.underscore,
            on_create: options.fetch(:on_create, true),
            on_update: options.fetch(:on_update, true),
            on_destroy: options.fetch(:on_destroy, true),
            if: options[:if],
            unless: options[:unless],
            only: options[:only],
            except: options[:except],
            error_handler: options[:error_handler] || :handle_publish_error
          }

          setup_callbacks
        end

        # Add custom sensitive attributes
        #
        # @param attributes [Array<Symbol>] Attributes to exclude from publishing
        def exclude_from_publishing(*attributes)
          self.sensitive_attributes = sensitive_attributes + attributes.flatten
        end

        private

        def setup_callbacks
          setup_create_callback if publish_config[:on_create]
          setup_update_callback if publish_config[:on_update]
          setup_destroy_callback if publish_config[:on_destroy]
        end

        def setup_create_callback
          condition = publish_config[:on_create]
          after_commit :publish_created_event, on: :create,
                       if: -> { should_publish_event?(:on_create, condition) }
        end

        def setup_update_callback
          condition = publish_config[:on_update]
          after_commit :publish_updated_event, on: :update,
                       if: -> { saved_changes? && should_publish_event?(:on_update, condition) }
        end

        def setup_destroy_callback
          condition = publish_config[:on_destroy]
          after_commit :publish_deleted_event, on: :destroy,
                       if: -> { should_publish_event?(:on_destroy, condition) }
        end
      end

      private

      def publish_created_event
        publish_event('created')
      end

      def publish_updated_event
        publish_event('updated', changes: previous_changes.keys)
      end

      def publish_deleted_event
        publish_event('deleted')
      end

      def publish_event(action, extra = {})
        config = self.class.publish_config
        domain = config[:domain]
        resource = config[:resource]

        payload = publishable_attributes.merge(extra)

        NatsPubsub.publish(domain, resource, action, **payload)
      rescue StandardError => e
        # Call custom error handler if defined
        error_handler = config[:error_handler]
        if error_handler && respond_to?(error_handler, true)
          send(error_handler, e, action, payload)
        else
          handle_publish_error(e, action, payload)
        end
      end

      def handle_publish_error(error, action, payload)
        # Default error handler - log but don't fail
        return unless defined?(Rails) && Rails.logger

        Rails.logger.error(
          "[NatsPubsub::Publishable] Failed to publish #{self.class.name}.#{action}: #{error.message}"
        )
      end

      def should_publish_event?(event_type, condition)
        # Check global if/unless conditions
        config = self.class.publish_config
        return false if config[:unless] && evaluate_condition(config[:unless])
        return false if config[:if] && !evaluate_condition(config[:if])

        # Check event-specific condition
        return true if condition == true
        return false if condition == false

        evaluate_condition(condition) if condition
      end

      def evaluate_condition(condition)
        case condition
        when Symbol
          send(condition)
        when Proc
          instance_eval(&condition)
        else
          !!condition
        end
      end

      def publishable_attributes
        attrs = attributes.symbolize_keys
        config = self.class.publish_config

        # Handle :only option (whitelist)
        attrs = attrs.slice(*config[:only]) if config[:only]

        # Exclude sensitive and custom blacklist
        excluded = self.class.sensitive_attributes
        excluded += config[:except] if config[:except]
        attrs.except(*excluded)
      end
    end
  end
end
