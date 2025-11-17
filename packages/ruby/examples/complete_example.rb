# frozen_string_literal: true

# Complete Example - NatsPubsub v0.3 API
#
# Demonstrates all major features of the new API:
# - Configuration with presets
# - Topic-based messaging
# - Error handling with ErrorAction
# - Batch publishing
# - Testing with TestHarness

require 'nats_pubsub'
require 'securerandom'

# ============================================================================
# 1. CONFIGURATION
# ============================================================================

# Use presets for quick setup
NatsPubsub.configure do |config|
  NatsPubsub::Core::Presets.production(
    config,
    app_name: 'order-service',
    nats_urls: ENV.fetch('NATS_URLS', 'nats://localhost:4222').split(',')
  )
end

# Or customize manually
NatsPubsub.configure do |config|
  config.app_name = 'order-service'
  config.nats_urls = 'nats://localhost:4222'
  config.env = 'production'
  config.concurrency = 20
  config.max_deliver = 5
  config.ack_wait = 30_000
  config.use_dlq = true
  config.use_outbox = false
  config.use_inbox = false
end

# ============================================================================
# 2. SUBSCRIBERS
# ============================================================================

# Order processing subscriber
class OrderProcessor < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    puts "Processing order #{message['order_id']}"
    puts "Event ID: #{context.event_id}"
    puts "Trace ID: #{context.trace_id}"
    puts "Delivery attempt: #{context.deliveries}"

    # Validate message
    validate_order!(message)

    # Process the order
    process_order_in_database(message)

    # Publish follow-up events
    NatsPubsub.publish(
      topic: 'order.confirmed',
      message: {
        order_id: message['order_id'],
        confirmed_at: Time.now.iso8601
      },
      trace_id: context.trace_id,
      correlation_id: context.correlation_id
    )

    # Send notification
    NatsPubsub.publish(
      topic: 'notification.send',
      message: {
        user_id: message['customer_id'],
        type: 'email',
        subject: 'Order Confirmed',
        body: "Your order #{message['order_id']} has been confirmed."
      },
      trace_id: context.trace_id
    )
  end

  def on_error(error_context)
    error = error_context.error
    message = error_context.message
    attempt_number = error_context.attempt_number
    max_attempts = error_context.max_attempts

    puts "Error processing order #{message['order_id']}: #{error.message}"
    puts "Attempt #{attempt_number}/#{max_attempts}"

    # Decide action based on error type
    case error
    when ValidationError
      # Validation errors should not retry
      puts 'Invalid order data, sending to DLQ'
      NatsPubsub::Core::ErrorAction::DLQ
    when NetworkError, Timeout::Error
      # Network errors should retry
      if error_context.last_attempt?
        puts 'Max retries exhausted, sending to DLQ'
        NatsPubsub::Core::ErrorAction::DLQ
      else
        puts 'Network error, will retry'
        NatsPubsub::Core::ErrorAction::RETRY
      end
    else
      # Default: retry unless exhausted
      if error_context.last_attempt?
        NatsPubsub::Core::ErrorAction::DLQ
      else
        NatsPubsub::Core::ErrorAction::RETRY
      end
    end
  end

  private

  def validate_order!(message)
    required_fields = %w[order_id customer_id items total_amount status]
    missing = required_fields - message.keys

    raise ValidationError, "Missing required fields: #{missing.join(', ')}" unless missing.empty?
    raise ValidationError, 'Items cannot be empty' if message['items'].empty?
    raise ValidationError, 'Total amount must be positive' unless message['total_amount'].positive?
  end

  def process_order_in_database(order)
    # Simulate database operation
    sleep 0.1
  end
end

