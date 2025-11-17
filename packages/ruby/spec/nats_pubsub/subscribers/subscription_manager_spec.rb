# frozen_string_literal: true

require 'nats_pubsub/subscribers/subscription_manager'
require 'nats_pubsub/core/config'

RSpec.describe NatsPubsub::Subscribers::SubscriptionManager do
  let(:mock_jts) { double('JetStream') }
  let(:mock_config) do
    instance_double(
      NatsPubsub::Config,
      env: 'test',
      stream_name: 'test-events-stream',
      max_deliver: 5,
      ack_wait: '30s',
      backoff: %w[1s 5s 15s]
    )
  end
  let(:durable) { 'test-consumer' }

  subject(:manager) { described_class.new(mock_jts, durable, mock_config) }

  before do
    allow(NatsPubsub::Logging).to receive(:info)
    allow(NatsPubsub::Logging).to receive(:warn)
  end

  describe '#initialize' do
    it 'sets the jetstream client' do
      expect(manager.instance_variable_get(:@jts)).to eq(mock_jts)
    end

    it 'sets the durable name' do
      expect(manager.instance_variable_get(:@durable)).to eq(durable)
    end

    it 'sets the config' do
      expect(manager.instance_variable_get(:@cfg)).to eq(mock_config)
    end

    it 'sets default filter subject' do
      expect(manager.filter_subject).to eq('test.events.>')
    end

    it 'accepts custom filter subject' do
      custom_manager = described_class.new(
        mock_jts,
        durable,
        mock_config,
        filter_subject: 'custom.subject'
      )
      expect(custom_manager.filter_subject).to eq('custom.subject')
    end

    it 'builds consumer config' do
      expect(manager.desired_consumer_cfg).to include(
        durable_name: durable,
        filter_subject: 'test.events.>',
        ack_policy: 'explicit',
        deliver_policy: 'all'
      )
    end
  end

  describe '#stream_name' do
    it 'returns the stream name from config' do
      expect(manager.stream_name).to eq('test-events-stream')
    end
  end

  describe '#filter_subject' do
    it 'returns the filter subject' do
      expect(manager.filter_subject).to eq('test.events.>')
    end
  end

  describe '#desired_consumer_cfg' do
    it 'returns consumer configuration hash' do
      config = manager.desired_consumer_cfg
      expect(config).to be_a(Hash)
      expect(config[:durable_name]).to eq(durable)
      expect(config[:filter_subject]).to eq('test.events.>')
      expect(config[:ack_policy]).to eq('explicit')
      expect(config[:deliver_policy]).to eq('all')
      expect(config[:max_deliver]).to eq(5)
    end

    it 'converts ack_wait to milliseconds' do
      config = manager.desired_consumer_cfg
      expect(config[:ack_wait]).to eq(30_000)
    end

    it 'converts backoff to milliseconds' do
      config = manager.desired_consumer_cfg
      expect(config[:backoff]).to eq([1_000, 5_000, 15_000])
    end
  end

  describe '#ensure_consumer!' do
    context 'when consumer does not exist' do
      before do
        allow(mock_jts).to receive(:consumer_info)
          .and_raise(NATS::JetStream::Error.new('not found'))
        allow(mock_jts).to receive(:add_consumer)
      end

      it 'creates a new consumer' do
        expect(mock_jts).to receive(:add_consumer).with(
          'test-events-stream',
          hash_including(durable_name: durable)
        )
        manager.ensure_consumer!
      end

      it 'logs consumer creation' do
        expect(NatsPubsub::Logging).to receive(:info).with(
          /Created consumer #{durable}/,
          hash_including(tag: 'NatsPubsub::Subscribers::SubscriptionManager')
        )
        manager.ensure_consumer!
      end
    end

    context 'when consumer exists with matching config' do
      let(:mock_info) do
        double(
          'ConsumerInfo',
          config: double(
            'Config',
            filter_subject: 'test.events.>',
            ack_policy: :explicit,
            deliver_policy: :all,
            max_deliver: 5,
            ack_wait: 30_000_000_000, # 30s in nanoseconds
            backoff: [1_000_000_000, 5_000_000_000, 15_000_000_000] # in nanoseconds
          )
        )
      end

      before do
        allow(mock_jts).to receive(:consumer_info).and_return(mock_info)
      end

      it 'does not recreate the consumer' do
        expect(mock_jts).not_to receive(:delete_consumer)
        expect(mock_jts).not_to receive(:add_consumer)
        manager.ensure_consumer!
      end

      it 'logs that consumer is ok' do
        expect(NatsPubsub::Logging).to receive(:info).with(
          /Consumer #{durable} exists with desired config/,
          hash_including(tag: 'NatsPubsub::Subscribers::SubscriptionManager')
        )
        manager.ensure_consumer!
      end
    end

    context 'when consumer exists with different config' do
      let(:mock_info) do
        double(
          'ConsumerInfo',
          config: double(
            'Config',
            filter_subject: 'test.events.>',
            ack_policy: :explicit,
            deliver_policy: :all,
            max_deliver: 3, # Different from desired
            ack_wait: 20_000_000_000,
            backoff: []
          )
        )
      end

      before do
        allow(mock_jts).to receive(:consumer_info).and_return(mock_info)
        allow(mock_jts).to receive(:delete_consumer)
        allow(mock_jts).to receive(:add_consumer)
      end

      it 'logs config mismatch' do
        expect(NatsPubsub::Logging).to receive(:warn).with(
          /Consumer #{durable} config mismatch/,
          hash_including(tag: 'NatsPubsub::Subscribers::SubscriptionManager')
        )
        manager.ensure_consumer!
      end

      it 'deletes the existing consumer' do
        expect(mock_jts).to receive(:delete_consumer).with('test-events-stream', durable)
        manager.ensure_consumer!
      end

      it 'creates a new consumer with correct config' do
        expect(mock_jts).to receive(:add_consumer).with(
          'test-events-stream',
          hash_including(
            durable_name: durable,
            max_deliver: 5
          )
        )
        manager.ensure_consumer!
      end

      it 'logs recreation warning' do
        expect(NatsPubsub::Logging).to receive(:warn).with(
          /Consumer #{durable} exists with mismatched config; recreating/,
          hash_including(tag: 'NatsPubsub::Subscribers::SubscriptionManager')
        )
        manager.ensure_consumer!
      end
    end

    context 'when delete fails during recreation' do
      let(:mock_info) do
        double(
          'ConsumerInfo',
          config: double(
            'Config',
            filter_subject: 'test.events.>',
            ack_policy: :explicit,
            deliver_policy: :all,
            max_deliver: 3,
            ack_wait: 20_000_000_000,
            backoff: []
          )
        )
      end

      before do
        allow(mock_jts).to receive(:consumer_info).and_return(mock_info)
        allow(mock_jts).to receive(:delete_consumer)
          .and_raise(NATS::JetStream::Error.new('delete failed'))
        allow(mock_jts).to receive(:add_consumer)
      end

      it 'logs delete error but continues' do
        expect(NatsPubsub::Logging).to receive(:warn).with(
          /Delete consumer #{durable} ignored/,
          hash_including(tag: 'NatsPubsub::Subscribers::SubscriptionManager')
        )
        manager.ensure_consumer!
      end

      it 'still creates the consumer' do
        expect(mock_jts).to receive(:add_consumer)
        manager.ensure_consumer!
      end
    end
  end

  describe '#subscribe!' do
    before do
      allow(mock_jts).to receive(:pull_subscribe)
    end

    it 'creates a pull subscription' do
      expect(mock_jts).to receive(:pull_subscribe).with(
        'test.events.>',
        durable,
        stream: 'test-events-stream',
        config: manager.desired_consumer_cfg
      )
      manager.subscribe!
    end

    it 'uses custom filter subject if provided' do
      custom_manager = described_class.new(
        mock_jts,
        durable,
        mock_config,
        filter_subject: 'custom.subject.>'
      )
      expect(mock_jts).to receive(:pull_subscribe).with(
        'custom.subject.>',
        durable,
        anything
      )
      custom_manager.subscribe!
    end
  end

  describe 'duration conversion' do
    describe '#duration_to_ms' do
      it 'converts nanoseconds to milliseconds' do
        # 30 seconds in nanoseconds
        result = manager.send(:duration_to_ms, 30_000_000_000)
        expect(result).to eq(30_000)
      end

      it 'converts string durations' do
        expect(manager.send(:duration_to_ms, '30s')).to eq(30_000)
        expect(manager.send(:duration_to_ms, '500ms')).to eq(500)
        expect(manager.send(:duration_to_ms, '2m')).to eq(120_000)
      end

      it 'handles small integers as seconds' do
        expect(manager.send(:duration_to_ms, 5)).to eq(5_000)
      end

      it 'handles large integers as milliseconds' do
        expect(manager.send(:duration_to_ms, 5_000)).to eq(5_000)
      end

      it 'returns nil for nil input' do
        expect(manager.send(:duration_to_ms, nil)).to be_nil
      end

      it 'raises error for invalid input' do
        expect do
          manager.send(:duration_to_ms, Object.new)
        end.to raise_error(ArgumentError, /invalid duration/)
      end
    end

    describe '#normalize_consumer_config' do
      it 'normalizes hash config' do
        config = {
          filter_subject: 'test.subject',
          ack_policy: 'explicit',
          deliver_policy: 'all',
          max_deliver: 5,
          ack_wait: '30s',
          backoff: ['1s', '5s']
        }

        normalized = manager.send(:normalize_consumer_config, config)
        expect(normalized[:filter_subject]).to eq('test.subject')
        expect(normalized[:ack_policy]).to eq('explicit')
        expect(normalized[:max_deliver]).to eq(5)
        expect(normalized[:ack_wait]).to eq(30_000)
        expect(normalized[:backoff]).to eq([1_000, 5_000])
      end

      it 'normalizes struct-like config' do
        config = double(
          'Config',
          filter_subject: 'test.subject',
          ack_policy: :explicit,
          deliver_policy: :all,
          max_deliver: 5,
          ack_wait: 30_000_000_000,
          backoff: [1_000_000_000]
        )

        normalized = manager.send(:normalize_consumer_config, config)
        expect(normalized[:ack_policy]).to eq('explicit')
        expect(normalized[:ack_wait]).to eq(30_000)
        expect(normalized[:backoff]).to eq([1_000])
      end

      it 'converts symbols to lowercase strings' do
        config = {
          filter_subject: 'test',
          ack_policy: :Explicit,
          deliver_policy: :All,
          max_deliver: 5,
          ack_wait: 1000,
          backoff: []
        }

        normalized = manager.send(:normalize_consumer_config, config)
        expect(normalized[:ack_policy]).to eq('explicit')
        expect(normalized[:deliver_policy]).to eq('all')
      end
    end
  end

  describe 'config access helpers' do
    describe '#get' do
      it 'retrieves value from hash' do
        hash = { key: 'value' }
        expect(manager.send(:get, hash, :key)).to eq('value')
      end

      it 'retrieves value from struct-like object' do
        obj = double('Object', key: 'value')
        expect(manager.send(:get, obj, :key)).to eq('value')
      end
    end

    describe '#sval' do
      it 'converts symbol to lowercase string' do
        config = { key: :Value }
        expect(manager.send(:sval, config, :key)).to eq('value')
      end

      it 'converts string to lowercase' do
        config = { key: 'VALUE' }
        expect(manager.send(:sval, config, :key)).to eq('value')
      end
    end

    describe '#ival' do
      it 'converts value to integer' do
        config = { key: '123' }
        expect(manager.send(:ival, config, :key)).to eq(123)
      end

      it 'handles numeric values' do
        config = { key: 456 }
        expect(manager.send(:ival, config, :key)).to eq(456)
      end
    end
  end
end
