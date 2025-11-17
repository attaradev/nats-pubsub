# frozen_string_literal: true

require_relative '../core/logging'
require_relative 'subject_matcher'

module NatsPubsub
  # Utility module providing helper methods for stream management.
  # Extracted from Stream class to follow Single Responsibility Principle.
  #
  # This module provides:
  # - Subject normalization and filtering utilities
  # - NATS error detection helpers
  # - Structured logging for stream operations
  #
  # @example Normalizing subjects
  #   StreamSupport.normalize_subjects(['foo.bar', nil, '', 'baz'])
  #   # => ['foo.bar', 'baz']
  #
  # @example Checking for missing subjects
  #   existing = ['foo.*', 'bar.>']
  #   desired = ['foo.bar', 'baz.qux']
  #   StreamSupport.missing_subjects(existing, desired)
  #   # => ['baz.qux'] (foo.bar is covered by foo.*)
  module StreamSupport
    module_function

    # Normalize a list of subjects
    #
    # Flattens nested arrays, removes nils, empty strings, converts to strings,
    # and returns unique values.
    #
    # @param list [Array, Object] List of subjects (can be nested)
    # @return [Array<String>] Normalized unique subject list
    def normalize_subjects(list)
      Array(list).flatten.compact.map!(&:to_s).reject(&:empty?).uniq
    end

    # Find subjects from desired list not covered by existing patterns
    #
    # Uses SubjectMatcher to determine if each desired subject is covered
    # by any of the existing subject patterns (including wildcards).
    #
    # @param existing [Array<String>] Existing subject patterns
    # @param desired [Array<String>] Desired subjects to check
    # @return [Array<String>] Subjects not covered by existing patterns
    def missing_subjects(existing, desired)
      desired.reject { |d| SubjectMatcher.covered?(existing, d) }
    end

    # Check if error indicates stream not found
    #
    # Detects NATS JetStream "stream not found" errors by examining
    # the error message for known patterns.
    #
    # @param error [Exception] Error object
    # @return [Boolean] True if error indicates stream not found
    def stream_not_found?(error)
      msg = error.message.to_s
      msg =~ /stream\s+not\s+found/i || msg =~ /\b404\b/
    end

    # Check if error indicates subject overlap
    #
    # Detects NATS JetStream subject overlap errors, which occur when
    # attempting to add subjects that conflict with existing streams.
    #
    # @param error [Exception] Error object
    # @return [Boolean] True if error indicates subject overlap
    def overlap_error?(error)
      msg = error.message.to_s
      msg =~ /subjects?\s+overlap/i || msg =~ /\berr_code=10065\b/ || msg =~ /\b400\b/
    end

    # Log when stream subjects are already covered
    #
    # @param name [String] Stream name
    # @return [void]
    def log_already_covered(name)
      Logging.info(
        "Stream #{name} exists; subjects and config already covered.",
        tag: 'NatsPubsub::Stream'
      )
    end

    # Log when all subjects are blocked by overlap
    #
    # @param name [String] Stream name
    # @param blocked [Array<String>] Blocked subjects
    # @return [void]
    def log_all_blocked(name, blocked)
      if blocked.any?
        Logging.warn(
          "Stream #{name}: all missing subjects belong to other streams; unchanged. blocked=#{blocked.inspect}",
          tag: 'NatsPubsub::Stream'
        )
      else
        Logging.info("Stream #{name} exists; nothing to add.", tag: 'NatsPubsub::Stream')
      end
    end

    # Log when stream is updated with new subjects
    #
    # @param name [String] Stream name
    # @param added [Array<String>] Successfully added subjects
    # @param blocked [Array<String>] Blocked subjects
    # @return [void]
    def log_updated(name, added, blocked)
      msg = "Updated stream #{name}; added subjects=#{added.inspect}"
      msg += " (skipped overlapped=#{blocked.inspect})" if blocked.any?
      Logging.info(msg, tag: 'NatsPubsub::Stream')
    end

    # Log when stream creation is skipped due to overlaps
    #
    # @param name [String] Stream name
    # @param blocked [Array<String>] Blocked subjects
    # @return [void]
    def log_not_created(name, blocked)
      Logging.warn(
        "Not creating stream #{name}: all desired subjects belong to other streams. blocked=#{blocked.inspect}",
        tag: 'NatsPubsub::Stream'
      )
    end

    # Log when stream is successfully created
    #
    # @param name [String] Stream name
    # @param allowed [Array<String>] Allowed subjects
    # @param blocked [Array<String>] Blocked subjects
    # @param retention [String] Retention policy
    # @param storage [String] Storage type
    # @return [void]
    def log_created(name, allowed, blocked, retention, storage)
      msg = [
        "Created stream #{name}",
        "subjects=#{allowed.inspect}",
        "retention=#{retention.inspect}",
        "storage=#{storage.inspect}"
      ].join(' ')
      msg += " (skipped overlapped=#{blocked.inspect})" if blocked.any?
      Logging.info(msg, tag: 'NatsPubsub::Stream')
    end

    # Log when stream config is updated
    #
    # @param name [String] Stream name
    # @param storage [String] Storage type
    # @return [void]
    def log_config_updated(name, storage:)
      Logging.info(
        "Updated stream #{name} config; storage=#{storage.inspect}",
        tag: 'NatsPubsub::Stream'
      )
    end

    # Log retention policy mismatch warning
    #
    # @param name [String] Stream name
    # @param have [String] Current retention policy
    # @param want [String] Desired retention policy
    # @return [void]
    def log_retention_mismatch(name, have:, want:)
      Logging.warn(
        "Stream #{name} retention mismatch (have=#{have.inspect}, want=#{want.inspect}). " \
        "Retention is immutable; skipping retention change.",
        tag: 'NatsPubsub::Stream'
      )
    end
  end
end
