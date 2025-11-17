# frozen_string_literal: true

require_relative '../core/logging'
require_relative '../models/model_utils'
require_relative 'outbox_repository'
require_relative 'publish_result'

module NatsPubsub
  # Service object responsible for publishing messages through the Outbox pattern
  # Extracts outbox publishing logic from Publisher following Single Responsibility Principle
  #
  # The Outbox pattern ensures reliable message delivery by:
  # 1. Persisting the message to the database before publishing
  # 2. Publishing to NATS
  # 3. Marking as sent in the database
  #
  # This prevents message loss if the application crashes between publishing and commit
  class OutboxPublisher
    # Publish a message using the Outbox pattern
    #
    # @param subject [String] NATS subject
    # @param envelope [Hash] Message envelope
    # @param event_id [String] Event ID
    # @param publisher_block [Proc] Block that performs the actual publish
    # @return [PublishResult] Result object
    def self.publish(subject:, envelope:, event_id:, &publisher_block)
      new(subject: subject, envelope: envelope, event_id: event_id, publisher_block: publisher_block).publish
    end

    def initialize(subject:, envelope:, event_id:, publisher_block:)
      @subject = subject
      @envelope = envelope
      @event_id = event_id
      @publisher_block = publisher_block
    end

    def publish
      # Validate outbox model configuration
      klass = ModelUtils.constantize(NatsPubsub.config.outbox_model)

      unless ModelUtils.ar_class?(klass)
        Logging.warn(
          "Outbox model #{klass} is not an ActiveRecord model; publishing directly.",
          tag: 'NatsPubsub::OutboxPublisher'
        )
        return @publisher_block.call
      end

      # Use repository pattern for database operations
      repo = OutboxRepository.new(klass)
      record = repo.find_or_build(@event_id)

      # Skip if already sent (idempotency)
      if repo.already_sent?(record)
        Logging.info(
          "Outbox already sent event_id=#{@event_id}; skipping publish.",
          tag: 'NatsPubsub::OutboxPublisher'
        )
        return PublishResult.success(event_id: @event_id, subject: @subject)
      end

      # Persist pre-publish state
      repo.persist_pre(record, @subject, @envelope)

      # Attempt to publish
      result = @publisher_block.call

      # Update record based on result
      if result.success?
        repo.persist_success(record)
      else
        repo.persist_failure(record, result.details || 'Publish failed')
      end

      result
    rescue StandardError => e
      # Persist exception if repository and record are available
      repo.persist_exception(record, e) if defined?(repo) && defined?(record)

      # Return failure result
      Logging.error(
        "Outbox publish failed: #{e.class} #{e.message}",
        tag: 'NatsPubsub::OutboxPublisher'
      )
      PublishResult.failure(
        reason: :exception,
        details: "#{e.class}: #{e.message}",
        subject: @subject,
        error: e
      )
    end

    private

    attr_reader :subject, :envelope, :event_id, :publisher_block
  end
end
