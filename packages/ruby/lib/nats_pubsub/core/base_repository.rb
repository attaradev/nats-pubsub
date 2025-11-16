# frozen_string_literal: true

require_relative '../models/model_utils'
require_relative 'logging'

module NatsPubsub
  # Base repository class with common persistence patterns.
  # Follows Template Method pattern for shared persistence flow.
  # Extracted to DRY up InboxRepository and OutboxRepository.
  class BaseRepository
    attr_reader :model_class

    def initialize(model_class)
      @model_class = model_class
    end

    # Find or build a record by event_id
    #
    # @param event_id [String] Event identifier
    # @return [ActiveRecord::Base] Record instance
    def find_or_build(event_id)
      ModelUtils.find_or_init_by_best(
        model_class,
        { event_id: event_id },
        { dedup_key: event_id }
      )
    end

    protected

    # Assign attributes to record safely
    #
    # @param record [ActiveRecord::Base] Record instance
    # @param attrs [Hash] Attributes to assign
    def assign_attributes(record, attrs)
      ModelUtils.assign_known_attrs(record, attrs)
    end

    # Save record with error handling
    #
    # @param record [ActiveRecord::Base] Record instance
    # @raise [ActiveRecord::RecordInvalid] if save fails
    def save_record!(record)
      record.save!
    rescue StandardError => e
      Logging.error(
        "Failed to save #{model_class.name}: #{e.class} #{e.message}",
        tag: 'NatsPubsub::BaseRepository'
      )
      raise
    end

    # Update record with timestamp
    #
    # @param record [ActiveRecord::Base] Record instance
    # @param attrs [Hash] Attributes to update
    # @param timestamp [Time] Timestamp to use
    def update_with_timestamp(record, attrs, timestamp = Time.now.utc)
      attrs[:updated_at] = timestamp if record.respond_to?(:updated_at)
      assign_attributes(record, attrs)
      save_record!(record)
    end

    # Check if attribute exists on record
    #
    # @param record [ActiveRecord::Base] Record instance
    # @param attribute [Symbol] Attribute name
    # @return [Boolean]
    def has_attribute?(record, attribute)
      record.respond_to?(attribute)
    end
  end
end
