import { BaseSubscriber } from '../subscriber';
import { EventMetadata } from '../types';
import config from '../core/config';

export interface DlqMessage {
  event_id: string;
  original_subject: string;
  event: Record<string, unknown>;
  metadata: EventMetadata;
  error?: string;
  deliveries?: number;
  first_seen: Date;
  last_seen: Date;
}

export interface DlqHandler {
  handle(message: DlqMessage): Promise<void>;
}

export interface PersistentDlqStore {
  save(message: DlqMessage): Promise<void>;
  list(): Promise<DlqMessage[]>;
  get(eventId: string): Promise<DlqMessage | undefined>;
  delete(eventId: string): Promise<void>;
  clear(): Promise<void>;
  stats?(): Promise<{
    total: number;
    bySubject: Record<string, number>;
    oldestMessage?: Date;
    newestMessage?: Date;
  }>;
}

/**
 * Dead Letter Queue Consumer
 * Subscribes to DLQ subject and handles poison messages
 */
export class DlqConsumer extends BaseSubscriber {
  private config: typeof config;
  private handlers: DlqHandler[] = [];
  private messages: Map<string, DlqMessage> = new Map();
  private store?: PersistentDlqStore;

  constructor(store?: PersistentDlqStore) {
    super(config.dlqSubject);
    this.config = config;
    this.store = store;
  }

  /**
   * Register a custom DLQ handler
   */
  addHandler(handler: DlqHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Process DLQ messages
   */
  async call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    const dlqMessage: DlqMessage = {
      event_id: metadata.event_id,
      original_subject: metadata.subject,
      event,
      metadata,
      deliveries: metadata.deliveries,
      first_seen: new Date(),
      last_seen: new Date(),
    };

    // Update or store message
    if (this.messages.has(metadata.event_id)) {
      const existing = this.messages.get(metadata.event_id)!;
      dlqMessage.first_seen = existing.first_seen;
    }
    this.messages.set(metadata.event_id, dlqMessage);

    // Log DLQ message
    this.config.logger.warn('Message received in DLQ', {
      event_id: metadata.event_id,
      original_subject: metadata.subject,
      deliveries: metadata.deliveries,
    });

    // Persist if a store is configured
    if (this.store) {
      try {
        await this.store.save(dlqMessage);
      } catch (error) {
        this.config.logger.error('Failed to persist DLQ message', {
          event_id: metadata.event_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Call registered handlers
    for (const handler of this.handlers) {
      try {
        await handler.handle(dlqMessage);
      } catch (error) {
        this.config.logger.error('DLQ handler failed', {
          event_id: metadata.event_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get all DLQ messages
   */
  getMessages(): DlqMessage[] {
    return Array.from(this.messages.values());
  }

  /**
   * Get message by event ID
   */
  getMessage(eventId: string): DlqMessage | undefined {
    return this.messages.get(eventId);
  }

  /**
   * Clear all DLQ messages from memory
   */
  clearMessages(): void {
    this.messages.clear();
    if (this.store) {
      this.store.clear().catch((error) => {
        this.config.logger.error('Failed to clear persistent DLQ store', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }
  }

  /**
   * Get statistics about DLQ
   */
  getStatistics(): {
    total: number;
    bySubject: Record<string, number>;
    oldestMessage?: Date;
    newestMessage?: Date;
  } {
    const messages = this.getMessages();
    const bySubject: Record<string, number> = {};

    let oldest: Date | undefined;
    let newest: Date | undefined;

    for (const message of messages) {
      // Count by subject
      bySubject[message.original_subject] = (bySubject[message.original_subject] || 0) + 1;

      // Track oldest and newest
      if (!oldest || message.first_seen < oldest) {
        oldest = message.first_seen;
      }
      if (!newest || message.last_seen > newest) {
        newest = message.last_seen;
      }
    }

    return {
      total: messages.length,
      bySubject,
      oldestMessage: oldest,
      newestMessage: newest,
    };
  }
}

/**
 * Example DLQ Handler: Log to external service
 */
export class LoggingDlqHandler implements DlqHandler {
  async handle(message: DlqMessage): Promise<void> {
    console.error('DLQ Message:', JSON.stringify(message, null, 2));
  }
}

/**
 * Example DLQ Handler: Alert operations team
 */
export class AlertDlqHandler implements DlqHandler {
  private alertThreshold: number;
  private alertedEvents: Set<string> = new Set();

  constructor(threshold: number = 1) {
    this.alertThreshold = threshold;
  }

  async handle(message: DlqMessage): Promise<void> {
    if (this.alertedEvents.has(message.event_id)) {
      return; // Already alerted
    }

    if ((message.deliveries || 0) >= this.alertThreshold) {
      // TODO: Integrate with alerting service (PagerDuty, Slack, etc.)
      console.error(
        `ALERT: Message ${message.event_id} exceeded ${this.alertThreshold} deliveries`
      );
      this.alertedEvents.add(message.event_id);
    }
  }
}

/**
 * Example DLQ Handler: Store to database for manual review
 */
export class StorageDlqHandler implements DlqHandler {
  async handle(message: DlqMessage): Promise<void> {
    // TODO: Implement database storage
    // Example: await db.dlq_messages.insert(message);
    console.log(`Storing DLQ message ${message.event_id} for manual review`);
  }
}

export default new DlqConsumer();
