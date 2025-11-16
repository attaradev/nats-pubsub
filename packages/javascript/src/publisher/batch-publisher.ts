import Publisher from './publisher';
import Config from '../core/config';
import { PublishOptions } from '../types';

export interface BatchPublishItem {
  domain: string;
  resource: string;
  action: string;
  payload: Record<string, unknown>;
  options?: PublishOptions;
}

export interface BatchPublishResult {
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    item: BatchPublishItem;
    error: string;
  }>;
  duration: number;
}

export class BatchPublisher {
  private publisher: Publisher;
  private config: Config;

  constructor() {
    this.publisher = Publisher.getInstance();
    this.config = Config.getInstance();
  }

  /**
   * Publish multiple events in a batch
   * Continues publishing even if some items fail
   */
  async publishBatch(items: BatchPublishItem[]): Promise<BatchPublishResult> {
    const startTime = Date.now();
    const result: BatchPublishResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    this.config.logger.info('Publishing batch', {
      count: items.length,
    });

    const promises = items.map(async (item, index) => {
      try {
        await this.publisher.publish(
          item.domain,
          item.resource,
          item.action,
          item.payload,
          item.options
        );
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          index,
          item,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        this.config.logger.error('Failed to publish batch item', {
          index,
          domain: item.domain,
          resource: item.resource,
          action: item.action,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.allSettled(promises);

    result.duration = Date.now() - startTime;

    this.config.logger.info('Batch publish complete', {
      successful: result.successful,
      failed: result.failed,
      duration_ms: result.duration,
    });

    return result;
  }

  /**
   * Publish multiple events with the same domain/resource but different actions
   * Useful for publishing multiple related events
   */
  async publishMany(
    domain: string,
    resource: string,
    events: Array<{
      action: string;
      payload: Record<string, unknown>;
      options?: PublishOptions;
    }>
  ): Promise<BatchPublishResult> {
    const items: BatchPublishItem[] = events.map((event) => ({
      domain,
      resource,
      action: event.action,
      payload: event.payload,
      options: event.options,
    }));

    return this.publishBatch(items);
  }

  /**
   * Publish the same event to multiple subjects
   * Useful for fanout scenarios
   */
  async fanout(
    destinations: Array<{
      domain: string;
      resource: string;
      action: string;
    }>,
    payload: Record<string, unknown>,
    options?: PublishOptions
  ): Promise<BatchPublishResult> {
    const items: BatchPublishItem[] = destinations.map((dest) => ({
      domain: dest.domain,
      resource: dest.resource,
      action: dest.action,
      payload,
      options,
    }));

    return this.publishBatch(items);
  }
}

export default new BatchPublisher();
