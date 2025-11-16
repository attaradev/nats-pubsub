# frozen_string_literal: true

require_relative 'publisher/publisher'

module NatsPubsub
  # Publisher for topic-based messaging
  # Alias for Publisher class for backward compatibility
  class TopicPublisher < Publisher
  end
end
