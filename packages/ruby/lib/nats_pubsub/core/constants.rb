# frozen_string_literal: true

module NatsPubsub
  # Centralized constants for the library
  # Extracts magic numbers and strings into named, documented constants
  module Constants
    # Timeout-related constants
    module Timeouts
      # Default acknowledgment wait time in milliseconds
      # Time before a message is considered unacknowledged and redelivered
      ACK_WAIT_DEFAULT = 30_000 # 30 seconds

      # Default idle wait time in milliseconds
      # Time to wait when no messages are available before polling again
      IDLE_WAIT_DEFAULT = 100 # 100ms

      # Default connection timeout in seconds
      CONNECTION_TIMEOUT = 5

      # Default request timeout for management operations
      MANAGEMENT_TIMEOUT = 10
    end

    # Retry strategy constants
    module Retry
      # Default exponential backoff delays in milliseconds
      # Used for retrying failed message processing
      DEFAULT_BACKOFF = [1_000, 5_000, 15_000, 30_000, 60_000].freeze

      # Maximum number of delivery attempts before sending to DLQ
      MAX_ATTEMPTS = 5

      # Base delay for transient errors (milliseconds)
      TRANSIENT_BASE_DELAY = 500

      # Base delay for persistent errors (milliseconds)
      PERSISTENT_BASE_DELAY = 2_000

      # Maximum backoff delay cap (milliseconds)
      MAX_BACKOFF_CAP = 60_000 # 60 seconds
    end

    # Dead Letter Queue constants
    module DLQ
      # Default retention period for DLQ messages (30 days in nanoseconds)
      RETENTION_PERIOD = 30 * 24 * 60 * 60 * 1_000_000_000

      # DLQ stream suffix
      STREAM_SUFFIX = '-dlq'

      # Maximum attempts before moving to DLQ
      MAX_ATTEMPTS = 3
    end

    # Stream and consumer configuration constants
    module Stream
      # Default stream retention policy
      RETENTION_POLICY = 'limits' # limits, interest, workqueue

      # Default storage type
      STORAGE_TYPE = 'file' # file or memory

      # Default max message age (7 days in nanoseconds)
      MAX_AGE = 7 * 24 * 60 * 60 * 1_000_000_000

      # Default max messages per stream
      MAX_MESSAGES = 1_000_000

      # Default max bytes per stream (1GB)
      MAX_BYTES = 1_073_741_824
    end

    # Consumer configuration constants
    module Consumer
      # Default concurrency level
      DEFAULT_CONCURRENCY = 5

      # Minimum concurrency
      MIN_CONCURRENCY = 1

      # Maximum concurrency (prevents resource exhaustion)
      MAX_CONCURRENCY = 1000

      # Default batch size for pull consumers
      BATCH_SIZE = 10

      # Maximum batch size
      MAX_BATCH_SIZE = 256
    end

    # Subject pattern constants
    module Subject
      # Wildcard for matching one level
      SINGLE_LEVEL_WILDCARD = '*'

      # Wildcard for matching multiple levels
      MULTI_LEVEL_WILDCARD = '>'

      # Subject token separator
      SEPARATOR = '.'

      # Maximum subject length
      MAX_LENGTH = 255
    end

    # Envelope schema constants
    module Envelope
      # Current schema version
      SCHEMA_VERSION = 1

      # Required envelope fields
      REQUIRED_FIELDS = %w[
        event_id
        schema_version
        producer
        occurred_at
      ].freeze

      # Topic envelope required fields
      TOPIC_REQUIRED_FIELDS = (REQUIRED_FIELDS + %w[topic message]).freeze

      # Event envelope required fields (legacy)
      EVENT_REQUIRED_FIELDS = (REQUIRED_FIELDS + %w[domain resource action payload]).freeze
    end

    # Error classification constants
    module Errors
      # Errors that should not be retried
      UNRECOVERABLE_ERRORS = [
        'ArgumentError',
        'TypeError',
        'NoMethodError',
        'NameError',
        'SyntaxError'
      ].freeze

      # Errors indicating malformed messages
      MALFORMED_ERRORS = [
        'JSON::ParserError',
        'Oj::ParseError',
        'EncodingError'
      ].freeze

      # Transient errors that should be retried
      TRANSIENT_ERRORS = [
        'Timeout::Error',
        'IOError',
        'Errno::ECONNREFUSED',
        'Errno::ETIMEDOUT',
        'NATS::IO::Timeout',
        'NATS::IO::Error'
      ].freeze
    end

    # Logging constants
    module Logging
      # Default log level
      DEFAULT_LEVEL = :info

      # Log levels
      LEVELS = %i[debug info warn error fatal].freeze

      # Structured log field names
      FIELDS = {
        event_id: 'event_id',
        trace_id: 'trace_id',
        subject: 'subject',
        topic: 'topic',
        delivery_count: 'delivery_count',
        elapsed_ms: 'elapsed_ms',
        error_class: 'error_class',
        error_message: 'error_message'
      }.freeze
    end

    # Health check constants
    module HealthCheck
      # Quick check timeout (seconds)
      QUICK_TIMEOUT = 5

      # Full check timeout (seconds)
      FULL_TIMEOUT = 30

      # Health check statuses
      HEALTHY = 'healthy'
      DEGRADED = 'degraded'
      UNHEALTHY = 'unhealthy'
    end
  end
end