# Payment processing subscriber
class PaymentProcessor < NatsPubsub::Subscriber
  subscribe_to 'payment.process'

  def initialize
    super
    @circuit_breaker = create_circuit_breaker
  end

  def handle(message, context)
    # Use circuit breaker for external API call
    result = @circuit_breaker.call do
      call_payment_api(message)
    end

    NatsPubsub.publish(
      topic: 'payment.completed',
      message: {
        payment_id: message['payment_id'],
        result: result
      },
      trace_id: context.trace_id
    )
  rescue CircuitBreakerOpenError => e
    puts "Payment API circuit breaker is OPEN: #{e.message}"
    raise StandardError, 'Payment service temporarily unavailable'
  end

  def on_error(error_context)
    if error_context.error.message.include?('temporarily unavailable')
      # Don't retry immediately when circuit is open
      NatsPubsub::Core::ErrorAction::DLQ
    else
      NatsPubsub::Core::ErrorAction::RETRY
    end
  end

  private

  def create_circuit_breaker
    # Simple circuit breaker implementation
    OpenStruct.new(
      failures: 0,
      threshold: 5,
      state: :closed,
      last_opened_at: nil,
      timeout: 30_000,
      call: lambda do |&block|
        if @state == :open && time_since_opened < @timeout
          raise CircuitBreakerOpenError, 'Circuit breaker is OPEN'
        end

        begin
          result = block.call
          @failures = 0
          @state = :closed
          result
        rescue StandardError => e
          @failures += 1
          if @failures >= @threshold
            @state = :open
            @last_opened_at = Time.now
          end
          raise e
        end
      end
    )
  end

  def call_payment_api(message)
    # Simulate external API call
    sleep 0.2
    { success: true, transaction_id: 'txn-123' }
  end

  def time_since_opened
    return Float::INFINITY if @last_opened_at.nil?

    ((Time.now - @last_opened_at) * 1000).to_i
  end
end

# Notification sender
class NotificationSender < NatsPubsub::Subscriber
  subscribe_to 'notification.send'

  def handle(message, context)
    validate_notification!(message)

    puts "Sending #{message['type']} notification to user #{message['user_id']}"

    case message['type']
    when 'email'
      send_email(message['user_id'], message['subject'], message['body'])
    when 'sms'
      send_sms(message['user_id'], message['body'])
    when 'push'
      send_push_notification(message['user_id'], message['subject'], message['body'])
    end
  end

  def on_error(error_context)
    # Non-critical notifications can be discarded on repeated failures
    if error_context.attempt_number >= 3
      puts 'Notification failed after 3 attempts, discarding'
      NatsPubsub::Core::ErrorAction::DISCARD
    else
      NatsPubsub::Core::ErrorAction::RETRY
    end
  end

  private

  def validate_notification!(message)
    required_fields = %w[user_id type subject body]
    missing = required_fields - message.keys

    raise ValidationError, "Missing required fields: #{missing.join(', ')}" unless missing.empty?

    valid_types = %w[email sms push]
    return if valid_types.include?(message['type'])

    raise ValidationError, "Invalid notification type: #{message['type']}"
  end

  def send_email(user_id, subject, body)
    puts "Email sent to user #{user_id}"
  end

  def send_sms(user_id, body)
    puts "SMS sent to user #{user_id}"
  end

  def send_push_notification(user_id, subject, body)
    puts "Push notification sent to user #{user_id}"
  end
end

# ============================================================================
# 3. PUBLISHING
# ============================================================================

# Simple publish
def publish_order_created(order)
  NatsPubsub.publish(
    topic: 'order.created',
    message: order,
    trace_id: generate_trace_id,
    correlation_id: generate_correlation_id
  )
end

# Batch publishing
def publish_multiple_events
  result = NatsPubsub.batch do |batch|
    batch.add('order.created', {
      order_id: '123',
      customer_id: '456',
      items: [{ product_id: 'P1', quantity: 2, price: 29.99 }],
      total_amount: 59.98,
      status: 'pending',
      created_at: Time.now.iso8601
    })

    batch.add('notification.send', {
      user_id: '456',
      type: 'email',
      subject: 'Order Received',
      body: 'We received your order.'
    })

    batch.add('analytics.event.tracked', {
      event: 'order_created',
      user_id: '456',
      properties: { order_id: '123', total_amount: 59.98 }
    })

    batch.with_options(trace_id: generate_trace_id)
  end.publish

  puts "Batch publish: #{result.success_count} succeeded, #{result.failure_count} failed"

  if result.failures.any?
    puts "Failed publishes: #{result.failures.inspect}"
  end

  result
end

# ============================================================================
# 4. APPLICATION LIFECYCLE
# ============================================================================

def start_application
  # Setup topology (creates streams, consumers)
  NatsPubsub.setup

  # Register subscribers
  NatsPubsub.register_subscriber(OrderProcessor.new)
  NatsPubsub.register_subscriber(PaymentProcessor.new)
  NatsPubsub.register_subscriber(NotificationSender.new)

  # Start consuming messages
  NatsPubsub.start

  puts 'Application started successfully'
