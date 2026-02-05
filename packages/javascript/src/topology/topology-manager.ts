import { DiscardPolicy, JetStreamManager, RetentionPolicy, StorageType } from 'nats';
import config from '../core/config';
import { Subject } from '../core/subject';
import { toNanos } from '../core/duration';

/**
 * Check if an error is a JetStream "not found" error (HTTP 404).
 *
 * The NATS client throws NatsError with:
 * - code: '404' (string) on the NatsError itself
 * - api_error.code: 404 (number) for the JetStream API error detail
 *
 * We check both to be resilient across NATS client versions.
 */
function isStreamNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string | number; api_error?: { code?: number } };
  return err.code === '404' || err.code === 404 || err.api_error?.code === 404;
}

/**
 * TopologyManager handles JetStream stream and DLQ topology setup
 *
 * Responsibilities:
 * - Create and verify main event stream
 * - Create and verify DLQ stream
 * - Configure retention policies and storage
 */
export class TopologyManager {
  /**
   * Ensure all required JetStream topology exists
   * Creates main stream and DLQ stream if configured
   */
  async ensureTopology(jsm: JetStreamManager): Promise<void> {
    await this.ensureMainStream(jsm);
    await this.ensureDlqStream(jsm);
  }

  /**
   * Ensure main event stream exists
   */
  private async ensureMainStream(jsm: JetStreamManager): Promise<void> {
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    try {
      await jsm.streams.info(streamName);
      logger.debug('Stream already exists', { stream: streamName });
    } catch (error: unknown) {
      if (isStreamNotFoundError(error)) {
        logger.info('Creating stream...', { stream: streamName });

        // Include both event-based and topic-based subject patterns
        const subjects = [Subject.allEvents(cfg.env), `${cfg.env}.${cfg.appName}.>`];

        await jsm.streams.add({
          name: streamName,
          subjects,
          retention: RetentionPolicy.Limits,
          max_age: toNanos(7 * 24 * 60 * 60 * 1000), // 7 days in nanoseconds
          storage: StorageType.File,
          num_replicas: 1,
          discard: DiscardPolicy.Old,
        });

        logger.info('Stream created successfully', { stream: streamName });
      } else {
        throw error;
      }
    }
  }

  /**
   * Ensure DLQ stream exists if configured
   */
  private async ensureDlqStream(jsm: JetStreamManager): Promise<void> {
    const cfg = config.get();
    const streamName = config.streamName;
    const logger = config.logger;

    if (!cfg.useDlq) {
      return;
    }

    const dlqStream = `${streamName}-dlq`;
    try {
      await jsm.streams.info(dlqStream);
      logger.debug('DLQ stream already exists', { stream: dlqStream });
    } catch (error: unknown) {
      if (isStreamNotFoundError(error)) {
        logger.info('Creating DLQ stream...', {
          stream: dlqStream,
          subject: config.dlqSubject,
        });

        await jsm.streams.add({
          name: dlqStream,
          subjects: [config.dlqSubject],
          retention: RetentionPolicy.Limits,
          max_age: toNanos(30 * 24 * 60 * 60 * 1000), // 30 days
          storage: StorageType.File,
          num_replicas: 1,
          discard: DiscardPolicy.Old,
        });

        logger.info('DLQ stream created', { stream: dlqStream });
      } else {
        throw error;
      }
    }
  }
}
