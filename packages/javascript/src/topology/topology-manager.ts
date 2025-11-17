import { DiscardPolicy, JetStreamManager, RetentionPolicy, StorageType } from 'nats';
import config from '../core/config';
import { Subject } from '../core/subject';
import { toNanos } from '../core/duration';

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
      const err = error as { code?: string };
      if (err.code === '404') {
        logger.info('Creating stream...', { stream: streamName });

        const subjects = [Subject.allEvents(cfg.env)];
        if (cfg.useDlq) {
          subjects.push(config.dlqSubject);
        }

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
      const err = error as { code?: string };
      if (err.code === '404') {
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
