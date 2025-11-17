# frozen_string_literal: true

module NatsHelpers
  # Helper to create a test NATS configuration
  def test_nats_config
    NatsPubsub.configure do |config|
      config.nats_servers = [ENV.fetch('NATS_URL', 'nats://localhost:4222')]
      config.app_name = 'test_app'
      config.env = 'test'
      config.use_outbox = false
      config.use_inbox = false
      config.use_dlq = false
    end
  end

  # Helper to stub NATS connection
  def stub_nats_connection
    allow(NatsPubsub::Connection).to receive(:connect!).and_return(true)
    allow(NatsPubsub::Connection).to receive(:jetstream).and_return(double('jetstream'))
  end

  # Helper to create a test message
  def create_test_message(payload, metadata = {})
    {
      payload: payload,
      metadata: {
        event_id: SecureRandom.uuid,
        timestamp: Time.now.utc,
        subject: 'test.subject',
        **metadata
      }
    }
  end
end

RSpec.configure do |config|
  config.include NatsHelpers
end
