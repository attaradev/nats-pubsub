# frozen_string_literal: true

if defined?(RSpec)
  # RSpec matchers for NatsPubsub testing

  # Matcher for checking if an event was published
  #
  # @example
  #   expect { user.save }.to have_published_event('users', 'user', 'created')
  RSpec::Matchers.define :have_published_event do |domain, resource, action|
    match do |_actual|
      NatsPubsub::Testing.published_events.any? do |event|
        event[:domain] == domain &&
          event[:resource] == resource &&
          event[:action] == action
      end
    end

    failure_message do
      published = NatsPubsub::Testing.published_events
                                     .map { |e| "#{e[:domain]}.#{e[:resource]}.#{e[:action]}" }
                                     .join(', ')

      if published.empty?
        "expected to publish #{domain}.#{resource}.#{action}, but no events were published"
      else
        "expected to publish #{domain}.#{resource}.#{action}, but published: #{published}"
      end
    end

    supports_block_expectations
  end

  # Matcher for checking event payload
  #
  # @example
  #   expect { user.save }.to have_published_event_with_payload('users', 'user', 'created', id: 1)
  RSpec::Matchers.define :have_published_event_with_payload do |domain, resource, action, expected_payload|
    match do |_actual|
      NatsPubsub::Testing.published_events.any? do |event|
        next false unless event[:domain] == domain &&
                          event[:resource] == resource &&
                          event[:action] == action

        # Check if expected payload is a subset of actual payload
        expected_payload.all? do |key, value|
          event[:payload][key] == value
        end
      end
    end

    failure_message do
      matching_events = NatsPubsub::Testing.published_events.select do |e|
        e[:domain] == domain && e[:resource] == resource && e[:action] == action
      end

      if matching_events.empty?
        "expected to publish #{domain}.#{resource}.#{action} with payload #{expected_payload.inspect}, " \
          "but no matching events were published"
      else
        "expected to publish #{domain}.#{resource}.#{action} with payload #{expected_payload.inspect}, " \
          "but got: #{matching_events.map { |e| e[:payload] }.inspect}"
      end
    end

    supports_block_expectations
  end

  # Matcher for checking outbox event creation
  #
  # @example
  #   expect { publisher.publish('users', 'user', 'created', id: 1) }
  #     .to enqueue_outbox_event
  #
  # @example with subject matching
  #   expect { publisher.publish('users', 'user', 'created', id: 1) }
  #     .to enqueue_outbox_event.with_subject_matching(/users\.user\.created/)
  RSpec::Matchers.define :enqueue_outbox_event do
    chain :with_subject_matching do |pattern|
      @subject_pattern = pattern
    end

    chain :with_status do |status|
      @status = status
    end

    chain :with_payload_including do |expected_payload|
      @expected_payload = expected_payload
    end

    match do |block|
      @outbox_model = NatsPubsub.config.outbox_model.constantize
      @before_count = @outbox_model.count

      block.call

      @after_count = @outbox_model.count
      @new_events = @outbox_model.last(@after_count - @before_count)

      return false if @new_events.empty?

      @matching_event = @new_events.find do |event|
        matches_criteria?(event)
      end

      !@matching_event.nil?
    end

    def matches_criteria?(event)
      return false if @subject_pattern && !event.subject.match?(@subject_pattern)
      return false if @status && event.status != @status

      if @expected_payload
        payload = parse_payload(event.payload)
        return false unless payload_matches?(payload, @expected_payload)
      end

      true
    end

    def parse_payload(payload)
      case payload
      when String
        JSON.parse(payload).deep_symbolize_keys
      when Hash
        payload.deep_symbolize_keys
      else
        payload
      end
    rescue JSON::ParserError
      payload
    end

    def payload_matches?(actual, expected)
      expected.all? do |key, value|
        actual[key] == value
      end
    end

    failure_message do
      if @new_events.empty?
        "expected to enqueue outbox event, but no new events were created"
      else
        msg = "expected to enqueue outbox event"
        msg += " with subject matching #{@subject_pattern.inspect}" if @subject_pattern
        msg += " with status #{@status.inspect}" if @status
        msg += " with payload including #{@expected_payload.inspect}" if @expected_payload
        msg += ", but got:\n"
        @new_events.each do |event|
          msg += "  - subject: #{event.subject}, status: #{event.status}\n"
        end
        msg
      end
    end

    supports_block_expectations
  end

  # Matcher for checking subscriber registration
  #
  # @example
  #   expect(UserSubscriber).to subscribe_to('development.app.users.user.>')
  RSpec::Matchers.define :subscribe_to do |subject_pattern|
    match do |subscriber_class|
      return false unless subscriber_class.respond_to?(:subjects)

      @actual_subjects = subscriber_class.subjects
      @actual_subjects.any? do |subject|
        subject_matches?(subject, subject_pattern)
      end
    end

    def subject_matches?(actual, expected)
      # Exact match
      return true if actual == expected

      # Wildcard matching
      actual_parts = actual.split('.')
      expected_parts = expected.split('.')

      return false if expected_parts.last != '>' && actual_parts.size != expected_parts.size

      expected_parts.each_with_index do |expected_part, i|
        actual_part = actual_parts[i]

        case expected_part
        when '*'
          next
        when '>'
          return true
        else
          return false if actual_part != expected_part
        end
      end

      true
    end

    failure_message do
      "expected #{subscriber_class} to subscribe to #{subject_pattern.inspect}, " \
        "but subscribed to: #{@actual_subjects.inspect}"
    end

    failure_message_when_negated do
      "expected #{subscriber_class} not to subscribe to #{subject_pattern.inspect}"
    end
  end
end
