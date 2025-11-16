# frozen_string_literal: true

if defined?(RSpec)
  # RSpec matchers for NatsPubsub testing
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
end
