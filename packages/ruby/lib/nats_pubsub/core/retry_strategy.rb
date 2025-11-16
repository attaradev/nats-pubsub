# frozen_string_literal: true

require 'nats/io/client'
require_relative 'logging'

module NatsPubsub
  # Handles retry logic with exponential backoff for operations.
  # Extracted from Publisher to follow Single Responsibility Principle.
  class RetryStrategy
    DEFAULT_RETRIES = 3

    # Build list of retriable errors dynamically to handle different NATS versions
    RETRIABLE_ERRORS = begin
      errors = [NATS::IO::Timeout, NATS::IO::Error]
      errors << NATS::IO::NoServersError if defined?(NATS::IO::NoServersError)
      errors << NATS::IO::StaleConnectionError if defined?(NATS::IO::StaleConnectionError)
      errors << NATS::IO::SocketTimeoutError if defined?(NATS::IO::SocketTimeoutError)
      errors.freeze
    end

    # Execute a block with retry logic
    #
    # @param retries [Integer] Number of retry attempts
    # @param operation_name [String] Name of the operation for logging
    # @yield Block to execute with retries
    # @return [Object] Result of the block
    # @raise [StandardError] If all retries are exhausted
    def self.execute(retries: DEFAULT_RETRIES, operation_name: 'operation', &block)
      new(retries: retries, operation_name: operation_name).execute(&block)
    end

    def initialize(retries: DEFAULT_RETRIES, operation_name: 'operation')
      @retries = retries
      @operation_name = operation_name
    end

    def execute
      attempt = 0
      begin
        yield
      rescue *RETRIABLE_ERRORS => e
        attempt += 1
        if attempt <= @retries
          backoff_time = calculate_backoff(attempt)
          Logging.warn(
            "#{@operation_name} failed (attempt #{attempt}/#{@retries}): #{e.class} #{e.message}. " \
            "Retrying in #{backoff_time}s...",
            tag: 'NatsPubsub::RetryStrategy'
          )
          sleep backoff_time
          retry
        end
        Logging.error(
          "#{@operation_name} failed after #{@retries} retries: #{e.class} #{e.message}",
          tag: 'NatsPubsub::RetryStrategy'
        )
        raise
      end
    end

    private

    # Calculate exponential backoff time
    # @param attempt [Integer] Current attempt number
    # @return [Float] Sleep duration in seconds
    def calculate_backoff(attempt)
      # Exponential backoff: 0.1s, 0.2s, 0.4s, 0.8s, etc.
      [0.1 * (2**(attempt - 1)), 5.0].min # Cap at 5 seconds
    end
  end
end
