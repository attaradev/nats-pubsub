# frozen_string_literal: true

require 'nats_pubsub'

RSpec.describe NatsPubsub::Publisher, '#publish' do
  let(:jts) { double('jetstream') }
  let(:ack) { double('ack', duplicate?: false, error: nil) }
  subject(:publisher) { described_class.new }

  before do
    NatsPubsub.reset!
    NatsPubsub.configure do |c|
      c.app_name = 'test_app'
      c.env      = 'test'
    end
    allow(NatsPubsub::Connection).to receive(:connect!).and_return(jts)
    allow(jts).to receive(:publish).and_return(ack)
  end

  after { NatsPubsub.reset! }

  describe 'topic-based publishing with positional args' do
    it 'publishes to a topic' do
      expect(jts).to receive(:publish).with(
        'test.test_app.notifications',
        anything,
        anything
      )

      result = publisher.publish('notifications', { text: 'Hello' })
      expect(result).to be_a(NatsPubsub::PublishResult)
      expect(result.success?).to be true
    end

    it 'passes options correctly' do
      result = publisher.publish('notifications', { text: 'Hello' }, trace_id: 'trace-123')
      expect(result).to be_a(NatsPubsub::PublishResult)
      expect(result.success?).to be true
    end
  end

  describe 'topic-based publishing with keyword args' do
    it 'publishes to a topic' do
      expect(jts).to receive(:publish).with(
        'test.test_app.notifications',
        anything,
        anything
      )

      result = publisher.publish(topic: 'notifications', message: { text: 'Hello' })
      expect(result).to be_a(NatsPubsub::PublishResult)
      expect(result.success?).to be true
    end
  end

  describe 'domain/resource/action publishing' do
    it 'publishes using domain/resource/action pattern' do
      expect(jts).to receive(:publish) do |subject, data, _options|
        expect(subject).to eq('test.test_app.users.user.created')
        envelope = Oj.load(data, mode: :strict)
        expect(envelope['domain']).to eq('users')
        expect(envelope['resource']).to eq('user')
        expect(envelope['action']).to eq('created')
        ack
      end

      result = publisher.publish(
        domain: 'users',
        resource: 'user',
        action: 'created',
        payload: { id: 123, name: 'John' }
      )

      expect(result).to be_a(NatsPubsub::PublishResult)
      expect(result.success?).to be true
    end

    it 'includes resource_id from payload' do
      expect(jts).to receive(:publish) do |_subject, data, _options|
        envelope = Oj.load(data, mode: :strict)
        expect(envelope['resource_id']).to eq('123')
        ack
      end

      publisher.publish(
        domain: 'orders',
        resource: 'order',
        action: 'updated',
        payload: { id: 123, status: 'shipped' }
      )
    end

    it 'passes additional options' do
      result = publisher.publish(
        domain: 'users',
        resource: 'user',
        action: 'created',
        payload: { id: 123 },
        trace_id: 'trace-456'
      )

      expect(result).to be_a(NatsPubsub::PublishResult)
      expect(result.success?).to be true
    end
  end

  describe 'multi-topic publishing' do
    it 'publishes to multiple topics' do
      expect(jts).to receive(:publish).twice

      results = publisher.publish(
        topics: %w[notifications audit],
        message: { action: 'login' }
      )

      expect(results).to be_a(Hash)
      expect(results['notifications']).to be_a(NatsPubsub::PublishResult)
      expect(results['notifications'].success?).to be true
      expect(results['audit']).to be_a(NatsPubsub::PublishResult)
      expect(results['audit'].success?).to be true
    end

    it 'passes options to each topic' do
      results = publisher.publish(
        topics: %w[notifications audit],
        message: { action: 'login' },
        trace_id: 'trace-789'
      )

      expect(results).to be_a(Hash)
      expect(results.keys).to contain_exactly('notifications', 'audit')
    end
  end

  describe 'error handling' do
    it 'raises ArgumentError for invalid arguments' do
      expect do
        publisher.publish
      end.to raise_error(ArgumentError, /Invalid arguments/)
    end

    it 'raises ArgumentError when missing required keyword args' do
      expect do
        publisher.publish(domain: 'users', resource: 'user')
      end.to raise_error(ArgumentError, /Invalid arguments/)
    end

    it 'returns failure result on publish error' do
      allow(jts).to receive(:publish).and_raise(StandardError, 'Connection failed')

      result = publisher.publish('notifications', { text: 'Hello' })

      expect(result).to be_a(NatsPubsub::PublishResult)
      expect(result.failure?).to be true
      expect(result.reason).to eq(:io_error)
    end
  end
end
