# frozen_string_literal: true

require_relative 'event_model'

begin
  require 'active_record'
rescue LoadError
  # No-op; shim defined below.
end

module NatsPubsub
  if defined?(ActiveRecord::Base)
    class OutboxEvent < ActiveRecord::Base
      include EventModel

      self.table_name = 'nats_pubsub_outbox'

      # ---- Scopes for common queries ----
      scope :pending, -> { where(status: 'pending') if has_column?(:status) }
      scope :publishing, -> { where(status: 'publishing') if has_column?(:status) }
      scope :sent, -> { where(status: 'sent') if has_column?(:status) }
      scope :failed, -> { where(status: 'failed') if has_column?(:status) }
      scope :unsent, -> { where(status: %w[pending failed]) if has_column?(:status) }

      scope :ready_to_publish, lambda {
        return none unless has_column?(:status) && has_column?(:enqueued_at)

        where(status: %w[pending failed])
          .where('enqueued_at <= ?', Time.current)
          .order(:enqueued_at)
      }

      scope :stale_publishing, lambda { |threshold = 5.minutes.ago|
        return none unless has_column?(:status) && has_column?(:updated_at)

        where(status: 'publishing')
          .where('updated_at < ?', threshold)
      }

      scope :for_cleanup, lambda { |retention_period = 7.days.ago|
        return none unless has_column?(:status) && has_column?(:sent_at)

        where(status: 'sent')
          .where('sent_at < ?', retention_period)
      }

      scope :by_subject, ->(pattern) { where('subject LIKE ?', pattern) if has_column?(:subject) }
      scope :recent, -> { order(created_at: :desc) }
      scope :oldest_first, -> { order(created_at: :asc) }

      # ---- Validations guarded by safe schema checks (no with_options) ----
      validates :payload,
                presence: true,
                if: -> { self.class.has_column?(:payload) }

      # Preferred path when event_id exists
      validates :event_id,
                presence: true,
                uniqueness: true,
                if: -> { self.class.has_column?(:event_id) }

      # Fallback legacy fields when event_id is absent
      validates :resource_type,
                presence: true,
                if: lambda {
                  !self.class.has_column?(:event_id) && self.class.has_column?(:resource_type)
                }

      validates :resource_id,
                presence: true,
                if: lambda {
                  !self.class.has_column?(:event_id) && self.class.has_column?(:resource_id)
                }

      validates :event_type,
                presence: true,
                if: -> { !self.class.has_column?(:event_id) && self.class.has_column?(:event_type) }

      validates :subject,
                presence: true,
                if: -> { self.class.has_column?(:subject) }

      validates :attempts,
                numericality: { only_integer: true, greater_than_or_equal_to: 0 },
                if: -> { self.class.has_column?(:attempts) }

      # ---- Defaults that do not require schema at load time ----
      before_validation do
        now = Time.now.utc
        self.status ||= 'pending' if self.class.has_column?(:status) && status.blank?
        self.enqueued_at ||= now if self.class.has_column?(:enqueued_at) && enqueued_at.blank?
        self.attempts = 0 if self.class.has_column?(:attempts) && attempts.nil?
      end

      # ---- Helpers ----
      def mark_sent!
        now = Time.now.utc
        self.status  = 'sent' if self.class.has_column?(:status)
        self.sent_at = now    if self.class.has_column?(:sent_at)
        save!
      end

      def mark_failed!(err_msg)
        self.status     = 'failed' if self.class.has_column?(:status)
        self.last_error = err_msg  if self.class.has_column?(:last_error)
        save!
      end
    end
  else
    # Shim: loud failure if AR isn't present but someone calls the model.
    OutboxEvent = EventModel.create_shim('OutboxEvent', 'Outbox')
  end
end
