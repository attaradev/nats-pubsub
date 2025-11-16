# frozen_string_literal: true

module NatsPubsub
  # FluentBatch provides a modern, chainable API for batch publishing
  #
  # @example Basic usage
  #   result = NatsPubsub.batch do |b|
  #     b.add 'user.created', { id: 1, name: 'Alice' }
  #     b.add 'user.created', { id: 2, name: 'Bob' }
  #     b.add 'notification.sent', { user_id: 1 }
  #     b.with_options trace_id: 'batch-123'
  #   end.publish
  #
  #   puts "Published #{result.succeeded}/#{result.total} messages"
  #
  class FluentBatch
    # @!attribute [r] items
    #   @return [Array<Hash>] The batch items
    attr_reader :items

    # @!attribute [r] options
    #   @return [Hash] Shared options for all messages
    attr_reader :options

    # Initialize a new batch publisher
    #
    # @param publisher [Publisher] Optional publisher instance
    def initialize(publisher = nil)
      @publisher = publisher || NatsPubsub::Publisher.new
      @items = []
      @options = {}
    end

    # Add a message to the batch
    #
    # @param topic [String] Topic to publish to
    # @param message [Hash] Message payload
    # @return [self] For chaining
    #
    # @example
    #   batch.add('user.created', { id: 1, name: 'Alice' })
    def add(topic, message)
      @items << { topic: topic, message: message }
      self
    end

    # Set options for all messages in the batch
    #
    # @param options [Hash] Options to apply to all messages
    # @option options [String] :trace_id Distributed tracing ID
    # @option options [String] :correlation_id Request correlation ID
    # @option options [String] :event_id Event ID
    # @option options [Time] :occurred_at Event timestamp
    # @return [self] For chaining
    #
    # @example
    #   batch.with_options(trace_id: 'trace-123', correlation_id: 'req-456')
    def with_options(**options)
      @options.merge!(options)
      self
    end

    # Publish all messages in the batch
    #
    # Messages are published in parallel for performance.
    #
    # @return [BatchResult] Result with success/failure details
    #
    # @example
    #   result = batch.publish
    #   puts "Succeeded: #{result.succeeded}, Failed: #{result.failed}"
    def publish
      start_time = Time.now

      return empty_result if @items.empty?

      logger&.debug "Publishing batch of #{@items.size} messages"

      # Publish all items in parallel using threads
      results = publish_parallel

      succeeded = results.count { |r| r[:success] }
      failed = results.count { |r| !r[:success] }

      duration = ((Time.now - start_time) * 1000).round(2)

      logger&.info "Batch publish completed: #{succeeded}/#{@items.size} succeeded, #{failed} failed (#{duration}ms)"

      BatchResult.new(
        total: @items.size,
        succeeded: succeeded,
        failed: failed,
        results: results,
        duration: duration
      )
    end

    # Clear all items from the batch
    #
    # @return [self] For chaining
    def clear
      @items = []
      self
    end

    # Get the number of items in the batch
    #
    # @return [Integer] Number of items
    def size
      @items.size
    end

    alias count size
    alias length size

    private

    # Publish items in parallel using threads
    #
    # @return [Array<Hash>] Array of result hashes
    def publish_parallel
      threads = @items.map.with_index do |item, index|
        Thread.new do
          publish_single_item(item, index)
        rescue StandardError => e
          {
            topic: item[:topic],
            success: false,
            error: e.message,
            index: index
          }
        end
      end

      threads.map(&:value)
    end

    # Publish a single item
    #
    # @param item [Hash] Item to publish
    # @param index [Integer] Index in the batch
    # @return [Hash] Result hash
    def publish_single_item(item, index)
      @publisher.publish(
        topic: item[:topic],
        message: item[:message],
        **@options
      )

      {
        topic: item[:topic],
        success: true,
        event_id: @options[:event_id],
        index: index
      }
    rescue StandardError => e
      logger&.error "Batch publish failed for topic #{item[:topic]}: #{e.message}"

      {
        topic: item[:topic],
        success: false,
        error: e.message,
        index: index
      }
    end

    # Get logger from config
    #
    # @return [Logger, nil] Logger instance
    def logger
      NatsPubsub.config.logger
    end

    # Create empty result
    #
    # @return [BatchResult] Empty result
    def empty_result
      BatchResult.new(
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
        duration: 0.0
      )
    end
  end

  # Result of a batch publish operation
  #
  # @!attribute [r] total
  #   @return [Integer] Total number of messages
  # @!attribute [r] succeeded
  #   @return [Integer] Number of successful messages
  # @!attribute [r] failed
  #   @return [Integer] Number of failed messages
  # @!attribute [r] results
  #   @return [Array<Hash>] Detailed results for each message
  # @!attribute [r] duration
  #   @return [Float] Duration in milliseconds
  #
  class BatchResult
    attr_reader :total, :succeeded, :failed, :results, :duration

    # Initialize a new batch result
    #
    # @param total [Integer] Total number of messages
    # @param succeeded [Integer] Number of successful messages
    # @param failed [Integer] Number of failed messages
    # @param results [Array<Hash>] Detailed results
    # @param duration [Float] Duration in milliseconds
    def initialize(total:, succeeded:, failed:, results:, duration:)
      @total = total
      @succeeded = succeeded
      @failed = failed
      @results = results
      @duration = duration
    end

    # Check if all messages succeeded
    #
    # @return [Boolean] True if all succeeded
    def success?
      failed.zero?
    end

    # Check if any messages failed
    #
    # @return [Boolean] True if any failed
    def failure?
      failed.positive?
    end

    # Get failed results
    #
    # @return [Array<Hash>] Failed results
    def failures
      results.reject { |r| r[:success] }
    end

    # Get successful results
    #
    # @return [Array<Hash>] Successful results
    def successes
      results.select { |r| r[:success] }
    end

    # Convert to hash
    #
    # @return [Hash] Hash representation
    def to_h
      {
        total: total,
        succeeded: succeeded,
        failed: failed,
        results: results,
        duration: duration
      }
    end

    alias to_hash to_h
  end
end