rescue StandardError => e
  puts "Failed to start application: #{e.message}"
  exit 1
end

def stop_application
  # Stop consuming messages
  NatsPubsub.stop

  # Disconnect from NATS
  NatsPubsub.disconnect

  puts 'Application stopped gracefully'
rescue StandardError => e
  puts "Error during shutdown: #{e.message}"
end

# ============================================================================
# 5. TESTING
# ============================================================================

def test_order_processing
  harness = NatsPubsub::Testing::TestHarness.new(
    subscribers: [OrderProcessor, NotificationSender],
    inline_mode: true
  )

  begin
    harness.setup

    # Publish a test order
    harness.publish('order.created', {
      order_id: 'test-123',
      customer_id: 'cust-456',
      items: [{ product_id: 'P1', quantity: 1, price: 19.99 }],
      total_amount: 19.99,
      status: 'pending',
      created_at: Time.now.iso8601
    })

    # Wait for subscriber to process
    harness.wait_for_subscriber(OrderProcessor, timeout: 5.0)

    # Assert subscriber was called
    raise 'OrderProcessor was not called' unless harness.subscriber_called?(OrderProcessor)
    raise 'OrderProcessor call count mismatch' unless harness.subscriber_call_count(OrderProcessor) == 1

    # Check follow-up notifications were published
    harness.wait_for_messages('notification.send', count: 1)
    notifications = harness.received('notification.send')
    raise 'Notification not found' unless notifications.size == 1

    # Simulate error scenario
    harness.simulate_error(OrderProcessor, StandardError.new('Database connection failed'))

    harness.publish('order.created', {
      order_id: 'test-456',
      customer_id: 'cust-789',
      items: [{ product_id: 'P2', quantity: 1, price: 29.99 }],
      total_amount: 29.99,
      status: 'pending',
      created_at: Time.now.iso8601
    })

    # Check DLQ message
    harness.wait_for(timeout: 5.0) { harness.dlq_messages.any? }
    dlq_messages = harness.dlq_messages
    raise 'DLQ message not found' unless dlq_messages.size == 1

    puts "DLQ message: #{dlq_messages.first.inspect}"
    puts 'All tests passed!'
  ensure
    harness.cleanup
  end
end

# ============================================================================
# 6. HEALTH CHECKS
# ============================================================================

def check_health
  # Full health check
  health = NatsPubsub.health_check
  puts "Health status: #{health.status}"
  puts "Healthy: #{health.healthy?}"
  puts "Components: #{health.components.keys.join(', ')}"

  if health.unhealthy?
    puts 'System is unhealthy!'
  end

  # Quick health check (faster, less detailed)
  quick_health = NatsPubsub.quick_health_check
  puts "Quick health: #{quick_health.status}"
end

# Sinatra health endpoint example
# require 'sinatra/base'
#
# class HealthApp < Sinatra::Base
#   get '/health', to: NatsPubsub.health_check_middleware
#   get '/health/quick', to: NatsPubsub.quick_health_check_middleware
# end

# Rails health endpoint example
# Rails.application.routes.draw do
#   get '/health', to: NatsPubsub.health_check_middleware
#   get '/health/quick', to: NatsPubsub.quick_health_check_middleware
# end

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_trace_id
  "trace-#{Time.now.to_i}-#{SecureRandom.hex(4)}"
end

def generate_correlation_id
  "corr-#{Time.now.to_i}-#{SecureRandom.hex(4)}"
end

# Custom error classes
class ValidationError < StandardError; end
class NetworkError < StandardError; end
class CircuitBreakerOpenError < StandardError; end

# ============================================================================
# MAIN
# ============================================================================

if __FILE__ == $PROGRAM_NAME
  # Handle graceful shutdown
  trap('INT') do
    puts 'Received SIGINT, shutting down...'
    stop_application
    exit 0
  end

  trap('TERM') do
    puts 'Received SIGTERM, shutting down...'
    stop_application
    exit 0
  end

  begin
    start_application

    # Keep the process running
    sleep
  rescue StandardError => e
    puts "Fatal error: #{e.message}"
    puts e.backtrace.join("\n")
    exit 1
  end
end
