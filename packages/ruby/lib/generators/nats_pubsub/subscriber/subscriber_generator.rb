# frozen_string_literal: true

require 'rails/generators'

module NatsPubsub
  module Generators
    # Subscriber generator that creates a new NatsPubsub subscriber class
    #
    # Usage:
    #   rails generate nats_pubsub:subscriber NAME [topic1 topic2...] [options]
    #
    # Examples:
    #   rails generate nats_pubsub:subscriber UserNotification
    #   rails generate nats_pubsub:subscriber OrderProcessor orders.order
    #   rails generate nats_pubsub:subscriber EmailHandler notifications.email --wildcard
    #   rails generate nats_pubsub:subscriber AuditLogger --topics=audit.user audit.order
    #
    # Options:
    #   --topics=one two three        Specify topics to subscribe to
    #   --wildcard                    Use wildcard subscription (topic.>)
    #   --skip-test                   Skip test file generation
    #
    # This will create:
    #   app/subscribers/user_notification_subscriber.rb
    #   spec/subscribers/user_notification_subscriber_spec.rb (if RSpec is detected)
    #
    # The generated subscriber will:
    #   - Include NatsPubsub::Subscriber module
    #   - Subscribe to specified topics
    #   - Implement handle method stub
    #   - Include error handling example
    class SubscriberGenerator < Rails::Generators::NamedBase
      source_root File.expand_path('templates', __dir__)
      desc 'Creates a NatsPubsub subscriber class'

      argument :topics_list, type: :array, default: [], banner: 'topic1 topic2...'

      class_option :topics, type: :array, default: [],
                            desc: 'Topics to subscribe to (alternative to positional args)'
      class_option :wildcard, type: :boolean, default: false,
                              desc: 'Use wildcard subscription (topic.>)'
      class_option :skip_test, type: :boolean, default: false,
                               desc: 'Skip test file generation'

      def create_subscriber_file
        template 'subscriber.rb.tt', File.join('app/subscribers', class_path, "#{file_name}_subscriber.rb")
        say_status :created, "app/subscribers/#{file_name}_subscriber.rb", :green
      rescue StandardError => e
        say_status :error, "Failed to create subscriber: #{e.message}", :red
        raise
      end

      def create_test_file
        return if options[:skip_test]

        if rspec_detected?
          create_rspec_file
        elsif test_unit_detected?
          create_test_unit_file
        else
          say_status :skipped, 'No test framework detected', :yellow
        end
      rescue StandardError => e
        say_status :error, "Failed to create test: #{e.message}", :red
        # Don't raise - test generation failure shouldn't stop subscriber creation
      end

      private

      def create_rspec_file
        template 'subscriber_spec.rb.tt',
                 File.join('spec/subscribers', class_path, "#{file_name}_subscriber_spec.rb")
        say_status :created, "spec/subscribers/#{file_name}_subscriber_spec.rb", :green
      end

      def create_test_unit_file
        template 'subscriber_test.rb.tt',
                 File.join('test/subscribers', class_path, "#{file_name}_subscriber_test.rb")
        say_status :created, "test/subscribers/#{file_name}_subscriber_test.rb", :green
      end

      def rspec_detected?
        File.exist?(File.join(destination_root, 'spec', 'spec_helper.rb')) ||
          File.exist?(File.join(destination_root, 'spec', 'rails_helper.rb'))
      end

      def test_unit_detected?
        File.exist?(File.join(destination_root, 'test', 'test_helper.rb'))
      end

      # Get all topics from both positional args and --topics option
      def all_topics
        combined = topics_list + options[:topics]
        combined.empty? ? default_topics : combined.uniq
      end

      # Default topics based on subscriber name
      def default_topics
        [file_name.pluralize.tr('_', '.')]
      end

      # Check if using wildcard subscription
      def use_wildcard?
        options[:wildcard]
      end

      # Generate subscription code
      def subscription_code
        if all_topics.empty?
          "  # subscribe_to 'your.topic'\n  # subscribe_to_wildcard 'your.topic'"
        elsif use_wildcard?
          all_topics.map { |topic| "  subscribe_to_wildcard '#{topic}'" }.join("\n")
        else
          all_topics.map { |topic| "  subscribe_to '#{topic}'" }.join("\n")
        end
      end

      # Generate example topic for comments
      def example_topic
        all_topics.first || 'your.topic'
      end

      # Check if subscriber name ends with 'Subscriber'
      def needs_subscriber_suffix?
        !class_name.end_with?('Subscriber')
      end

      # Get correct class name with Subscriber suffix
      def subscriber_class_name
        needs_subscriber_suffix? ? "#{class_name}Subscriber" : class_name
      end

      # Get correct file name
      def subscriber_file_name
        needs_subscriber_suffix? ? "#{file_name}_subscriber" : file_name
      end
    end
  end
end
