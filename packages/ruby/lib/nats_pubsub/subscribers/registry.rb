# frozen_string_literal: true

require 'singleton'
require_relative '../core/logging'
require_relative '../topology/subject_matcher'

module NatsPubsub
  module Subscribers
    # Registry for auto-discovering and managing subscriber classes.
    # Maintains a list of all subscribers and their subscription patterns.
    class Registry
      include Singleton

      def initialize
        @subscribers = []
        @mutex = Mutex.new
      end

      # Register a subscriber class
      #
      # @param subscriber_class [Class] Subscriber class to register
      def register(subscriber_class)
        @mutex.synchronize do
          unless @subscribers.include?(subscriber_class)
            @subscribers << subscriber_class
            Logging.debug(
              "Registered subscriber: #{subscriber_class.name}",
              tag: 'NatsPubsub::Subscribers::Registry'
            )
          end
        end
      end

      # Get all registered subscribers
      #
      # @return [Array<Class>] Array of subscriber classes
      def all_subscribers
        @subscribers.dup
      end

      # Find subscribers that match a given subject
      #
      # @param subject [String] NATS subject to match
      # @return [Array<Class>] Matching subscriber classes
      def subscribers_for(subject)
        @subscribers.select do |sub_class|
          sub_class.subscriptions.any? do |subscription|
            SubjectMatcher.match?(subscription[:pattern], subject)
          end
        end
      end

      # Auto-discover subscribers from Rails app
      def discover_subscribers!
        if defined?(Rails)
          # Ensure app is loaded
          Rails.application.eager_load! unless Rails.configuration.cache_classes

          # Load all subscriber files
          subscriber_paths = [
            Rails.root.join('app/subscribers/**/*_subscriber.rb'),
            Rails.root.join('app/handlers/**/*_handler.rb') # Support both names
          ]

          subscriber_paths.each do |pattern|
            Dir[pattern].each do |file|
              require_dependency file
            end
          end
        end

        # Find all classes that include Subscriber module
        discovered = ObjectSpace.each_object(Class).select do |klass|
          klass < Object && klass.included_modules.include?(NatsPubsub::Subscriber)
        end

        discovered.each { |subscriber_class| register(subscriber_class) }

        Logging.info(
          "Discovered and registered #{@subscribers.size} subscriber(s)",
          tag: 'NatsPubsub::Subscribers::Registry'
        )

        log_subscriber_details if @subscribers.any?
      end

      # Get all unique subscription patterns across all subscribers
      #
      # @return [Array<String>] Unique subscription patterns
      def all_subscription_patterns
        @subscribers.flat_map do |sub_class|
          sub_class.subscriptions.map { |sub| sub[:pattern] }
        end.uniq
      end

      # Clear all registered subscribers (useful for testing)
      def clear!
        @mutex.synchronize { @subscribers.clear }
      end

      private

      def log_subscriber_details
        @subscribers.each do |sub_class|
          patterns = sub_class.subscriptions.map { |s| s[:pattern] }.join(', ')
          Logging.info(
            "  └─ #{sub_class.name}: [#{patterns}]",
            tag: 'NatsPubsub::Subscribers::Registry'
          )
        end
      end
    end
  end
end
