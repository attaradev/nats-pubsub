# frozen_string_literal: true

require 'nats_pubsub/topic_publisher'

RSpec.describe NatsPubsub::TopicPublisher do
  let(:publisher) { described_class.new }
  let(:mock_jts) { double('JetStream') }
  let(:mock_config) { double('Config', env: 'development', app_name: 'app', use_outbox: false) }

  before do
    allow(NatsPubsub).to receive(:config).and_return(mock_config)
    allow(NatsPubsub::Connection).to receive(:connect!).and_return(mock_jts)
    allow(NatsPubsub::Logging).to receive(:info)
    allow(NatsPubsub::Logging).to receive(:error)
  end

  describe '#publish_to_topic' do
    let(:topic) { 'notifications' }
    let(:message) { { type: 'email', to: 'user@example.com' } }

    before do
      allow(mock_jts).to receive(:publish).and_return(double(duplicate?: false, error: nil))
    end

    it 'publishes message to topic' do
      expect(mock_jts).to receive(:publish).with(
        'development.app.notifications',
        kind_of(String),
        hash_including(header: kind_of(Hash))
      )
      publisher.publish_to_topic(topic, message)
    end

    it 'includes topic in envelope' do
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['topic']).to eq('notifications')
      end
      publisher.publish_to_topic(topic, message)
    end

    it 'includes message in envelope' do
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['message']).to eq(message.stringify_keys)
      end
      publisher.publish_to_topic(topic, message)
    end

    it 'generates event_id' do
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['event_id']).to be_a(String)
        expect(envelope['event_id']).not_to be_empty
      end
      publisher.publish_to_topic(topic, message)
    end

    it 'accepts custom event_id' do
      custom_id = 'custom-event-123'
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['event_id']).to eq(custom_id)
      end
      publisher.publish_to_topic(topic, message, event_id: custom_id)
    end

    it 'includes trace_id when provided' do
      trace_id = 'trace-123'
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['trace_id']).to eq(trace_id)
      end
      publisher.publish_to_topic(topic, message, trace_id: trace_id)
    end

    it 'normalizes topic name' do
      expect(mock_jts).to receive(:publish).with(
        'development.app.my_topic_',
        anything,
        anything
      )
      publisher.publish_to_topic('My Topic!', message)
    end

    it 'returns true on success' do
      result = publisher.publish_to_topic(topic, message)
      expect(result).to be true
    end

    it 'returns false on error' do
      allow(mock_jts).to receive(:publish).and_raise(StandardError)
      result = publisher.publish_to_topic(topic, message)
      expect(result).to be false
    end
  end

  describe '#publish_to_topics' do
    let(:topics) { %w[notifications audit] }
    let(:message) { { action: 'user_login' } }

    before do
      allow(mock_jts).to receive(:publish).and_return(double(duplicate?: false, error: nil))
    end

    it 'publishes to multiple topics' do
      expect(mock_jts).to receive(:publish).with(
        'development.app.notifications',
        anything,
        anything
      )
      expect(mock_jts).to receive(:publish).with(
        'development.app.audit',
        anything,
        anything
      )
      publisher.publish_to_topics(topics, message)
    end

    it 'returns hash with results' do
      results = publisher.publish_to_topics(topics, message)
      expect(results).to be_a(Hash)
      expect(results['notifications']).to be true
      expect(results['audit']).to be true
    end

    it 'handles partial failures' do
      allow(mock_jts).to receive(:publish) do |subject, _payload, _options|
        raise StandardError if subject.include?('audit')

        double(duplicate?: false, error: nil)
      end

      results = publisher.publish_to_topics(topics, message)
      expect(results['notifications']).to be true
      expect(results['audit']).to be false
    end
  end

  describe 'envelope structure' do
    let(:topic) { 'test_topic' }
    let(:message) { { key: 'value' } }

    before do
      allow(mock_jts).to receive(:publish).and_return(double(duplicate?: false, error: nil))
    end

    it 'includes schema_version' do
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['schema_version']).to eq(1)
      end
      publisher.publish_to_topic(topic, message)
    end

    it 'includes producer' do
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['producer']).to eq('app')
      end
      publisher.publish_to_topic(topic, message)
    end

    it 'includes occurred_at' do
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['occurred_at']).to be_a(String)
        expect(envelope['occurred_at']).to match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      end
      publisher.publish_to_topic(topic, message)
    end

    it 'accepts custom occurred_at' do
      custom_time = Time.utc(2024, 1, 1, 12, 0, 0)
      expect(mock_jts).to receive(:publish) do |_subject, payload, _options|
        envelope = Oj.load(payload)
        expect(envelope['occurred_at']).to eq('2024-01-01T12:00:00Z')
      end
      publisher.publish_to_topic(topic, message, occurred_at: custom_time)
    end
  end
end
