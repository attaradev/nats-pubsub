# frozen_string_literal: true

require 'oj'
require 'securerandom'
require_relative '../core/connection'
require_relative '../core/logging'
require_relative '../core/config'
require_relative '../core/model_utils'
require_relative 'outbox_repository'

module NatsPubsub
  # Publisher for PubSub events
  # Uses topic-based messaging as the foundation with domain/resource/action as a convenience layer
  class Publisher
    DEFAULT_RETRIES = 2
    RETRY_BACKOFFS  = [0.25, 1.0].freeze

    TRANSIENT_ERRORS = begin
      errs = [NATS::IO::Timeout, NATS::IO::Error]
      errs << NATS::IO::SocketTimeoutError if defined?(NATS::IO::SocketTimeoutError)
      errs.freeze
    end

    def initialize
      @jts = Connection.connect!
    end

    # ===== Topic-Based Publishing (Foundation) =====

    # Publish a message to a specific topic
    # @param topic [String] Topic name, supports dot notation for hierarchy
    # @param message [Hash] Message payload
    # @param options [Hash] Additional options (event_id, trace_id, occurred_at, message_type)
    # @return [Boolean]
    #
    # @example Simple topic
    #   publisher.publish_to_topic('notifications', { text: 'Hello', user_id: 123 })
    #
    # @example Hierarchical topic
    #   publisher.publish_to_topic('notifications.email', { to: 'user@example.com', subject: 'Welcome' })
    #   publisher.publish_to_topic('users.user.created', { id: 123, name: 'John' })
    #
    # @example With message type for additional filtering
    #   publisher.publish_to_topic('notifications.sms', { phone: '+1234567890' }, message_type: 'urgent')
    def publish_to_topic(topic, message, **options)
      subject = build_topic_subject(topic)
      envelope = build_topic_envelope(topic, message, options)

      if NatsPubsub.config.use_outbox
        publish_via_outbox(subject, envelope)
      else
        with_retries { do_publish?(subject, envelope) }
      end
    rescue StandardError => e
      log_error(false, e)
    end

    # Publish to multiple topics at once
    # @param topics [Array<String>] Array of topic names
    # @param message [Hash] Message payload
    # @param options [Hash] Additional options
    # @return [Hash] Results hash with topic => success boolean
    #
    # @example
    #   publisher.publish_to_topics(['notifications', 'audit.user_events'], { action: 'user_login' })
    def publish_to_topics(topics, message, **options)
      results = {}
      topics.each do |topic|
        results[topic] = publish_to_topic(topic, message, **options)
      end
      results
    end

    # ===== Domain/Resource/Action Layer (Convenience) =====

    # Publish a PubSub event using domain/resource/action pattern
    # This is a convenience method that maps to topic-based publishing internally
    #
    # @param domain [String] Domain (e.g., 'users', 'orders')
    # @param resource [String] Resource type (e.g., 'user', 'order')
    # @param action [String] Action (e.g., 'created', 'updated', 'deleted')
    # @param payload [Hash] Event payload
    # @param options [Hash] Additional options (event_id, trace_id, occurred_at)
    # @return [Boolean]
    #
    # @example
    #   publisher.publish_event('users', 'user', 'created', { id: 123, name: 'John' })
    #   # Internally publishes to topic: 'users.user.created'
    def publish_event(domain, resource, action, payload, **options)
      # Map domain/resource/action to topic format
      topic = "#{domain}.#{resource}.#{action}"

      # Add domain/resource/action to envelope for backward compatibility
      envelope_options = options.merge(
        domain: domain,
        resource: resource,
        action: action,
        resource_id: (payload['id'] || payload[:id])
      )

      publish_to_topic(topic, payload, **envelope_options)
    end

    private

    def do_publish?(subject, envelope)
      headers = { 'nats-msg-id' => envelope['event_id'] }

      ack = @jts.publish(subject, Oj.dump(envelope, mode: :compat), header: headers)
      duplicate = ack.respond_to?(:duplicate?) && ack.duplicate?
      msg = "Published #{subject} event_id=#{envelope['event_id']}"
      msg += ' (duplicate)' if duplicate

      Logging.info(msg, tag: 'NatsPubsub::Publisher')

      if ack.respond_to?(:error) && ack.error
        Logging.error(
          "Publish ack error: #{ack.error}",
          tag: 'NatsPubsub::Publisher'
        )
      end

      !ack.respond_to?(:error) || ack.error.nil?
    end

    # ---- Outbox path ----
    def publish_via_outbox(subject, envelope)
      klass = ModelUtils.constantize(NatsPubsub.config.outbox_model)

      unless ModelUtils.ar_class?(klass)
        Logging.warn(
          "Outbox model #{klass} is not an ActiveRecord model; publishing directly.",
          tag: 'NatsPubsub::Publisher'
        )
        return with_retries { do_publish?(subject, envelope) }
      end

      repo     = OutboxRepository.new(klass)
      event_id = envelope['event_id'].to_s
      record   = repo.find_or_build(event_id)

      if repo.already_sent?(record)
        Logging.info(
          "Outbox already sent event_id=#{event_id}; skipping publish.",
          tag: 'NatsPubsub::Publisher'
        )
        return true
      end

      repo.persist_pre(record, subject, envelope)

      ok = with_retries { do_publish?(subject, envelope) }
      ok ? repo.persist_success(record) : repo.persist_failure(record, 'Publish returned false')
      ok
    rescue StandardError => e
      repo.persist_exception(record, e) if defined?(repo) && defined?(record)
      log_error(false, e)
    end
    # ---- /Outbox path ----

    # Retry only on transient NATS IO errors
    def with_retries(retries = DEFAULT_RETRIES)
      attempts = 0
      begin
        yield
      rescue *TRANSIENT_ERRORS => e
        attempts += 1
        return log_error(false, e) if attempts > retries

        backoff(attempts, e)
        retry
      end
    end

    def backoff(attempts, error)
      delay = RETRY_BACKOFFS[attempts - 1] || RETRY_BACKOFFS.last
      Logging.warn(
        "Publish retry #{attempts} after #{error.class}: #{error.message}",
        tag: 'NatsPubsub::Publisher'
      )
      sleep delay
    end

    def log_error(val, exc)
      Logging.error(
        "Publish failed: #{exc.class} #{exc.message}",
        tag: 'NatsPubsub::Publisher'
      )
      val
    end

    # Build envelope for PubSub events (legacy - kept for backward compatibility)
    def build_envelope(domain, resource, action, payload, options = {})
      {
        'event_id' => options[:event_id] || SecureRandom.uuid,
        'schema_version' => 1,
        'domain' => domain,
        'resource' => resource,
        'action' => action,
        'producer' => NatsPubsub.config.app_name,
        'resource_id' => (payload['id'] || payload[:id]).to_s,
        'occurred_at' => (options[:occurred_at] || Time.now.utc).iso8601,
        'trace_id' => options[:trace_id] || SecureRandom.hex(8),
        'payload' => payload
      }
    end

    # ===== Topic-Specific Helpers =====

    # Build NATS subject for topic
    # Supports hierarchical topics using dot notation
    # Format: {env}.#{NatsPubsub.config.app_name}.{topic_name}
    #
    # Examples:
    #   'notifications' => 'production.#{NatsPubsub.config.app_name}.notifications'
    #   'notifications.email' => 'production.#{NatsPubsub.config.app_name}.notifications.email'
    #   'users.user.created' => 'production.#{NatsPubsub.config.app_name}.users.user.created'
    def build_topic_subject(topic)
      normalized = normalize_topic_name(topic)
      "#{NatsPubsub.config.env}.#{NatsPubsub.config.app_name}.#{normalized}"
    end

    # Normalize topic name (replace special characters except dots with underscores)
    # Dots are preserved to allow hierarchical topics
    # NATS wildcards (> and *) are also preserved for pattern matching
    def normalize_topic_name(name)
      name.to_s.downcase.gsub(/[^a-z0-9_.>*-]/, '_')
    end

    # Build envelope for topic messages
    def build_topic_envelope(topic, message, options = {})
      envelope = {
        'event_id' => options[:event_id] || SecureRandom.uuid,
        'schema_version' => 1,
        'topic' => topic.to_s,
        'message_type' => options[:message_type]&.to_s,
        'producer' => NatsPubsub.config.app_name,
        'occurred_at' => (options[:occurred_at] || Time.now.utc).iso8601,
        'trace_id' => options[:trace_id] || SecureRandom.hex(8),
        'message' => message
      }

      # Add domain/resource/action fields if provided (for backward compatibility)
      envelope['domain'] = options[:domain].to_s if options[:domain]
      envelope['resource'] = options[:resource].to_s if options[:resource]
      envelope['action'] = options[:action].to_s if options[:action]
      envelope['resource_id'] = options[:resource_id].to_s if options[:resource_id]

      envelope.compact
    end
  end
end
