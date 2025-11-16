# frozen_string_literal: true

module NatsPubsub
  # Parses and validates arguments for the unified Publisher#publish interface
  # Extracts complex argument parsing logic following Single Responsibility Principle
  #
  # Supports three publishing patterns:
  # 1. Topic-based: publish(topic, message) or publish(topic:, message:)
  # 2. Domain/resource/action: publish(domain:, resource:, action:, payload:)
  # 3. Multi-topic: publish(topics:, message:)
  class PublishArgumentParser
    # Parse result containing method to call and arguments
    ParseResult = Struct.new(:method, :args, :kwargs) do
      def call(publisher)
        publisher.public_send(method, *args, **kwargs)
      end
    end

    # Parse arguments and determine which publishing method to use
    #
    # @param args [Array] Positional arguments
    # @param kwargs [Hash] Keyword arguments
    # @return [ParseResult] Parse result with method and arguments
    # @raise [ArgumentError] if arguments are invalid
    def self.parse(*args, **kwargs)
      # Multi-topic publishing
      if multi_topic?(kwargs)
        return ParseResult.new(
          :publish_to_topics,
          [kwargs[:topics], kwargs[:message]],
          kwargs.except(:topics, :message)
        )
      end

      # Domain/resource/action pattern
      if domain_resource_action?(kwargs)
        return ParseResult.new(
          :publish_event,
          [kwargs[:domain], kwargs[:resource], kwargs[:action], kwargs[:payload]],
          kwargs.except(:domain, :resource, :action, :payload)
        )
      end

      # Topic-based pattern (positional args)
      if positional_topic?(args)
        return ParseResult.new(
          :publish_to_topic,
          [args[0], args[1]],
          kwargs
        )
      end

      # Topic-based pattern (keyword args)
      if keyword_topic?(kwargs)
        return ParseResult.new(
          :publish_to_topic,
          [kwargs[:topic], kwargs[:message]],
          kwargs.except(:topic, :message)
        )
      end

      # Invalid arguments
      raise ArgumentError,
            'Invalid arguments. Use publish(topic, message, **opts) or ' \
            'publish(domain:, resource:, action:, payload:, **opts) or ' \
            'publish(topics:, message:, **opts)'
    end

    # Check if arguments match multi-topic pattern
    #
    # @param kwargs [Hash] Keyword arguments
    # @return [Boolean] True if multi-topic pattern
    def self.multi_topic?(kwargs)
      kwargs.key?(:topics) && kwargs.key?(:message)
    end
    private_class_method :multi_topic?

    # Check if arguments match domain/resource/action pattern
    #
    # @param kwargs [Hash] Keyword arguments
    # @return [Boolean] True if domain/resource/action pattern
    def self.domain_resource_action?(kwargs)
      kwargs.key?(:domain) &&
        kwargs.key?(:resource) &&
        kwargs.key?(:action) &&
        kwargs.key?(:payload)
    end
    private_class_method :domain_resource_action?

    # Check if arguments match positional topic pattern
    #
    # @param args [Array] Positional arguments
    # @return [Boolean] True if positional topic pattern
    def self.positional_topic?(args)
      args.length >= 2
    end
    private_class_method :positional_topic?

    # Check if arguments match keyword topic pattern
    #
    # @param kwargs [Hash] Keyword arguments
    # @return [Boolean] True if keyword topic pattern
    def self.keyword_topic?(kwargs)
      kwargs.key?(:topic) && kwargs.key?(:message)
    end
    private_class_method :keyword_topic?
  end
end
