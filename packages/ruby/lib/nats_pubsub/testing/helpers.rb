# frozen_string_literal: true

module NatsPubsub
  module Testing
    # Helper methods for RSpec tests
    #
    # Include this module in your RSpec configuration:
    #
    # @example
    #   RSpec.configure do |config|
    #     config.include NatsPubsub::Testing::Helpers
    #   end
    module Helpers
      # Setup fake mode for testing (records events without processing)
      #
      # @example
      #   before do
      #     setup_nats_fake
      #   end
      def setup_nats_fake
        NatsPubsub::Testing.fake!
      end

      # Setup inline mode for testing (executes subscribers immediately)
      #
      # @example
      #   before do
      #     setup_nats_inline
      #   end
      def setup_nats_inline
        NatsPubsub::Testing.inline!
      end

      # Clear published events
      #
      # @example
      #   after do
      #     clear_nats_events
      #   end
      def clear_nats_events
        NatsPubsub::Testing.clear!
      end

      # Get all published events
      #
      # @return [Array<Hash>] All published events
      def nats_published_events
        NatsPubsub::Testing.published_events
      end

      # Check if an event was published
      #
      # @param domain [String] Domain of the event
      # @param resource [String] Resource type
      # @param action [String] Action performed
      # @return [Boolean] true if event was published
      def nats_event_published?(domain, resource, action)
        NatsPubsub::Testing.published?(domain, resource, action)
      end

      # Find published events matching criteria
      #
      # @param domain [String, nil] Optional domain filter
      # @param resource [String, nil] Optional resource filter
      # @param action [String, nil] Optional action filter
      # @return [Array<Hash>] Matching published events
      def find_nats_events(**criteria)
        NatsPubsub::Testing.find_events(**criteria)
      end

      # Get the last published event
      #
      # @return [Hash, nil] Last published event or nil
      def last_nats_event
        NatsPubsub::Testing.last_event
      end

      # Get count of published events
      #
      # @return [Integer] Number of published events
      def nats_event_count
        NatsPubsub::Testing.event_count
      end

      # Create an outbox event for testing
      #
      # @param attributes [Hash] Event attributes
      # @return [OutboxEvent] Created outbox event
      #
      # @example
      #   event = create_outbox_event(
      #     subject: 'development.app.users.user.created',
      #     payload: { id: 1, email: 'test@example.com' },
      #     status: 'pending'
      #   )
      def create_outbox_event(**attributes)
        model = NatsPubsub.config.outbox_model.constantize
        model.create!(default_outbox_attributes.merge(attributes))
      end

      # Create an inbox event for testing
      #
      # @param attributes [Hash] Event attributes
      # @return [InboxEvent] Created inbox event
      #
      # @example
      #   event = create_inbox_event(
      #     subject: 'development.app.users.user.created',
      #     payload: { id: 1, email: 'test@example.com' },
      #     status: 'received'
      #   )
      def create_inbox_event(**attributes)
        model = NatsPubsub.config.inbox_model.constantize
        model.create!(default_inbox_attributes.merge(attributes))
      end

      # Stub NATS connection to avoid real connections in tests
      #
      # @example
      #   before do
      #     stub_nats_connection
      #   end
      def stub_nats_connection
        return unless defined?(RSpec)

        connection = instance_double(NatsPubsub::Connection)
        allow(NatsPubsub::Connection).to receive(:instance).and_return(connection)
        allow(connection).to receive(:nats).and_return(double('nats', jetstream: double('jetstream')))
        allow(connection).to receive(:connected?).and_return(true)
        connection
      end

      private

      def default_outbox_attributes
        {
          event_id: SecureRandom.uuid,
          subject: 'test.subject',
          payload: '{}',
          status: 'pending',
          attempts: 0
        }
      end

      def default_inbox_attributes
        {
          event_id: SecureRandom.uuid,
          subject: 'test.subject',
          payload: '{}',
          status: 'received',
          delivery_count: 1
        }
      end
    end

    # RSpec configuration block for automatic setup
    #
    # Add this to your spec_helper.rb or rails_helper.rb:
    #
    # @example
    #   require 'nats_pubsub/testing/helpers'
    #
    #   RSpec.configure do |config|
    #     config.include NatsPubsub::Testing::Helpers
    #
    #     config.before(:each, nats_fake: true) do
    #       setup_nats_fake
    #     end
    #
    #     config.before(:each, nats_inline: true) do
    #       setup_nats_inline
    #     end
    #
    #     config.after(:each) do
    #       clear_nats_events if defined?(NatsPubsub::Testing)
    #     end
    #   end
    module RSpecConfiguration
      def self.configure(config)
        config.include Helpers

        # Automatically enable fake mode for tests tagged with nats_fake: true
        config.before(:each, nats_fake: true) do
          setup_nats_fake
        end

        # Automatically enable inline mode for tests tagged with nats_inline: true
        config.before(:each, nats_inline: true) do
          setup_nats_inline
        end

        # Clear events after each test
        config.after(:each) do
          clear_nats_events if defined?(NatsPubsub::Testing)
        end
      end
    end
  end
end
