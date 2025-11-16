# frozen_string_literal: true

module NatsPubsub
  # Testing utilities for NatsPubsub
  # Provides fake and inline modes for testing event publishing
  module Testing
    class << self
      attr_accessor :mode

      # Enable fake mode (records published events but doesn't process them)
      def fake!
        self.mode = :fake
        published_events.clear
      end

      # Enable inline mode (executes subscribers immediately)
      def inline!
        self.mode = :inline
        published_events.clear
      end

      # Disable testing mode (normal operation)
      def disable!
        self.mode = nil
        published_events.clear
      end

      # Get all published events
      #
      # @return [Array<Hash>] Array of published events
      def published_events
        @published_events ||= []
      end

      # Clear all published events
      def clear!
        published_events.clear
      end
    end

    # Module to prepend to Publisher for testing support
    module PublisherExtension
      def publish_event(domain, resource, action, payload, **options)
        event = {
          domain: domain,
          resource: resource,
          action: action,
          payload: payload,
          options: options,
          subject: NatsPubsub.config.event_subject(domain, resource, action)
        }

        case Testing.mode
        when :fake
          Testing.published_events << event
          true
        when :inline
          Testing.published_events << event
          execute_subscribers_inline(event)
          true
        else
          super
        end
      end

      private

      def execute_subscribers_inline(event)
        require_relative 'subscriber_registry'

        subject = event[:subject]
        subscribers = SubscriberRegistry.instance.subscribers_for(subject)

        subscribers.each do |sub_class|
          subscriber = sub_class.new
          subscriber.call(event[:payload], event)
        end
      rescue => e
        # Re-raise to maintain test behavior
        raise
      end
    end
  end
end

# Prepend testing extension to Publisher
require_relative 'publisher/publisher'
NatsPubsub::Publisher.prepend(NatsPubsub::Testing::PublisherExtension)
