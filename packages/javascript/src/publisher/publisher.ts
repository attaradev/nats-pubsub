import { EventEnvelope, PublishOptions } from '../types';
import connection from '../core/connection';
import config from '../core/config';
import { randomUUID } from 'crypto';

export class Publisher {
  /**
   * Publish an event to NATS JetStream
   * @param domain - Business domain (e.g., 'users', 'orders')
   * @param resource - Resource type (e.g., 'user', 'order')
   * @param action - Event action (e.g., 'created', 'updated', 'deleted')
   * @param payload - Event payload data
   * @param options - Additional publish options
   */
  async publish(
    domain: string,
    resource: string,
    action: string,
    payload: Record<string, unknown>,
    options: PublishOptions = {}
  ): Promise<void> {
    await connection.ensureConnection();
    const js = connection.getJetStream();
    const cfg = config.get();
    const logger = config.logger;

    const eventId = options.event_id || randomUUID();
    const occurredAt = options.occurred_at || new Date();
    const subject = this.buildSubject(domain, resource, action);

    const envelope: EventEnvelope = {
      event_id: eventId,
      schema_version: 1,
      event_type: action,
      producer: cfg.appName,
      resource_type: resource,
      resource_id: this.extractResourceId(payload),
      occurred_at: occurredAt.toISOString(),
      trace_id: options.trace_id,
      payload,
    };

    try {
      logger.debug('Publishing event', {
        subject,
        event_id: eventId,
        resource_type: resource,
      });

      const headers = new Map<string, string[]>();
      headers.set('Nats-Msg-Id', [eventId]); // Idempotent publish

      if (options.trace_id) {
        headers.set('trace_id', [options.trace_id]);
      }

      await js.publish(subject, JSON.stringify(envelope), {
        msgID: eventId,
        headers,
      });

      logger.info('Event published successfully', {
        subject,
        event_id: eventId,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        subject,
        event_id: eventId,
        error,
      });
      throw error;
    }
  }

  /**
   * Build the NATS subject from components
   */
  private buildSubject(domain: string, resource: string, action: string): string {
    const cfg = config.get();
    return `${cfg.env}.events.${domain}.${resource}.${action}`;
  }

  /**
   * Extract resource_id from payload if present
   */
  private extractResourceId(payload: Record<string, unknown>): string | undefined {
    return (payload.id || payload.ID) as string | undefined;
  }
}

export default new Publisher();
