require 'nats_pubsub'

module InventoryService
  module Subscribers
    class OrderCreatedSubscriber
      include NatsPubsub::Subscribers::Subscriber

      subscribe_to_topic 'order.created', max_deliver: 3, ack_wait: 30_000

      def initialize(inventory_service)
        @inventory_service = inventory_service
      end

      def handle(message, context)
        puts "[OrderCreatedSubscriber] Processing event #{context.event_id}"

        # Validate message
        raise ArgumentError, 'Missing orderId' unless message['orderId']
        raise ArgumentError, 'Missing items' unless message['items']

        # Handle order created
        @inventory_service.handle_order_created(message['orderId'], message['items'])

        puts "[OrderCreatedSubscriber] Processed event #{context.event_id}"
      end

      def on_error(error_context)
        error = error_context.error
        attempt_number = error_context.attempt_number
        max_attempts = error_context.max_attempts

        puts "[OrderCreatedSubscriber] Error processing message: #{error.message}"
        puts "Attempt #{attempt_number} of #{max_attempts}"

        # Retry on transient errors
        if error.message.include?('connection') || error.message.include?('timeout')
          return NatsPubsub::Core::ErrorAction::RETRY
        end

        # Send to DLQ on validation errors
        if error.is_a?(ArgumentError)
          return NatsPubsub::Core::ErrorAction::DLQ
        end

        # Retry with exponential backoff for other errors
        if attempt_number < max_attempts
          return NatsPubsub::Core::ErrorAction::RETRY
        end

        # Send to DLQ after max attempts
        NatsPubsub::Core::ErrorAction::DLQ
      end
    end
  end
end
