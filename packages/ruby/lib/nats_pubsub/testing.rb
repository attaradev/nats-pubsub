# frozen_string_literal: true

require_relative 'publisher/envelope_builder'
require_relative 'publisher/publish_result'

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

      # Check if an event was published
      #
      # @param domain [String] Domain of the event
      # @param resource [String] Resource type
      # @param action [String] Action performed
      # @return [Boolean] true if event was published
      def published?(domain, resource, action)
        published_events.any? do |event|
          event[:domain] == domain &&
            event[:resource] == resource &&
            event[:action] == action
        end
      end

      # Get published events matching criteria
      #
      # @param domain [String, nil] Optional domain filter
      # @param resource [String, nil] Optional resource filter
      # @param action [String, nil] Optional action filter
      # @return [Array<Hash>] Matching published events
      def find_events(domain: nil, resource: nil, action: nil)
        published_events.select do |event|
          (domain.nil? || event[:domain] == domain) &&
            (resource.nil? || event[:resource] == resource) &&
            (action.nil? || event[:action] == action)
        end
      end

      # Get the last published event
      #
      # @return [Hash, nil] Last published event or nil
      def last_event
        published_events.last
      end

      # Get count of published events
      #
      # @return [Integer] Number of published events
      def event_count
        published_events.size
      end
    end

    # Module to prepend to Publisher for testing support
    module PublisherExtension
      def publish_to_topic(topic, message, **options)
        event = {
          topic: topic,
          message: message,
          options: options,
          subject: EnvelopeBuilder.build_subject(topic)
        }

        case Testing.mode
        when :fake
          Testing.published_events << event
          PublishResult.success(event_id: 'fake-event-id', subject: event[:subject])
        when :inline
          Testing.published_events << event
          execute_subscribers_inline(event)
          PublishResult.success(event_id: 'fake-event-id', subject: event[:subject])
        else
          super
        end
      end

      def publish_event(domain, resource, action, payload, **options)
        topic = "#{domain}.#{resource}.#{action}"
        event = {
          domain: domain,
          resource: resource,
          action: action,
          payload: payload,
          options: options,
          topic: topic,
          subject: EnvelopeBuilder.build_subject(topic)
        }

        case Testing.mode
        when :fake
          Testing.published_events << event
          PublishResult.success(event_id: 'fake-event-id', subject: event[:subject])
        when :inline
          Testing.published_events << event
          execute_subscribers_inline(event.merge(message: payload))
          PublishResult.success(event_id: 'fake-event-id', subject: event[:subject])
        else
          super
        end
      end

      private

      def execute_subscribers_inline(event)
        require_relative 'subscribers/registry'

        subject = event[:subject]
        subscribers = Subscribers::Registry.instance.subscribers_for(subject)

        subscribers.each do |sub_class|
          subscriber = sub_class.new
          subscriber.call(event[:message] || event[:payload], event)
        end
      end
    end
  end
end

# Prepend testing extension to Publisher
require_relative 'publisher/publisher'
NatsPubsub::Publisher.prepend(NatsPubsub::Testing::PublisherExtension)

# Load matchers and helpers if available
require_relative 'testing/matchers' if defined?(RSpec)
require_relative 'testing/helpers'
