# frozen_string_literal: true

module NatsPubsub
  module Subscribers
    # Graceful shutdown manager for subscribers
    # Handles signal trapping and ensures clean shutdown with message drain
    class GracefulShutdown
      DEFAULT_TIMEOUT = 30 # seconds

      attr_reader :worker, :timeout, :logger

      # Initialize graceful shutdown manager
      #
      # @param worker [Worker] Worker instance to manage
      # @param timeout [Integer] Shutdown timeout in seconds
      # @param logger [Logger] Logger instance
      def initialize(worker, timeout: DEFAULT_TIMEOUT, logger: nil)
        @worker = worker
        @timeout = timeout
        @logger = logger || NatsPubsub.config.logger
        @shutting_down = false
        @shutdown_started_at = nil
      end

      # Start graceful shutdown process
      #
      # @return [Boolean] True if shutdown completed gracefully within timeout
      def shutdown
        return false if @shutting_down

        @shutting_down = true
        @shutdown_started_at = Time.now

        logger&.info('Starting graceful shutdown', timeout: timeout)

        # Stop accepting new messages
        stop_accepting_messages

        # Wait for in-flight messages
        completed = wait_for_completion

        # Force terminate if needed
        force_terminate unless completed

        # Close connections
        close_connections

        elapsed = (Time.now - @shutdown_started_at).round(1)
        logger&.info('Graceful shutdown complete', elapsed: elapsed, graceful: completed)

        completed
      end

      # Check if shutdown is in progress
      #
      # @return [Boolean] True if shutdown is in progress
      def shutting_down?
        @shutting_down
      end

      # Install signal handlers for graceful shutdown
      # Traps SIGTERM and SIGINT
      def install_signal_handlers
        %w[TERM INT].each do |signal|
          Signal.trap(signal) do
            logger&.info("Received SIG#{signal}, initiating shutdown")

            begin
              shutdown
              exit(0)
            rescue StandardError => e
              logger&.error('Shutdown failed', error: e.message)
              exit(1)
            end
          end
        end
      end

      private

      # Stop accepting new messages
      def stop_accepting_messages
        logger&.info('Stopping message acceptance')
        worker.pause! if worker.respond_to?(:pause!)
      end

      # Wait for in-flight messages to complete
      #
      # @return [Boolean] True if all messages completed within timeout
      def wait_for_completion
        deadline = Time.now + timeout

        loop do
          in_flight = worker.in_flight_count

          if in_flight.zero?
            logger&.info('All messages processed')
            return true
          end

          if Time.now >= deadline
            logger&.warn('Shutdown timeout reached',
                         in_flight: in_flight,
                         timeout: timeout)
            return false
          end

          logger&.debug('Waiting for messages',
                        in_flight: in_flight,
                        remaining: (deadline - Time.now).round(1))
          sleep 0.5
        end
      end

      # Force terminate remaining messages
      def force_terminate
        logger&.warn('Force terminating remaining messages')
        worker.force_stop! if worker.respond_to?(:force_stop!)
      end

      # Close connections
      def close_connections
        logger&.info('Closing connections')
        worker.close if worker.respond_to?(:close)
      end
    end
  end
end
