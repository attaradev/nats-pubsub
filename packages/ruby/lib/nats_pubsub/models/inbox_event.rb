# frozen_string_literal: true

require_relative 'event_model'

begin
  require 'active_record'
rescue LoadError
  # No-op; shim defined below.
end

module NatsPubsub
  if defined?(ActiveRecord::Base)
    class InboxEvent < ActiveRecord::Base
      include EventModel

      self.table_name = 'nats_pubsub_inbox'

      # ---- Scopes for common queries ----
      scope :received, -> { where(status: 'received') if has_column?(:status) }
      scope :processing, -> { where(status: 'processing') if has_column?(:status) }
      scope :processed, -> { where(status: 'processed') if has_column?(:status) }
      scope :failed, -> { where(status: 'failed') if has_column?(:status) }
      scope :unprocessed, -> { where(status: %w[received failed]) if has_column?(:status) }

      scope :ready_to_process, lambda {
        return none unless has_column?(:status)

        where(status: 'received')
          .order(:received_at)
      }

      scope :with_errors, lambda {
        return none unless has_column?(:last_error)

        where.not(last_error: nil)
      }

      scope :by_delivery_count, lambda { |count|
        return none unless has_column?(:deliveries)

        where(deliveries: count)
      }

      scope :for_cleanup, lambda { |retention_period = 30.days.ago|
        return none unless has_column?(:status) && has_column?(:processed_at)

        where(status: 'processed')
          .where('processed_at < ?', retention_period)
      }

      scope :by_subject, ->(pattern) { where('subject LIKE ?', pattern) if has_column?(:subject) }
      scope :recent, -> { order(received_at: :desc) if has_column?(:received_at) }
      scope :oldest_first, -> { order(received_at: :asc) if has_column?(:received_at) }

      # ---- Validations (NO with_options; guard everything with procs) ----

      # Preferred dedupe key
      validates :event_id,
                presence: true,
                uniqueness: true,
                if: -> { self.class.has_column?(:event_id) }

      # Fallback to (stream, stream_seq) when event_id column not present
      validates :stream_seq,
                presence: true,
                if: -> { !self.class.has_column?(:event_id) && self.class.has_column?(:stream_seq) }

      validates :stream_seq,
                uniqueness: { scope: :stream },
                if: lambda {
                  !self.class.has_column?(:event_id) &&
                    self.class.has_column?(:stream_seq) &&
                    self.class.has_column?(:stream)
                }

      validates :stream_seq,
                uniqueness: true,
                if: lambda {
                  !self.class.has_column?(:event_id) &&
                    self.class.has_column?(:stream_seq) &&
                    !self.class.has_column?(:stream)
                }

      validates :subject,
                presence: true,
                if: -> { self.class.has_column?(:subject) }

      # ---- Defaults that do not require schema at load time ----
      before_validation do
        self.status ||= 'received' if self.class.has_column?(:status) && status.blank?
        self.received_at ||= Time.now.utc if self.class.has_column?(:received_at) && received_at.blank?
      end

      # ---- Helpers ----
      def processed?
        if self.class.has_column?(:processed_at)
          processed_at.present?
        elsif self.class.has_column?(:status)
          status == 'processed'
        else
          false
        end
      end
    end
  else
    # Shim: loud failure if AR isn't present but someone calls the model.
    InboxEvent = EventModel.create_shim('InboxEvent', 'Inbox')
  end
end
