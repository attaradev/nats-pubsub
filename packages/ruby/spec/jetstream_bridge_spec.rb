# frozen_string_literal: true

require 'nats_pubsub'

RSpec.describe NatsPubsub do
  describe '.ensure_topology!' do
    it 'connects and returns the jetstream context' do
      jts = double('jetstream')
      expect(NatsPubsub::Connection).to receive(:connect!).and_return(jts)
      expect(NatsPubsub::Connection).to receive(:jetstream).and_return(jts)
      expect(described_class.ensure_topology!).to eq(jts)
    end
  end
end
