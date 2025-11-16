# frozen_string_literal: true

require 'nats_pubsub/core/config'

RSpec.describe NatsPubsub::Config do
  subject(:config) { described_class.new }

  describe '#initialize' do
    context 'with default values' do
      it 'sets default nats_urls' do
        expect(config.nats_urls).to eq('nats://localhost:4222')
      end

      it 'sets default env' do
        expect(config.env).to eq('development')
      end

      it 'sets default app_name' do
        expect(config.app_name).to eq('app')
      end

      it 'sets destination_app to nil' do
        expect(config.destination_app).to be_nil
      end

      it 'sets default max_deliver' do
        expect(config.max_deliver).to eq(5)
      end

      it 'sets default ack_wait' do
        expect(config.ack_wait).to eq('30s')
      end

      it 'sets default backoff' do
        expect(config.backoff).to eq(%w[1000ms 5000ms 15000ms 30000ms 60000ms])
      end

      it 'sets use_outbox to false' do
        expect(config.use_outbox).to be false
      end

      it 'sets use_inbox to false' do
        expect(config.use_inbox).to be false
      end

      it 'sets use_dlq to true' do
        expect(config.use_dlq).to be true
      end

      it 'sets default dlq_max_attempts' do
        expect(config.dlq_max_attempts).to eq(3)
      end

      it 'sets default dlq_stream_suffix' do
        expect(config.dlq_stream_suffix).to eq('-dlq')
      end

      it 'sets default outbox_model' do
        expect(config.outbox_model).to eq('NatsPubsub::OutboxEvent')
      end

      it 'sets default inbox_model' do
        expect(config.inbox_model).to eq('NatsPubsub::InboxEvent')
      end

      it 'sets logger to nil' do
        expect(config.logger).to be_nil
      end

      it 'sets default concurrency' do
        expect(config.concurrency).to eq(5)
      end
    end

    context 'with environment variables' do
      around do |example|
        original_env = ENV.to_h
        example.run
        ENV.replace(original_env)
      end

      it 'reads NATS_URLS from environment' do
        ENV['NATS_URLS'] = 'nats://prod:4222'
        config = described_class.new
        expect(config.nats_urls).to eq('nats://prod:4222')
      end

      it 'falls back to NATS_URL if NATS_URLS not set' do
        ENV.delete('NATS_URLS')
        ENV['NATS_URL'] = 'nats://backup:4222'
        config = described_class.new
        expect(config.nats_urls).to eq('nats://backup:4222')
      end

      it 'reads NATS_ENV from environment' do
        ENV['NATS_ENV'] = 'production'
        config = described_class.new
        expect(config.env).to eq('production')
      end

      it 'reads APP_NAME from environment' do
        ENV['APP_NAME'] = 'my-service'
        config = described_class.new
        expect(config.app_name).to eq('my-service')
      end

      it 'reads DESTINATION_APP from environment' do
        ENV['DESTINATION_APP'] = 'target-service'
        config = described_class.new
        expect(config.destination_app).to eq('target-service')
      end
    end
  end

  describe '#stream_name' do
    it 'returns stream name based on environment' do
      config.env = 'production'
      expect(config.stream_name).to eq('production-events-stream')
    end

    it 'uses default environment' do
      expect(config.stream_name).to eq('development-events-stream')
    end
  end

  describe '#event_subject' do
    it 'formats event subject correctly' do
      config.env = 'test'
      config.app_name = 'app'
      subject = config.event_subject('users', 'user', 'created')
      expect(subject).to eq('test.app.users.user.created')
    end

    it 'works with different parameters' do
      config.env = 'staging'
      config.app_name = 'my-service'
      subject = config.event_subject('orders', 'order', 'updated')
      expect(subject).to eq('staging.my-service.orders.order.updated')
    end
  end

  describe '#dlq_subject' do
    it 'returns DLQ subject based on environment' do
      config.env = 'production'
      config.app_name = 'app'
      expect(config.dlq_subject).to eq('production.app.dlq')
    end

    it 'uses default environment and app_name' do
      expect(config.dlq_subject).to eq('development.app.dlq')
    end
  end

  describe '#dlq_stream_name' do
    it 'returns DLQ stream name with suffix' do
      config.env = 'production'
      expect(config.dlq_stream_name).to eq('production-events-stream-dlq')
    end

    it 'uses custom suffix' do
      config.env = 'test'
      config.dlq_stream_suffix = '-dead-letters'
      expect(config.dlq_stream_name).to eq('test-events-stream-dead-letters')
    end
  end

  describe '#durable_name' do
    it 'returns durable consumer name' do
      config.env = 'production'
      config.app_name = 'api-service'
      expect(config.durable_name).to eq('production-api-service-workers')
    end

    it 'uses default values' do
      expect(config.durable_name).to eq('development-app-workers')
    end
  end

  describe '#server_middleware' do
    it 'lazily initializes middleware chain' do
      expect(config.server_middleware).to be_a(NatsPubsub::Middleware::Chain)
    end

    it 'returns the same instance on subsequent calls' do
      first_call = config.server_middleware
      second_call = config.server_middleware
      expect(first_call).to be(second_call)
    end

    it 'yields the middleware chain when block is given' do
      yielded_middleware = nil
      config.server_middleware { |mw| yielded_middleware = mw }
      expect(yielded_middleware).to be_a(NatsPubsub::Middleware::Chain)
    end

    it 'allows middleware configuration via block' do
      test_middleware = double('TestMiddleware')
      config.server_middleware do |chain|
        allow(chain).to receive(:add).with(test_middleware)
        chain.add(test_middleware)
      end
      expect(config.server_middleware).to have_received(:add).with(test_middleware)
    end
  end

  describe 'attribute accessors' do
    it 'allows setting and getting nats_urls' do
      config.nats_urls = 'nats://custom:4222'
      expect(config.nats_urls).to eq('nats://custom:4222')
    end

    it 'allows setting and getting concurrency' do
      config.concurrency = 10
      expect(config.concurrency).to eq(10)
    end

    it 'allows setting and getting use_outbox' do
      config.use_outbox = true
      expect(config.use_outbox).to be true
    end

    it 'allows setting and getting logger' do
      logger = double('Logger')
      config.logger = logger
      expect(config.logger).to eq(logger)
    end
  end
end
