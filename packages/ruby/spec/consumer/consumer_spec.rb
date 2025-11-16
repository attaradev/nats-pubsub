# frozen_string_literal: true

require 'nats_pubsub'

RSpec.describe NatsPubsub::Consumer do
  let(:jts) { double('jetstream') }
  let(:subscription) { double('subscription') }
  let(:sub_mgr) { instance_double(NatsPubsub::SubscriptionManager) }
  let(:processor) { instance_double(NatsPubsub::MessageProcessor) }

  before do
    NatsPubsub.reset!
    NatsPubsub.configure { |c| c.destination_app = 'dest' }
    allow(NatsPubsub::Connection).to receive(:connect!).and_return(jts)
    allow(NatsPubsub::SubscriptionManager).to receive(:new).and_return(sub_mgr)
    allow(NatsPubsub::MessageProcessor).to receive(:new).and_return(processor)
    allow(sub_mgr).to receive(:ensure_consumer!)
    allow(sub_mgr).to receive(:subscribe!).and_return(subscription)
    allow(processor).to receive(:handle_message)
  end

  after { NatsPubsub.reset! }

  describe 'initialization' do
    it 'ensures and subscribes the consumer' do
      described_class.new { |*| nil }
      expect(NatsPubsub::SubscriptionManager)
        .to have_received(:new)
        .with(jts, NatsPubsub.config.durable_name, NatsPubsub.config, { filter_subject: nil })
      expect(sub_mgr).to have_received(:ensure_consumer!)
      expect(sub_mgr).to have_received(:subscribe!)
    end
  end

  describe '#process_batch' do
    subject(:consumer) { described_class.new { |*| nil } }

    it 'processes fetched messages' do
      msg1 = double('msg1')
      msg2 = double('msg2')
      allow(subscription).to receive(:fetch).and_return([msg1, msg2])

      expect(processor).to receive(:handle_message).with(msg1).ordered
      expect(processor).to receive(:handle_message).with(msg2).ordered

      expect(consumer.send(:process_batch)).to eq(2)
    end

    it 'recovers subscription on recoverable JetStream error' do
      err = NATS::JetStream::Error.new('consumer not found')
      allow(subscription).to receive(:fetch).and_raise(err)

      expect(consumer.send(:process_batch)).to eq(0)
      expect(sub_mgr).to have_received(:ensure_consumer!).twice
      expect(sub_mgr).to have_received(:subscribe!).twice
    end
  end
end
