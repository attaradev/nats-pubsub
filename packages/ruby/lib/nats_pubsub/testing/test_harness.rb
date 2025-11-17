# frozen_string_literal: true

module NatsPubsub
  module Testing
    # TestHarness provides comprehensive testing utilities for NatsPubsub
    #
    # Features:
    # - Message capture and inspection
    # - Inline/synchronous processing for deterministic tests
    # - DLQ message tracking
    # - Subscriber call tracking
    # - Error simulation
    #
    # @example Using in RSpec
    #   RSpec.describe OrderProcessor do
    #     let(:harness) { NatsPubsub::Testing::TestHarness.new }
    #
    #     before { harness.setup }
    #     after { harness.cleanup }
    #
    #     it 'processes orders' do
    #       harness.publish('order.placed', { id: '123' })
    #       expect(harness.received('order.placed').size).to eq(1)
    #       expect(harness.subscriber_called?(OrderSubscriber)).to be true
    #     end
    #   end
    #
    class TestHarness
      attr_reader :messages, :dlq_messages, :subscriber_calls, :error_simulations

      # Initialize a new test harness
      #
      # @param subscribers [Array<Class>] Subscriber classes to register
      # @param inline_mode [Boolean] Process messages synchronously
      def initialize(subscribers: [], inline_mode: true)
        @subscribers = subscribers
        @inline_mode = inline_mode
        @messages = []
        @dlq_messages = []
        @subscriber_calls = Hash.new(0)
        @error_simulations = {}
      end

      # Setup the test harness
      #
      # @return [void]
      def setup
        # Enable fake mode
        NatsPubsub.fake!

        # Register subscribers
        @subscribers.each do |subscriber_class|
          register_subscriber(subscriber_class)
        end
      end

      # Cleanup after tests
      #
      # @return [void]
      def cleanup
        clear
        NatsPubsub.unfake!
      end

      # Register a subscriber for testing
      #
      # @param subscriber_class [Class] Subscriber class
      # @return [void]
      def register_subscriber(subscriber_class)
        subscriber = subscriber_class.new

        # Wrap subscriber to track calls
        original_call = subscriber.method(:call) if subscriber.respond_to?(:call)
        original_handle = subscriber.method(:handle) if subscriber.respond_to?(:handle)

        if original_call
          subscriber.define_singleton_method(:call) do |message, metadata|
            TestHarness.track_call(subscriber_class, @subscriber_calls)
            TestHarness.check_error_simulation(subscriber_class, @error_simulations)
            original_call.call(message, metadata)
          end
        end

        if original_handle
          subscriber.define_singleton_method(:handle) do |message, context|
            TestHarness.track_call(subscriber_class, @subscriber_calls)
            TestHarness.check_error_simulation(subscriber_class, @error_simulations)
            original_handle.call(message, context)
          end
        end

        NatsPubsub.register_subscriber(subscriber)
      end

      # Publish a message for testing
      #
      # @param topic [String] Topic to publish to
      # @param message [Hash] Message payload
      # @param options [Hash] Publish options
      # @return [void]
      def publish(topic, message, **options)
        # Capture message
        @messages << {
          topic: topic,
          message: message,
          options: options,
          timestamp: Time.now
        }

        # Actually publish
        NatsPubsub.publish(topic: topic, message: message, **options)
      end

      # Get all messages received on a topic
      #
      # @param topic [String] Topic to filter by
      # @return [Array<Hash>] Array of captured messages
      def received(topic)
        @messages.select { |m| m[:topic] == topic }
      end

      # Get the last message received on a topic
      #
      # @param topic [String] Topic to filter by
      # @return [Hash, nil] Last captured message or nil
      def last_message(topic)
        received(topic).last&.dig(:message)
      end

      # Check if a subscriber was called
      #
      # @param subscriber_class [Class] Subscriber class
      # @return [Boolean] True if subscriber was called
      def subscriber_called?(subscriber_class)
        @subscriber_calls[subscriber_class].positive?
      end

      # Get the number of times a subscriber was called
      #
      # @param subscriber_class [Class] Subscriber class
      # @return [Integer] Number of calls
      def subscriber_call_count(subscriber_class)
        @subscriber_calls[subscriber_class]
      end

      # Get all DLQ messages
      #
      # @return [Array<Hash>] Array of captured DLQ messages
      def dlq_messages
        @dlq_messages
      end

      # Get the last DLQ message
      #
      # @return [Hash, nil] Last DLQ message or nil
      def last_dlq_message
        @dlq_messages.last
      end

      # Simulate an error for a subscriber
      #
      # @param subscriber_class [Class] Subscriber class
      # @param error [Exception] Error to raise
      # @return [void]
      def simulate_error(subscriber_class, error)
        @error_simulations[subscriber_class] = error
      end

      # Clear simulated error for a subscriber
      #
      # @param subscriber_class [Class] Subscriber class
      # @return [void]
      def clear_simulated_error(subscriber_class)
        @error_simulations.delete(subscriber_class)
      end

      # Clear all captured data
      #
      # @return [void]
      def clear
        @messages.clear
        @dlq_messages.clear
        @subscriber_calls.clear
        @error_simulations.clear
      end

      # Wait for a condition to be true
      #
      # @param timeout [Float] Timeout in seconds
      # @param interval [Float] Polling interval in seconds
      # @yield Block that returns true when condition is met
      # @return [void]
      # @raise [Timeout::Error] If condition not met within timeout
      def wait_for(timeout: 5.0, interval: 0.1)
        start_time = Time.now

        loop do
          return if yield

          raise Timeout::Error, "Condition not met within #{timeout}s" if Time.now - start_time > timeout

          sleep interval
        end
      end

      # Wait for a subscriber to be called
      #
      # @param subscriber_class [Class] Subscriber class
      # @param timeout [Float] Timeout in seconds
      # @return [void]
      # @raise [Timeout::Error] If not called within timeout
      def wait_for_subscriber(subscriber_class, timeout: 5.0)
        wait_for(timeout: timeout) { subscriber_called?(subscriber_class) }
      end

      # Wait for messages on a topic
      #
      # @param topic [String] Topic to wait for
      # @param count [Integer] Expected number of messages
      # @param timeout [Float] Timeout in seconds
      # @return [void]
      # @raise [Timeout::Error] If messages not received within timeout
      def wait_for_messages(topic, count: 1, timeout: 5.0)
        wait_for(timeout: timeout) { received(topic).size >= count }
      end

      # Track a subscriber call
      #
      # @param subscriber_class [Class] Subscriber class
      # @param calls_hash [Hash] Subscriber calls hash
      # @return [void]
      # @api private
      def self.track_call(subscriber_class, calls_hash)
        calls_hash[subscriber_class] += 1
      end

      # Check for error simulation
      #
      # @param subscriber_class [Class] Subscriber class
      # @param simulations_hash [Hash] Error simulations hash
      # @return [void]
      # @raise [Exception] If error is simulated
      # @api private
      def self.check_error_simulation(subscriber_class, simulations_hash)
        error = simulations_hash[subscriber_class]
        raise error if error
      end
    end
  end
end
