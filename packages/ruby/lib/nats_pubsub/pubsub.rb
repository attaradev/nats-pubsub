# frozen_string_literal: true

require_relative 'publisher/publisher'

module NatsPubsub
  # Module-level convenience methods for publishing events (PubSub style)
  module PubSub
    # Publish an event using the pubsub pattern
    #
    # @param domain [String] Domain (e.g., 'users', 'orders')
    # @param resource [String] Resource type (e.g., 'user', 'order')
    # @param action [String] Action (e.g., 'created', 'updated', 'deleted')
    # @param payload_and_options [Hash] Event payload plus optional keys (:event_id, :trace_id, :occurred_at)
    # @return [Boolean]
    #
    # Example:
    #   NatsPubsub.publish('users', 'user', 'created',
    #     id: user.id,
    #     name: user.name,
    #     email: user.email
    #   )
    def self.publish(domain, resource, action, **payload_and_options)
      payload = payload_and_options.except(:event_id, :trace_id, :occurred_at)
      options = payload_and_options.slice(:event_id, :trace_id, :occurred_at)

      Publisher.new.publish_event(domain, resource, action, payload, **options)
    end
  end

  # Extend main module with PubSub methods
  extend PubSub
end
