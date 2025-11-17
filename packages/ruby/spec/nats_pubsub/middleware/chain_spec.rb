# frozen_string_literal: true

require 'nats_pubsub/middleware/chain'

RSpec.describe NatsPubsub::Middleware::Chain do
  subject(:chain) { described_class.new }

  # Test middleware class
  class TestMiddleware
    def initialize(*args, **kwargs)
      @args = args
      @kwargs = kwargs
    end

    attr_reader :args, :kwargs

    def call(_subscriber, _payload, _metadata)
      yield
    end
  end

  # Middleware that tracks execution order
  class OrderMiddleware
    def initialize(name, tracker)
      @name = name
      @tracker = tracker
    end

    def call(_subscriber, _payload, _metadata)
      @tracker << "before_#{@name}"
      yield
      @tracker << "after_#{@name}"
    end
  end

  # Middleware that can modify payload
  class ModifyMiddleware
    def call(_subscriber, payload, _metadata)
      payload[:modified] = true
      yield
    end
  end

  # Middleware that can short-circuit
  class ShortCircuitMiddleware
    def call(_subscriber, _payload, _metadata)
      # Don't yield, short-circuit the chain
    end
  end

  describe '#initialize' do
    it 'creates an empty chain' do
      expect(chain.empty?).to be true
      expect(chain.size).to eq(0)
    end
  end

  describe '#add' do
    it 'adds middleware to the chain' do
      chain.add(TestMiddleware)
      expect(chain.size).to eq(1)
      expect(chain.empty?).to be false
    end

    it 'adds middleware with arguments' do
      chain.add(TestMiddleware, 'arg1', 'arg2')
      expect(chain.size).to eq(1)
    end

    it 'adds middleware with keyword arguments' do
      chain.add(TestMiddleware, foo: 'bar', baz: 'qux')
      expect(chain.size).to eq(1)
    end

    it 'adds middleware with both positional and keyword arguments' do
      chain.add(TestMiddleware, 'arg1', foo: 'bar')
      expect(chain.size).to eq(1)
    end

    it 'allows adding multiple middleware' do
      chain.add(TestMiddleware)
      chain.add(TestMiddleware)
      chain.add(TestMiddleware)
      expect(chain.size).to eq(3)
    end
  end

  describe '#remove' do
    before do
      chain.add(TestMiddleware)
      chain.add(OrderMiddleware, 'test', [])
      chain.add(TestMiddleware)
    end

    it 'removes middleware by class' do
      expect(chain.size).to eq(3)
      chain.remove(TestMiddleware)
      expect(chain.size).to eq(1)
    end

    it 'removes all instances of the middleware class' do
      chain.add(TestMiddleware)
      expect(chain.size).to eq(4)
      chain.remove(TestMiddleware)
      expect(chain.size).to eq(1)
    end

    it 'does nothing if middleware class not in chain' do
      expect(chain.size).to eq(3)
      chain.remove(ModifyMiddleware)
      expect(chain.size).to eq(3)
    end
  end

  describe '#clear' do
    before do
      chain.add(TestMiddleware)
      chain.add(OrderMiddleware, 'test', [])
      chain.add(ModifyMiddleware)
    end

    it 'removes all middleware' do
      expect(chain.size).to eq(3)
      chain.clear
      expect(chain.size).to eq(0)
      expect(chain.empty?).to be true
    end
  end

  describe '#empty?' do
    it 'returns true for empty chain' do
      expect(chain.empty?).to be true
    end

    it 'returns false for non-empty chain' do
      chain.add(TestMiddleware)
      expect(chain.empty?).to be false
    end
  end

  describe '#size' do
    it 'returns 0 for empty chain' do
      expect(chain.size).to eq(0)
    end

    it 'returns correct size for chain with middleware' do
      chain.add(TestMiddleware)
      chain.add(OrderMiddleware, 'test', [])
      expect(chain.size).to eq(2)
    end
  end

  describe '#invoke' do
    let(:subscriber) { double('Subscriber') }
    let(:payload) { { data: 'test' } }
    let(:metadata) { { subject: 'test.subject' } }

    context 'with empty chain' do
      it 'executes the block immediately' do
        block_executed = false
        chain.invoke(subscriber, payload, metadata) do
          block_executed = true
        end
        expect(block_executed).to be true
      end
    end

    context 'with single middleware' do
      it 'executes middleware and block' do
        chain.add(TestMiddleware)
        block_executed = false
        chain.invoke(subscriber, payload, metadata) do
          block_executed = true
        end
        expect(block_executed).to be true
      end
    end

    context 'with multiple middleware' do
      it 'executes middleware in correct order' do
        tracker = []
        chain.add(OrderMiddleware, 'first', tracker)
        chain.add(OrderMiddleware, 'second', tracker)
        chain.add(OrderMiddleware, 'third', tracker)

        chain.invoke(subscriber, payload, metadata) do
          tracker << 'block'
        end

        expect(tracker).to eq([
          'before_first',
          'before_second',
          'before_third',
          'block',
          'after_third',
          'after_second',
          'after_first'
        ])
      end
    end

    context 'with middleware that modifies payload' do
      it 'allows middleware to modify payload' do
        chain.add(ModifyMiddleware)
        chain.invoke(subscriber, payload, metadata) {}
        expect(payload[:modified]).to be true
      end
    end

    context 'with middleware that short-circuits' do
      it 'stops execution if middleware does not yield' do
        tracker = []
        chain.add(ShortCircuitMiddleware)
        chain.add(OrderMiddleware, 'after_short_circuit', tracker)

        block_executed = false
        chain.invoke(subscriber, payload, metadata) do
          block_executed = true
        end

        expect(tracker).to eq([])
        expect(block_executed).to be false
      end
    end

    context 'with middleware initialization' do
      it 'initializes middleware with positional arguments' do
        allow(TestMiddleware).to receive(:new).and_call_original
        chain.add(TestMiddleware, 'arg1', 'arg2')
        chain.invoke(subscriber, payload, metadata) {}
        expect(TestMiddleware).to have_received(:new).with('arg1', 'arg2')
      end

      it 'initializes middleware with keyword arguments' do
        allow(TestMiddleware).to receive(:new).and_call_original
        chain.add(TestMiddleware, foo: 'bar')
        chain.invoke(subscriber, payload, metadata) {}
        expect(TestMiddleware).to have_received(:new).with(foo: 'bar')
      end

      it 'initializes middleware with both types of arguments' do
        allow(TestMiddleware).to receive(:new).and_call_original
        chain.add(TestMiddleware, 'arg1', foo: 'bar')
        chain.invoke(subscriber, payload, metadata) {}
        expect(TestMiddleware).to have_received(:new).with('arg1', foo: 'bar')
      end
    end

    it 'builds new middleware instances on each invocation' do
      chain.add(TestMiddleware)

      first_instance = nil
      chain.invoke(subscriber, payload, metadata) do
        # Capture instance during first call
        first_instance = chain.send(:build_chain).first
      end

      second_instance = nil
      chain.invoke(subscriber, payload, metadata) do
        # Capture instance during second call
        second_instance = chain.send(:build_chain).first
      end

      expect(first_instance).not_to be(second_instance)
    end

    it 'passes subscriber to middleware' do
      received_subscriber = nil
      chain.add(Class.new do
        define_method(:call) do |subscriber, _payload, _metadata, &block|
          received_subscriber = subscriber
          block.call
        end
      end)

      chain.invoke(subscriber, payload, metadata) {}
      expect(received_subscriber).to eq(subscriber)
    end

    it 'passes payload to middleware' do
      received_payload = nil
      chain.add(Class.new do
        define_method(:call) do |_subscriber, payload, _metadata, &block|
          received_payload = payload
          block.call
        end
      end)

      chain.invoke(subscriber, payload, metadata) {}
      expect(received_payload).to eq(payload)
    end

    it 'passes metadata to middleware' do
      received_metadata = nil
      chain.add(Class.new do
        define_method(:call) do |_subscriber, _payload, metadata, &block|
          received_metadata = metadata
          block.call
        end
      end)

      chain.invoke(subscriber, payload, metadata) {}
      expect(received_metadata).to eq(metadata)
    end
  end
end
