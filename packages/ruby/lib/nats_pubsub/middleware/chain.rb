# frozen_string_literal: true

module NatsPubsub
  module Middleware
    # Middleware chain for processing messages through multiple middleware layers.
    # Similar to Rack middleware or Sidekiq middleware.
    class Chain
      def initialize
        @entries = []
      end

      # Add middleware to the chain
      #
      # @param klass [Class] Middleware class
      # @param args [Array] Arguments to pass to middleware constructor
      # @param kwargs [Hash] Keyword arguments to pass to middleware constructor
      def add(klass, *args, **kwargs)
        @entries << [klass, args, kwargs]
      end

      # Remove middleware from the chain
      #
      # @param klass [Class] Middleware class to remove
      def remove(klass)
        @entries.delete_if { |(k, _, _)| k == klass }
      end

      # Clear all middleware
      def clear
        @entries.clear
      end

      # Check if chain is empty
      #
      # @return [Boolean]
      def empty?
        @entries.empty?
      end

      # Get count of middleware in chain
      #
      # @return [Integer]
      def size
        @entries.size
      end

      # Invoke the middleware chain
      #
      # @param subscriber [Object] Subscriber instance
      # @param payload [Hash] Event payload
      # @param metadata [Hash] Event metadata
      # @yield Block to execute after all middleware
      def invoke(subscriber, payload, metadata, &)
        chain = build_chain
        traverse(chain, subscriber, payload, metadata, &)
      end

      private

      # Build middleware instances from entries
      #
      # @return [Array] Array of middleware instances
      def build_chain
        @entries.map do |(klass, args, kwargs)|
          if kwargs.empty?
            klass.new(*args)
          else
            klass.new(*args, **kwargs)
          end
        end
      end

      # Recursively traverse the middleware chain
      #
      # @param chain [Array] Remaining middleware in chain
      # @param subscriber [Object] Subscriber instance
      # @param payload [Hash] Event payload
      # @param metadata [Hash] Event metadata
      # @yield Block to execute at the end
      def traverse(chain, subscriber, payload, metadata, &block)
        if chain.empty?
          yield
        else
          middleware = chain.shift
          middleware.call(subscriber, payload, metadata) do
            traverse(chain, subscriber, payload, metadata, &block)
          end
        end
      end
    end
  end
end
