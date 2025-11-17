# frozen_string_literal: true

module NatsPubsub
  module Subscribers
    # Immutable value object representing error context for unified error handling.
    # Provides a consistent interface for capturing and logging error information
    # throughout the message processing pipeline.
    #
    # This class follows the Value Object pattern and encapsulates all error-related
    # metadata, making error handling more consistent and reducing duplication.
    #
    # @example Creating error context from an exception
    #   begin
    #     process_message(msg)
    #   rescue StandardError => e
    #     error_ctx = ErrorContext.from_exception(e, reason: 'processing_failed')
    #     puts error_ctx.to_log_string
    #   end
    #
    # @attr_reader error_class [String] Name of the error class
    # @attr_reader error_message [String] Error message
    # @attr_reader reason [String] High-level reason for the error (e.g., 'malformed_json', 'max_deliver_exceeded')
    # @attr_reader backtrace [Array<String>, nil] Optional error backtrace
    class ErrorContext
      attr_reader :error_class, :error_message, :reason, :backtrace

      # Initialize a new ErrorContext
      #
      # @param error_class [String] Name of the error class
      # @param error_message [String] Error message
      # @param reason [String] High-level reason for the error
      # @param backtrace [Array<String>, nil] Optional error backtrace
      def initialize(error_class:, error_message:, reason:, backtrace: nil)
        @error_class = error_class.to_s
        @error_message = error_message.to_s
        @reason = reason.to_s
        @backtrace = backtrace
        freeze # Make immutable
      end

      # Build ErrorContext from an exception
      #
      # Extracts error information from a Ruby exception object and creates
      # a structured error context with optional reason and backtrace.
      #
      # @param exception [Exception] Ruby exception object
      # @param reason [String] High-level reason for the error
      # @param include_backtrace [Boolean] Whether to include the backtrace (default: false)
      # @return [ErrorContext] Immutable error context
      def self.from_exception(exception, reason:, include_backtrace: false)
        new(
          error_class: exception.class.name,
          error_message: exception.message,
          reason: reason,
          backtrace: include_backtrace ? exception.backtrace : nil
        )
      end

      # Build ErrorContext from keyword arguments
      #
      # Convenience constructor for cases where you have structured error data
      # but not an exception object.
      #
      # @param error_class [String] Name of the error class
      # @param error_message [String] Error message
      # @param reason [String] High-level reason for the error
      # @return [ErrorContext] Immutable error context
      def self.build(error_class:, error_message:, reason:)
        new(
          error_class: error_class,
          error_message: error_message,
          reason: reason
        )
      end

      # Format error for logging
      #
      # Creates a concise string representation suitable for log messages,
      # following the pattern: "ErrorClass: message"
      #
      # @return [String] Formatted error string
      def to_log_string
        "#{error_class}: #{error_message}"
      end

      # Hash representation for DLQ publishing
      #
      # Returns error information as a hash suitable for inclusion
      # in DLQ message envelopes.
      #
      # @return [Hash] Error context as hash
      def to_dlq_hash
        {
          error_class: error_class,
          error_message: error_message,
          reason: reason
        }
      end

      # Complete hash representation
      #
      # @return [Hash] Full context including optional backtrace
      def to_h
        hash = {
          error_class: error_class,
          error_message: error_message,
          reason: reason
        }
        hash[:backtrace] = backtrace if backtrace
        hash
      end

      # String representation for debugging
      #
      # @return [String] Human-readable error context
      def to_s
        "ErrorContext(reason=#{reason}, error=#{error_class}: #{error_message})"
      end

      # Check if error is of a specific type
      #
      # @param error_classes [Array<Class>] Error classes to check against
      # @return [Boolean] True if error matches any of the classes
      def is_a?(*error_classes)
        error_classes.any? { |klass| error_class == klass.name }
      end

      # Check if error matches a specific reason
      #
      # @param target_reason [String, Symbol] Reason to check
      # @return [Boolean] True if reason matches
      def reason?(target_reason)
        reason == target_reason.to_s
      end
    end
  end
end
