# frozen_string_literal: true

require_relative '../core/error_action'
require_relative '../core/constants'

module NatsPubsub
  module Subscribers
    # Enhanced error handler with ErrorAction support
    # Integrates per-subscriber error handling strategies
    class ErrorHandler
      attr_reader :subscriber, :config

      def initialize(subscriber, config: NatsPubsub.config)
        @subscriber = subscriber
        @config = config
      end

      # Handle an error from message processing
      #
      # @param error [Exception] The error that occurred
      # @param message [Hash] The message payload
      # @param context [MessageContext] Message metadata
      # @param attempt_number [Integer] Current delivery attempt
      # @return [Symbol] Error action to take (:retry, :discard, :dlq)
      def handle_error(error, message, context, attempt_number)
        error_context = build_error_context(error, message, context, attempt_number)

        # Try subscriber's custom error handler first
        action = if subscriber.respond_to?(:on_error)
                   call_subscriber_error_handler(error_context)
                 else
                   determine_default_action(error_context)
                 end

        # Validate and normalize action
        normalize_action(action, error_context)
      end

      private

      # Build error context object
      def build_error_context(error, message, context, attempt_number)
        Core::ErrorContext.new(
          error: error,
          message: message,
          context: context,
          attempt_number: attempt_number,
          max_attempts: config.max_deliver
        )
      end

      # Call subscriber's custom error handler
      def call_subscriber_error_handler(error_context)
        subscriber.on_error(error_context)
      rescue StandardError => e
        # If custom handler fails, log and use default
        config.logger&.error(
          "Subscriber error handler failed: #{e.class} - #{e.message}",
          subscriber: subscriber.class.name,
          error: e.class.name
        )
        determine_default_action(error_context)
      end

      # Determine default error action based on error type
      def determine_default_action(error_context)
        error = error_context.error

        # Malformed messages -> Discard immediately
        return Core::ErrorAction::DISCARD if malformed_error?(error)

        # Unrecoverable errors -> DLQ immediately
        return Core::ErrorAction::DLQ if unrecoverable_error?(error)

        # Last attempt -> DLQ
        return Core::ErrorAction::DLQ if error_context.last_attempt?

        # Default -> Retry with backoff
        Core::ErrorAction::RETRY
      end

      # Check if error indicates malformed message
      def malformed_error?(error)
        Constants::Errors::MALFORMED_ERRORS.any? do |error_name|
          error.class.name.include?(error_name)
        end
      end

      # Check if error is unrecoverable
      def unrecoverable_error?(error)
        Constants::Errors::UNRECOVERABLE_ERRORS.any? do |error_name|
          error.class.name.include?(error_name)
        end
      end

      # Normalize action to valid ErrorAction constant
      def normalize_action(action, error_context)
        return action if Core::ErrorAction.valid?(action)

        config.logger&.warn(
          "Invalid error action returned: #{action.inspect}, using default",
          subscriber: subscriber.class.name,
          valid_actions: Core::ErrorAction::ALL
        )

        determine_default_action(error_context)
      end
    end
  end
end
