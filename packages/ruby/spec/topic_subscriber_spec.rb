# frozen_string_literal: true

require 'nats_pubsub'

RSpec.describe NatsPubsub::Subscriber, 'topic functionality' do
  before do
    NatsPubsub.reset!
    NatsPubsub.configure do |c|
      c.env = 'test'
      c.app_name = 'test-app'
    end
  end

  after { NatsPubsub.reset! }

  describe 'subscribe_to_topic' do
    it 'subscribes to a simple topic' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.length).to eq(1)
      expect(subscriptions.first[:pattern]).to eq('test.test-app.notifications')
      expect(subscriptions.first[:topic]).to eq('notifications')
      expect(subscriptions.first[:type]).to eq(:topic)
    end

    it 'subscribes to a hierarchical topic' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications.email'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.notifications.email')
      expect(subscriptions.first[:topic]).to eq('notifications.email')
    end

    it 'subscribes to multi-level hierarchical topic' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'order.processing.completed'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.order.processing.completed')
    end

    it 'normalizes topic names' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'USER@EVENTS!'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.user_events_')
    end

    it 'preserves dots in hierarchical topics' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'analytics.user.signup'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.analytics.user.signup')
    end

    it 'preserves wildcards in topic names' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications.*'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.notifications.*')
    end

    it 'accepts subscription options' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications', ack_wait: 60

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:options]).to eq({ ack_wait: 60 })
    end
  end

  describe 'subscribe_to_topics' do
    it 'subscribes to multiple topics' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topics 'notifications', 'audit.events'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.length).to eq(2)
      expect(subscriptions[0][:pattern]).to eq('test.test-app.notifications')
      expect(subscriptions[1][:pattern]).to eq('test.test-app.audit.events')
    end

    it 'accepts subscription options' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topics 'topic1', 'topic2', ack_wait: 60

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.length).to eq(2)
      expect(subscriptions[0][:options]).to eq({ ack_wait: 60 })
      expect(subscriptions[1][:options]).to eq({ ack_wait: 60 })
    end
  end

  describe 'subscribe_to_topic_wildcard' do
    it 'subscribes with wildcard pattern' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic_wildcard 'notifications'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.length).to eq(1)
      expect(subscriptions.first[:pattern]).to eq('test.test-app.notifications.>')
      expect(subscriptions.first[:topic]).to eq('notifications')
      expect(subscriptions.first[:type]).to eq(:topic_wildcard)
    end

    it 'subscribes to nested wildcard' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic_wildcard 'order.processing'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.order.processing.>')
    end

    it 'accepts subscription options' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic_wildcard 'notifications', ack_wait: 60

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:options]).to eq({ ack_wait: 60 })
    end
  end

  describe 'subscribe_to_event' do
    it 'maps domain/resource/action to topic' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_event domain: 'users', resource: 'user', action: 'created'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.length).to eq(1)
      expect(subscriptions.first[:pattern]).to eq('test.test-app.users.user.created')
      expect(subscriptions.first[:topic]).to eq('users.user.created')
    end

    it 'supports wildcard actions' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_event domain: 'users', resource: 'user', action: '*'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('test.test-app.users.user.*')
    end

    it 'accepts subscription options' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_event domain: 'users', resource: 'user', action: 'created', ack_wait: 60

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:options]).to eq({ ack_wait: 60 })
    end
  end

  describe 'jetstream_options' do
    it 'sets default jetstream options' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications'

        def call(message, metadata); end
      end

      options = subscriber_class.jetstream_options
      expect(options).to include(
        retry: 5,
        ack_wait: 30,
        max_deliver: 5,
        dead_letter: true,
        batch_size: 25
      )
    end

    it 'allows customization of jetstream options' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications'
        jetstream_options retry: 3, ack_wait: 60

        def call(message, metadata); end
      end

      options = subscriber_class.jetstream_options
      expect(options).to include(
        retry: 3,
        ack_wait: 60
      )
    end
  end

  describe 'all_subscriptions' do
    it 'combines topic and legacy subscriptions' do
      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications'
        subscribe_to 'test.myapp.users.user.*'

        def call(message, metadata); end
      end

      all = subscriber_class.all_subscriptions
      expect(all.length).to eq(2)
      expect(all[0][:pattern]).to eq('test.test-app.notifications')
      expect(all[1][:pattern]).to eq('test.myapp.users.user.*')
    end
  end

  describe 'instance methods' do
    let(:subscriber_class) do
      Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topics 'notifications.email', 'notifications.sms'

        def call(message, metadata)
          # Custom implementation
        end
      end
    end

    let(:subscriber) { subscriber_class.new }

    describe '#from_topic?' do
      it 'returns true for matching topic' do
        metadata = { topic: 'notifications.email' }
        expect(subscriber.from_topic?(metadata, 'notifications.email')).to be true
      end

      it 'returns false for non-matching topic' do
        metadata = { topic: 'notifications.email' }
        expect(subscriber.from_topic?(metadata, 'notifications.sms')).to be false
      end
    end

    describe '#from_event?' do
      it 'returns true for matching domain/resource/action' do
        metadata = {
          domain: 'users',
          resource: 'user',
          action: 'created'
        }
        expect(
          subscriber.from_event?(metadata, domain: 'users', resource: 'user', action: 'created')
        ).to be true
      end

      it 'returns false for non-matching event' do
        metadata = {
          domain: 'users',
          resource: 'user',
          action: 'created'
        }
        expect(
          subscriber.from_event?(metadata, domain: 'users', resource: 'user', action: 'updated')
        ).to be false
      end
    end

    describe '#logger' do
      it 'returns configured logger' do
        expect(subscriber.logger).not_to be_nil
      end
    end

    describe '#call' do
      it 'raises NotImplementedError if not overridden' do
        base_subscriber = Class.new do
          include NatsPubsub::Subscriber

          subscribe_to_topic 'test'
        end

        expect do
          base_subscriber.new.call({}, {})
        end.to raise_error(NotImplementedError)
      end
    end
  end

  describe 'cross-environment support' do
    it 'works with different environments' do
      NatsPubsub.configure do |c|
        c.env = 'production'
        c.app_name = 'prod-app'
      end

      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic 'notifications'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('production.prod-app.notifications')
    end

    it 'creates wildcard subscribers in different environments' do
      NatsPubsub.configure do |c|
        c.env = 'staging'
        c.app_name = 'staging-app'
      end

      subscriber_class = Class.new do
        include NatsPubsub::Subscriber

        subscribe_to_topic_wildcard 'notifications'

        def call(message, metadata); end
      end

      subscriptions = subscriber_class.topic_subscriptions
      expect(subscriptions.first[:pattern]).to eq('staging.staging-app.notifications.>')
    end
  end
end
