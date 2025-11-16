# frozen_string_literal: true

require 'oj'
require_relative '../core/connection'
require_relative '../core/logging'
require_relative '../core/config'
require_relative '../core/retry_strategy'
require_relative '../models/model_utils'
require_relative 'envelope_builder'
require_relative 'outbox_repository'
require_relative 'outbox_publisher'
require_relative 'publish_result'
require_relative 'publish_argument_parser'

module NatsPubsub
  # Publisher for PubSub events
  # Provides a unified interface for publishing messages using either topics or domain/resource/action patterns
  class Publisher
    DEFAULT_RETRIES = 2

    def initialize
      @jts = Connection.connect!
    end

    # Publish a message using one of the supported patterns:
    # 1. Topic-based: publish(topic, message, **opts) or publish(topic:, message:, **opts)
    # 2. Domain/resource/action: publish(domain:, resource:, action:, payload:, **opts)
    # 3. Multi-topic: publish(topics:, message:, **opts)
    #
    # @return [PublishResult] Result object with success status and details
    #
    # @example Topic-based (positional)
    #   result = publisher.publish('orders.created', { order_id: '123' })
    #
    # @example Topic-based (keyword)
    #   result = publisher.publish(topic: 'orders.created', message: { order_id: '123' })
    #
    # @example Domain/resource/action
    #   result = publisher.publish(domain: 'orders', resource: 'order', action: 'created', payload: { id: '123' })
    #
    # @example Multi-topic
    #   result = publisher.publish(topics: ['orders.created', 'notifications.sent'], message: { id: '123' })
    def publish(*args, **kwargs)
      parse_result = PublishArgumentParser.parse(*args, **kwargs)
      parse_result.call(self)
    end

    # Publish to a single topic (internal method)
    def publish_to_topic(topic, message, **options)
      subject = EnvelopeBuilder.build_subject(topic)
      envelope = EnvelopeBuilder.build_topic_envelope(topic, message, options)
      event_id = envelope['event_id']

      if NatsPubsub.config.use_outbox
        OutboxPublisher.publish(
          subject: subject,
          envelope: envelope,
          event_id: event_id
        ) { with_retries { do_publish(subject, envelope, event_id) } }
      else
        with_retries { do_publish(subject, envelope, event_id) }
      end
    rescue StandardError => e
      log_error(subject, event_id, e)
    end

    # Publish using domain/resource/action pattern (internal method)
    def publish_event(domain, resource, action, payload, **options)
      topic = "#{domain}.#{resource}.#{action}"
      subject = EnvelopeBuilder.build_subject(topic)
      envelope = EnvelopeBuilder.build_event_envelope(domain, resource, action, payload, options)
      event_id = envelope['event_id']

      if NatsPubsub.config.use_outbox
        OutboxPublisher.publish(
          subject: subject,
          envelope: envelope,
          event_id: event_id
        ) { with_retries { do_publish(subject, envelope, event_id) } }
      else
        with_retries { do_publish(subject, envelope, event_id) }
      end
    rescue StandardError => e
      log_error(subject, event_id, e)
    end

    # Publish to multiple topics (internal method)
    def publish_to_topics(topics, message, **options)
      results = {}
      topics.each do |topic|
        results[topic] = publish_to_topic(topic, message, **options)
      end
      results
    end

    private

    def do_publish(subject, envelope, event_id)
      headers = { 'nats-msg-id' => event_id }

      ack = @jts.publish(subject, Oj.dump(envelope, mode: :compat), header: headers)
      duplicate = ack.respond_to?(:duplicate?) && ack.duplicate?
      msg = "Published #{subject} event_id=#{event_id}"
      msg += ' (duplicate)' if duplicate

      Logging.info(msg, tag: 'NatsPubsub::Publisher')

      if ack.respond_to?(:error) && ack.error
        Logging.error(
          "Publish ack error: #{ack.error}",
          tag: 'NatsPubsub::Publisher'
        )
        return PublishResult.failure(
          reason: :publish_error,
          details: "NATS ack error: #{ack.error}",
          subject: subject,
          error: ack.error
        )
      end

      PublishResult.success(event_id: event_id, subject: subject)
    end


    # Retry only on transient NATS IO errors using RetryStrategy
    def with_retries(retries = DEFAULT_RETRIES)
      result = RetryStrategy.execute(retries: retries, operation_name: 'Publish') do
        yield
      end
      result
    rescue StandardError => e
      # Return failure result for retry errors
      subject = e.respond_to?(:subject) ? e.subject : 'unknown'
      event_id = e.respond_to?(:event_id) ? e.event_id : 'unknown'
      PublishResult.failure(
        reason: :io_error,
        details: "Retries exhausted: #{e.class} - #{e.message}",
        subject: subject,
        error: e
      )
    end

    def log_error(subject, event_id, exc)
      Logging.error(
        "Publish failed: #{exc.class} #{exc.message}",
        tag: 'NatsPubsub::Publisher'
      )
      PublishResult.failure(
        reason: :exception,
        details: "#{exc.class}: #{exc.message}",
        subject: subject,
        error: exc
      )
    end
  end
end
