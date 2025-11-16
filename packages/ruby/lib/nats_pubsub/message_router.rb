# frozen_string_literal: true

require_relative 'core/logging'
require_relative 'subscriber_registry'

module NatsPubsub
  # Routes incoming messages to the appropriate subscribers
  class MessageRouter
    def initialize(registry = nil)
      @registry = registry || SubscriberRegistry.instance
      @middleware = NatsPubsub.config.server_middleware
    end

    # Route a message to all matching subscribers
    #
    # @param event [Hash] Parsed event envelope
    # @param subject [String] NATS subject
    # @param deliveries [Integer] Delivery attempt count
    def route(event, subject, deliveries)
      subscribers = @registry.subscribers_for(subject)

      if subscribers.empty?
        Logging.warn(
          "No subscribers found for subject: #{subject}",
          tag: 'NatsPubsub::MessageRouter'
        )
        return
      end

      metadata = build_metadata(event, subject, deliveries)

      subscribers.each do |subscriber_class|
        execute_subscriber(subscriber_class, event['payload'] || event, metadata)
      end
    end

    private

    def build_metadata(event, subject, deliveries)
      {
        subject: subject,
        deliveries: deliveries,
        event_id: event['event_id'],
        domain: event['domain'],
        resource: event['resource'],
        action: event['action'],
        occurred_at: event['occurred_at'],
        trace_id: event['trace_id'],
        producer: event['producer'],
        # Legacy support
        event_type: event['event_type'],
        resource_type: event['resource_type']
      }.compact
    end

    def execute_subscriber(subscriber_class, payload, metadata)
      subscriber = subscriber_class.new

      @middleware.invoke(subscriber, payload, metadata) do
        subscriber.call(payload, metadata)
      end

      Logging.info(
        "Handled #{metadata[:subject]} with #{subscriber_class.name}",
        tag: 'NatsPubsub::MessageRouter'
      )
    rescue StandardError => e
      Logging.error(
        "Subscriber #{subscriber_class.name} failed: #{e.class} #{e.message}",
        tag: 'NatsPubsub::MessageRouter'
      )
      raise # Re-raise to trigger NATS retry/DLQ logic
    end
  end
end
