# frozen_string_literal: true

require_relative '../core/base_repository'
require_relative '../models/model_utils'
require_relative '../core/logging'

module NatsPubsub
  # Encapsulates AR-backed outbox persistence operations.
  # Inherits common patterns from BaseRepository.
  class OutboxRepository < BaseRepository
    def already_sent?(record)
      has_attribute?(record, :sent_at) && record.sent_at
    end

    def persist_pre(record, subject, envelope)
      now = Time.now.utc
      event_id = envelope['event_id'].to_s

      attrs = build_pre_publish_attrs(record, event_id, subject, envelope, now)
      assign_attributes(record, attrs)
      save_record!(record)
    end

    def persist_success(record)
      attrs = { status: 'sent' }
      attrs[:sent_at] = Time.now.utc if has_attribute?(record, :sent_at)
      update_with_timestamp(record, attrs)
    end

    def persist_failure(record, error_msg)
      attrs = { status: 'failed', last_error: error_msg }
      update_with_timestamp(record, attrs)
    end

    def persist_exception(record, error)
      return unless record

      persist_failure(record, "#{error.class}: #{error.message}")
    rescue StandardError => e
      Logging.warn(
        "Failed to persist outbox failure: #{e.class}: #{e.message}",
        tag: 'NatsPubsub::Publisher'
      )
    end

    # Batch operations for improved performance
    def mark_batch_as_sent(records)
      return 0 if records.empty?

      ids = records.map { |r| model_utils.pk_value(r) }.compact
      return 0 if ids.empty?

      model = model_for(records.first)
      now = Time.now.utc

      attrs = { status: 'sent', updated_at: now }
      attrs[:sent_at] = now if model.has_column?(:sent_at)

      model.where(model.primary_key => ids).update_all(attrs)
    end

    def mark_batch_as_failed(records, error_msg)
      return 0 if records.empty?

      ids = records.map { |r| model_utils.pk_value(r) }.compact
      return 0 if ids.empty?

      model = model_for(records.first)

      attrs = {
        status: 'failed',
        last_error: error_msg.to_s.truncate(1000),
        updated_at: Time.now.utc
      }

      model.where(model.primary_key => ids).update_all(attrs)
    end

    def cleanup_sent_events(retention_period = 7.days.ago)
      model = outbox_model
      return 0 unless model

      scope = model.sent
      scope = scope.where('sent_at < ?', retention_period) if model.has_column?(:sent_at)
      scope.delete_all
    end

    def reset_stale_publishing(threshold = 5.minutes.ago)
      model = outbox_model
      return 0 unless model

      attrs = {
        status: 'pending',
        last_error: 'Reset from stale publishing state',
        updated_at: Time.now.utc
      }

      model.stale_publishing(threshold).update_all(attrs)
    end

    private

    def build_pre_publish_attrs(record, event_id, subject, envelope, timestamp)
      attrs = {
        event_id: event_id,
        subject: subject,
        payload: ModelUtils.json_dump(envelope),
        headers: ModelUtils.json_dump({ 'nats-msg-id' => event_id }),
        status: 'publishing',
        last_error: nil
      }
      attrs[:attempts] = 1 + (record.attempts || 0) if has_attribute?(record, :attempts)
      attrs[:enqueued_at] = (record.enqueued_at || timestamp) if has_attribute?(record, :enqueued_at)
      attrs
    end
  end
end
