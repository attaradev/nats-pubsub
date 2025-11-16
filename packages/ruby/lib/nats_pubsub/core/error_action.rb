# frozen_string_literal: true

module NatsPubsub
  module Core
    # Error action constants for fine-grained error handling control
    #
    # @example Using in a subscriber
    #   class PaymentSubscriber < NatsPubsub::Subscriber
    #     subscribe_to 'payment.process'
    #
    #     def handle(message, context)
    #       process_payment(message)
    #     end
    #
    #     def on_error(error, message, context)
    #       case error
    #       when ValidationError
    #         ErrorAction::DISCARD
    #       when NetworkError, Timeout::Error
    #         ErrorAction::RETRY
    #       else
    #         ErrorAction::DLQ
    #       end
    #     end
    #   end
    #
    module ErrorAction
      # Retry the message with backoff strategy
      RETRY = :retry

      # Acknowledge and discard the message (no retry)
      DISCARD = :discard

      # Send message to dead letter queue
      DLQ = :dlq

      # All valid actions
      ALL = [RETRY, DISCARD, DLQ].freeze

      # Check if action is valid
      #
      # @param action [Symbol] Action to validate
      # @return [Boolean] True if valid
      def self.valid?(action)
        ALL.include?(action)
      end

      # Get default action
      #
      # @return [Symbol] Default action (:retry)
      def self.default
        RETRY
      end
    end

    # Error context passed to error handlers
    #
    # @!attribute [r] error
    #   @return [Exception] The error that occurred
    # @!attribute [r] message
    #   @return [Hash] The message that failed
    # @!attribute [r] context
    #   @return [MessageContext] Message context
    # @!attribute [r] attempt_number
    #   @return [Integer] Current attempt number (1-based)
    # @!attribute [r] max_attempts
    #   @return [Integer] Maximum delivery attempts configured
    #
    class ErrorContext
      attr_reader :error, :message, :context, :attempt_number, :max_attempts

      # Initialize a new error context
      #
      # @param error [Exception] The error
      # @param message [Hash] The message
      # @param context [MessageContext] Message context
      # @param attempt_number [Integer] Attempt number
      # @param max_attempts [Integer] Max attempts
      def initialize(error:, message:, context:, attempt_number:, max_attempts:)
        @error = error
        @message = message
        @context = context
        @attempt_number = attempt_number
        @max_attempts = max_attempts

        freeze
      end

      # Check if this is the last attempt
      #
      # @return [Boolean] True if last attempt
      def last_attempt?
        attempt_number >= max_attempts
      end

      # Check if retries are exhausted
      #
      # @return [Boolean] True if exhausted
      def retries_exhausted?
        last_attempt?
      end

      # Get remaining attempts
      #
      # @return [Integer] Number of remaining attempts
      def remaining_attempts
        [max_attempts - attempt_number, 0].max
      end

      # Convert to hash
      #
      # @return [Hash] Hash representation
      def to_h
        {
          error: error.class.name,
          error_message: error.message,
          message: message,
          context: context.to_h,
          attempt_number: attempt_number,
          max_attempts: max_attempts,
          last_attempt: last_attempt?,
          remaining_attempts: remaining_attempts
        }
      end

      alias to_hash to_h
    end

    # Retry strategy configuration
    #
    # @!attribute [r] max_attempts
    #   @return [Integer] Maximum number of retry attempts
    # @!attribute [r] backoff
    #   @return [Symbol] Backoff strategy (:exponential, :linear, :fixed)
    # @!attribute [r] initial_delay
    #   @return [Integer] Initial delay in milliseconds
    # @!attribute [r] max_delay
    #   @return [Integer] Maximum delay in milliseconds
    # @!attribute [r] multiplier
    #   @return [Float] Multiplier for exponential backoff
    #
    class RetryStrategy
      attr_reader :max_attempts, :backoff, :initial_delay, :max_delay, :multiplier

      # Default values
      DEFAULT_MAX_ATTEMPTS = 5
      DEFAULT_BACKOFF = :exponential
      DEFAULT_INITIAL_DELAY = 1_000 # 1 second
      DEFAULT_MAX_DELAY = 60_000 # 60 seconds
      DEFAULT_MULTIPLIER = 2.0

      # Initialize a new retry strategy
      #
      # @param max_attempts [Integer] Maximum attempts
      # @param backoff [Symbol] Backoff strategy
      # @param initial_delay [Integer] Initial delay in ms
      # @param max_delay [Integer] Max delay in ms
      # @param multiplier [Float] Backoff multiplier
      def initialize(
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        backoff: DEFAULT_BACKOFF,
        initial_delay: DEFAULT_INITIAL_DELAY,
        max_delay: DEFAULT_MAX_DELAY,
        multiplier: DEFAULT_MULTIPLIER
      )
        @max_attempts = max_attempts
        @backoff = backoff
        @initial_delay = initial_delay
        @max_delay = max_delay
        @multiplier = multiplier

        validate!
        freeze
      end

      # Calculate delay for an attempt
      #
      # @param attempt [Integer] Attempt number (1-based)
      # @return [Integer] Delay in milliseconds
      def delay_for_attempt(attempt)
        delay = case backoff
                when :exponential
                  exponential_delay(attempt)
                when :linear
                  linear_delay(attempt)
                when :fixed
                  initial_delay
                else
                  initial_delay
                end

        [delay, max_delay].min
      end

      # Convert to hash
      #
      # @return [Hash] Hash representation
      def to_h
        {
          max_attempts: max_attempts,
          backoff: backoff,
          initial_delay: initial_delay,
          max_delay: max_delay,
          multiplier: multiplier
        }
      end

      alias to_hash to_h

      private

      # Calculate exponential delay
      #
      # @param attempt [Integer] Attempt number
      # @return [Integer] Delay in milliseconds
      def exponential_delay(attempt)
        (initial_delay * (multiplier**(attempt - 1))).to_i
      end

      # Calculate linear delay
      #
      # @param attempt [Integer] Attempt number
      # @return [Integer] Delay in milliseconds
      def linear_delay(attempt)
        initial_delay * attempt
      end

      # Validate configuration
      #
      # @raise [ArgumentError] If configuration is invalid
      def validate!
        raise ArgumentError, 'max_attempts must be positive' unless max_attempts.positive?
        raise ArgumentError, 'initial_delay must be positive' unless initial_delay.positive?
        raise ArgumentError, 'max_delay must be positive' unless max_delay.positive?
        raise ArgumentError, 'multiplier must be positive' unless multiplier.positive?

        valid_backoffs = %i[exponential linear fixed]
        return if valid_backoffs.include?(backoff)

        raise ArgumentError, "backoff must be one of: #{valid_backoffs.join(', ')}"
      end
    end

    # Circuit breaker configuration
    #
    # @!attribute [r] enabled
    #   @return [Boolean] Enable circuit breaker
    # @!attribute [r] threshold
    #   @return [Integer] Number of failures before opening
    # @!attribute [r] timeout
    #   @return [Integer] Time to keep circuit open in milliseconds
    # @!attribute [r] half_open_max_calls
    #   @return [Integer] Number of test calls in half-open state
    #
    class CircuitBreakerConfig
      attr_reader :enabled, :threshold, :timeout, :half_open_max_calls

      # Initialize circuit breaker config
      #
      # @param enabled [Boolean] Enable circuit breaker
      # @param threshold [Integer] Failure threshold
      # @param timeout [Integer] Timeout in milliseconds
      # @param half_open_max_calls [Integer] Max calls in half-open state
      def initialize(enabled: false, threshold: 5, timeout: 60_000, half_open_max_calls: 3)
        @enabled = enabled
        @threshold = threshold
        @timeout = timeout
        @half_open_max_calls = half_open_max_calls

        freeze
      end

      # Convert to hash
      #
      # @return [Hash] Hash representation
      def to_h
        {
          enabled: enabled,
          threshold: threshold,
          timeout: timeout,
          half_open_max_calls: half_open_max_calls
        }
      end

      alias to_hash to_h
    end
  end
end
