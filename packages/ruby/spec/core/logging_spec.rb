# frozen_string_literal: true

require 'nats_pubsub'
require 'logger'
require 'stringio'

RSpec.describe NatsPubsub::Logging do
  after { NatsPubsub.reset! }

  it 'uses configured logger' do
    io = StringIO.new
    custom_logger = Logger.new(io)
    NatsPubsub.configure(logger: custom_logger)

    described_class.info('hello', tag: 'Spec')

    io.rewind
    expect(io.string).to include('[Spec] hello')
  end

  it 'logs debug messages' do
    io = StringIO.new
    custom_logger = Logger.new(io)
    NatsPubsub.configure(logger: custom_logger)

    described_class.debug('dbg', tag: 'Spec')

    io.rewind
    expect(io.string).to include('[Spec] dbg')
  end
end
