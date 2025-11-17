# frozen_string_literal: true

require 'nats_pubsub'

RSpec.describe NatsPubsub::Connection do
  # Reset singleton between tests
  before do
    described_class.instance_variable_set(:@singleton__instance__, nil)
    described_class.instance_variable_set(:@__mutex, nil)
    NatsPubsub.reset!
  end

  describe '.connect!' do
    let(:mock_nc) { instance_double(NATS::IO::Client, connected?: true) }
    let(:mock_jts) { instance_double('JetStream') }
    let(:mock_config) { instance_double(NatsPubsub::Config, nats_urls: 'nats://localhost:4222') }

    before do
      allow(NatsPubsub).to receive(:config).and_return(mock_config)
      allow(NATS::IO::Client).to receive(:new).and_return(mock_nc)
      allow(mock_nc).to receive(:connect)
      allow(mock_nc).to receive(:jetstream).and_return(mock_jts)
      allow(NatsPubsub::Topology).to receive(:ensure!)
      allow(NatsPubsub::Logging).to receive(:info)
      allow(NatsPubsub::Logging).to receive(:sanitize_url) { |url| url }
    end

    it 'establishes a connection to NATS' do
      expect(NATS::IO::Client).to receive(:new).and_return(mock_nc)
      expect(mock_nc).to receive(:connect).with(hash_including(servers: ['nats://localhost:4222']))
      described_class.connect!
    end

    it 'creates a JetStream context' do
      expect(mock_nc).to receive(:jetstream).and_return(mock_jts)
      result = described_class.connect!
      expect(result).to eq(mock_jts)
    end

    it 'does not ensure topology on connect (topology is separate)' do
      expect(NatsPubsub::Topology).not_to receive(:ensure!)
      described_class.connect!
    end

    it 'logs connection info' do
      expect(NatsPubsub::Logging).to receive(:info).with(
        /Connected to NATS/,
        hash_including(tag: 'NatsPubsub::Connection')
      )
      described_class.connect!
    end

    it 'is thread-safe' do
      call_count = 0
      allow(mock_nc).to receive(:connect) { call_count += 1 }

      threads = 5.times.map do
        Thread.new { described_class.connect! }
      end

      threads.each(&:join)
      expect(call_count).to eq(1)
    end

    it 'returns existing connection if already connected' do
      first_result = described_class.connect!
      allow(NATS::IO::Client).to receive(:new).and_raise('Should not create new connection')
      second_result = described_class.connect!
      expect(second_result).to eq(first_result)
    end

    context 'with multiple NATS servers' do
      before do
        allow(mock_config).to receive(:nats_urls).and_return('nats://server1:4222,nats://server2:4222')
      end

      it 'connects to multiple servers' do
        expect(mock_nc).to receive(:connect).with(
          hash_including(servers: ['nats://server1:4222', 'nats://server2:4222'])
        )
        described_class.connect!
      end
    end

    context 'with no NATS URLs configured' do
      before do
        allow(mock_config).to receive(:nats_urls).and_return('')
      end

      it 'raises an error' do
        expect { described_class.connect! }.to raise_error('No NATS URLs configured')
      end
    end

    context 'with connection options' do
      it 'includes default connection options' do
        expect(mock_nc).to receive(:connect).with(
          hash_including(
            reconnect: true,
            reconnect_time_wait: 2,
            max_reconnect_attempts: 10,
            connect_timeout: 5
          )
        )
        described_class.connect!
      end
    end

    context 'when JetStream does not respond to #nc' do
      it 'adds nc method to JetStream instance' do
        local_mock_jts = double('JetStream')
        allow(local_mock_jts).to receive(:respond_to?).with(:nc).and_return(false)
        allow(local_mock_jts).to receive(:define_singleton_method)
        allow(mock_nc).to receive(:jetstream).and_return(local_mock_jts)

        described_class.connect!

        expect(local_mock_jts).to have_received(:define_singleton_method).with(:nc)
      end

      it 'nc method returns the NATS client' do
        # Create a real object so we can define singleton methods on it
        local_mock_jts = Object.new
        allow(mock_nc).to receive(:jetstream).and_return(local_mock_jts)

        described_class.connect!

        expect(local_mock_jts.respond_to?(:nc)).to be true
        expect(local_mock_jts.nc).to eq(mock_nc)
      end
    end

    context 'when JetStream already responds to #nc' do
      it 'does not override nc method' do
        existing_nc = double('ExistingNC')
        local_mock_jts = double('JetStream', nc: existing_nc)
        allow(local_mock_jts).to receive(:respond_to?).with(:nc).and_return(true)
        allow(local_mock_jts).to receive(:define_singleton_method)
        allow(mock_nc).to receive(:jetstream).and_return(local_mock_jts)

        described_class.connect!

        expect(local_mock_jts).not_to have_received(:define_singleton_method)
        expect(local_mock_jts.nc).to eq(existing_nc)
      end
    end
  end

  describe '.nc' do
    let(:mock_nc) { instance_double(NATS::IO::Client, connected?: true) }
    let(:mock_jts) { instance_double('JetStream') }

    before do
      allow(NATS::IO::Client).to receive(:new).and_return(mock_nc)
      allow(mock_nc).to receive(:connect)
      allow(mock_nc).to receive(:jetstream).and_return(mock_jts)
      allow(NatsPubsub::Topology).to receive(:ensure!)
      allow(NatsPubsub::Logging).to receive(:info)
    end

    it 'returns the NATS client instance' do
      described_class.connect!
      expect(described_class.nc).to eq(mock_nc)
    end
  end

  describe '.jetstream' do
    let(:mock_nc) { instance_double(NATS::IO::Client, connected?: true) }
    let(:mock_jts) { instance_double('JetStream') }

    before do
      allow(NATS::IO::Client).to receive(:new).and_return(mock_nc)
      allow(mock_nc).to receive(:connect)
      allow(mock_nc).to receive(:jetstream).and_return(mock_jts)
      allow(NatsPubsub::Topology).to receive(:ensure!)
      allow(NatsPubsub::Logging).to receive(:info)
    end

    it 'returns the JetStream context' do
      described_class.connect!
      expect(described_class.jetstream).to eq(mock_jts)
    end
  end

  describe '#connect!' do
    let(:instance) { described_class.instance }
    let(:mock_nc_instance) { instance_double(NATS::IO::Client, connected?: false) }
    let(:mock_jts_instance) { instance_double('JetStream') }
    let(:instance_mock_config) { instance_double(NatsPubsub::Config, nats_urls: 'nats://localhost:4222') }

    before do
      allow(NatsPubsub).to receive(:config).and_return(instance_mock_config)
      allow(NATS::IO::Client).to receive(:new).and_return(mock_nc_instance)
      allow(mock_nc_instance).to receive(:connect)
      allow(mock_nc_instance).to receive(:jetstream).and_return(mock_jts_instance)
      allow(NatsPubsub::Topology).to receive(:ensure!)
      allow(NatsPubsub::Logging).to receive(:info)
      allow(NatsPubsub::Logging).to receive(:sanitize_url) { |url| url }
    end

    it 'is idempotent' do
      # First call: @nc is nil, so connected? returns nil (falsy), creates connection
      # Second call: @nc exists, so connected? should return true
      allow(mock_nc_instance).to receive(:connected?).and_return(true)

      first_call = instance.connect!
      second_call = instance.connect!

      expect(first_call).to eq(second_call)
      expect(NATS::IO::Client).to have_received(:new).once
    end

    context 'with credentials in URL' do
      before do
        allow(instance_mock_config).to receive(:nats_urls)
          .and_return('nats://user:password@localhost:4222')
        allow(NatsPubsub::Logging).to receive(:sanitize_url)
          .with('nats://user:password@localhost:4222')
          .and_return('nats://user:***@localhost:4222')
      end

      it 'sanitizes URLs in log output' do
        expect(NatsPubsub::Logging).to receive(:sanitize_url)
          .with('nats://user:password@localhost:4222')
        instance.connect!
      end

      it 'logs sanitized URL' do
        expect(NatsPubsub::Logging).to receive(:info).with(
          /nats:\/\/user:\*\*\*@localhost:4222/,
          anything
        )
        instance.connect!
      end
    end
  end

  describe 'singleton pattern' do
    it 'returns the same instance' do
      instance1 = described_class.instance
      instance2 = described_class.instance
      expect(instance1).to be(instance2)
    end

    it 'cannot be instantiated directly' do
      expect { described_class.new }.to raise_error(NoMethodError)
    end
  end
end
