# frozen_string_literal: true

module NatsPubsub
  # Immutable value object representing the result of a publish operation.
  # Provides structured feedback instead of boolean returns, improving debuggability.
  #
  # @example Successful publish
  #   result = publisher.publish_to_topic('notifications', { text: 'Hello' })
  #   if result.success?
  #     puts "Published with event_id: #{result.event_id}"
  #   end
  #
  # @example Failed publish
  #   result = publisher.publish_to_topic('invalid', { })
  #   unless result.success?
  #     puts "Failed: #{result.reason} - #{result.details}"
  #   end
  #
  # @attr_reader success [Boolean] Whether publish succeeded
  # @attr_reader event_id [String, nil] Event ID if successful
  # @attr_reader subject [String, nil] NATS subject published to
  # @attr_reader reason [Symbol, nil] Failure reason if unsuccessful
  # @attr_reader details [String, nil] Detailed error message if unsuccessful
  # @attr_reader error [Exception, nil] Original exception if available
  class PublishResult
    attr_reader :success, :event_id, :subject, :reason, :details, :error

    # Create a successful publish result
    #
    # @param event_id [String] Event identifier
    # @param subject [String] NATS subject
    # @return [PublishResult] Success result
    def self.success(event_id:, subject:)
      new(success: true, event_id: event_id, subject: subject)
    end

    # Create a failed publish result
    #
    # @param reason [Symbol] Failure reason (:validation_error, :io_error, :timeout, etc.)
    # @param details [String] Detailed error message
    # @param subject [String, nil] NATS subject if known
    # @param error [Exception, nil] Original exception
    # @return [PublishResult] Failure result
    def self.failure(reason:, details:, subject: nil, error: nil)
      new(success: false, reason: reason, details: details, subject: subject, error: error)
    end

    # Initialize a PublishResult
    #
    # @param success [Boolean] Success flag
    # @param event_id [String, nil] Event ID
    # @param subject [String, nil] NATS subject
    # @param reason [Symbol, nil] Failure reason
    # @param details [String, nil] Error details
    # @param error [Exception, nil] Original exception
    def initialize(success:, event_id: nil, subject: nil, reason: nil, details: nil, error: nil)
      @success = success
      @event_id = event_id
      @subject = subject
      @reason = reason
      @details = details
      @error = error
      freeze
    end

    # Check if publish was successful
    #
    # @return [Boolean] True if successful
    def success?
      @success
    end

    # Check if publish failed
    #
    # @return [Boolean] True if failed
    def failure?
      !@success
    end

    # Check if failure was due to validation error
    #
    # @return [Boolean] True if validation error
    def validation_error?
      @reason == :validation_error
    end

    # Check if failure was due to IO/network error
    #
    # @return [Boolean] True if IO error
    def io_error?
      @reason == :io_error
    end

    # Check if failure was due to timeout
    #
    # @return [Boolean] True if timeout
    def timeout?
      @reason == :timeout
    end

    # Get error message (for backward compatibility)
    #
    # @return [String, nil] Error message or nil if successful
    def error_message
      @details
    end

    # Convert to hash
    #
    # @return [Hash] Result as hash
    def to_h
      {
        success: @success,
        event_id: @event_id,
        subject: @subject,
        reason: @reason,
        details: @details
      }.compact
    end

    # String representation
    #
    # @return [String] Result description
    def to_s
      if success?
        "PublishResult(success, event_id=#{@event_id}, subject=#{@subject})"
      else
        "PublishResult(failure, reason=#{@reason}, details=#{@details})"
      end
    end

    # Inspect representation
    #
    # @return [String] Detailed inspection
    def inspect
      "#<PublishResult #{success? ? 'success' : 'failure'} #{to_h.inspect}>"
    end

    # For backward compatibility - acts like boolean in conditionals
    #
    # @return [Boolean] Success status
    def to_bool
      @success
    end

    # Allow result to be used in boolean contexts
    alias to_boolean to_bool
  end
end
