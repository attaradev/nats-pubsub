import { randomUUID } from 'crypto';
import { TopicMessage, TopicPublishOptions } from './types';

/**
 * EnvelopeBuilder - Responsible for constructing message envelopes
 *
 * Follows the Builder pattern to create topic message envelopes with proper
 * structure and validation. Encapsulates all envelope construction logic.
 *
 * SOLID Principles:
 * - Single Responsibility: Only builds message envelopes
 * - Open/Closed: Easy to extend with new envelope fields
 */
export class EnvelopeBuilder {
  private readonly appName: string;

  constructor(appName: string) {
    this.appName = appName;
  }

  /**
   * Build a topic message envelope
   *
   * @param topic - Topic name
   * @param message - Message payload
   * @param options - Additional publish options
   * @returns Constructed envelope
   */
  build(
    topic: string,
    message: Record<string, unknown>,
    options: TopicPublishOptions = {}
  ): TopicMessage {
    const eventId = options.event_id || this.generateEventId();
    const occurredAt = options.occurred_at || new Date();

    const envelope: TopicMessage = {
      event_id: eventId,
      schema_version: 1,
      topic,
      message_type: options.message_type,
      producer: this.appName,
      occurred_at: occurredAt.toISOString(),
      trace_id: options.trace_id,
      message,
    };

    // Add optional domain/resource/action fields for backward compatibility
    this.addLegacyFields(envelope, options);

    return envelope;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return randomUUID();
  }

  /**
   * Add legacy domain/resource/action fields if provided
   */
  private addLegacyFields(envelope: TopicMessage, options: TopicPublishOptions): void {
    if (options.domain) envelope.domain = options.domain;
    if (options.resource) envelope.resource = options.resource;
    if (options.action) envelope.action = options.action;
    if (options.resource_id) envelope.resource_id = options.resource_id;
  }

  /**
   * Extract resource_id from payload if present
   */
  extractResourceId(payload: Record<string, unknown>): string | undefined {
    return (payload.id || payload.ID) as string | undefined;
  }
}
