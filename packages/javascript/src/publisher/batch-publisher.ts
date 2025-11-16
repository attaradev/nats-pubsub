import { Publisher, Logger } from './publisher';
import publisherInstance from './publisher';
import config from '../core/config';
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

/**
 * BatchPublisher - Handles batch publishing operations
 *
 * This class follows SOLID principles and best practices:
 * - Single Responsibility: Only handles batch publishing operations
 * - Open/Closed: Easy to extend with new batch strategies
 * - Dependency Inversion: Depends on Publisher abstraction
 *
 * Design Patterns:
 * - Dependency Injection: Publisher and Logger are injected
 * - Facade Pattern: Provides a simpler interface for batch operations
 *
 * @example Basic usage
 * ```typescript
 * const batchPublisher = new BatchPublisher();
 * const result = await batchPublisher.publishBatch(items);
 * console.log(`Published ${result.successful} items`);
 * ```
 *
 * @example With dependency injection
 * ```typescript
 * const batchPublisher = new BatchPublisher(customPublisher, customLogger);
 * ```
 */
export class BatchPublisher {
  private readonly publisher: Publisher;
  private readonly logger: Logger;

  /**
   * Create a new BatchPublisher instance
   *
   * @param publisher - Publisher instance (defaults to global publisher)
   * @param logger - Logger instance (defaults to global config.logger)
   */
  constructor(publisher?: Publisher, logger?: Logger) {
    this.publisher = publisher || publisherInstance;
    this.logger = logger || config.logger;
  }

  /**
   * Publish multiple events in a batch
   *
   * Continues publishing even if some items fail, providing detailed
   * results about successes and failures.
   *
   * @param items - Array of items to publish
   * @returns Result with statistics and error details
   *
   * @example
   * ```typescript
   * const items = [
   *   { domain: 'users', resource: 'user', action: 'created', payload: { id: 1 } },
   *   { domain: 'users', resource: 'user', action: 'updated', payload: { id: 2 } }
   * ];
   * const result = await batchPublisher.publishBatch(items);
   * console.log(`Success: ${result.successful}, Failed: ${result.failed}`);
   * ```
   */
  async publishBatch(items: BatchPublishItem[]): Promise<BatchPublishResult> {
    const startTime = Date.now();
    const result: BatchPublishResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    // Validate input
    this.validateBatchItems(items);

    this.logger.info('Publishing batch', {
      count: items.length,
    });

    // Publish all items in parallel
    const promises = items.map(async (item, index) => {
      try {
        await this.publishSingleItem(item);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          index,
          item,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        this.logPublishError(item, index, error);
      }
    });

    await Promise.allSettled(promises);

    result.duration = Date.now() - startTime;

    this.logger.info('Batch publish complete', {
      successful: result.successful,
      failed: result.failed,
      duration_ms: result.duration,
    });

    return result;
  }

  /**
   * Publish multiple events with the same domain/resource but different actions
   *
   * Useful for publishing multiple related events efficiently.
   *
   * @param domain - Business domain
   * @param resource - Resource type
   * @param events - Array of events with actions and payloads
   * @returns Result with statistics and error details
   *
   * @example
   * ```typescript
   * const result = await batchPublisher.publishMany('users', 'user', [
   *   { action: 'created', payload: { id: 1, name: 'Alice' } },
   *   { action: 'updated', payload: { id: 2, name: 'Bob' } }
   * ]);
   * ```
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
    this.validatePublishManyParams(domain, resource, events);

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
   * Publish the same event to multiple subjects (fanout pattern)
   *
   * Useful for broadcasting events to multiple destinations.
   *
   * @param destinations - Array of destination subjects
   * @param payload - Payload to publish
   * @param options - Optional publish options
   * @returns Result with statistics and error details
   *
   * @example
   * ```typescript
   * const result = await batchPublisher.fanout(
   *   [
   *     { domain: 'notifications', resource: 'email', action: 'send' },
   *     { domain: 'audit', resource: 'log', action: 'record' }
   *   ],
   *   { message: 'User logged in' }
   * );
   * ```
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
    this.validateFanoutParams(destinations, payload);

    const items: BatchPublishItem[] = destinations.map((dest) => ({
      domain: dest.domain,
      resource: dest.resource,
      action: dest.action,
      payload,
      options,
    }));

    return this.publishBatch(items);
  }

  /**
   * Publish a single batch item
   *
   * @param item - Item to publish
   */
  private async publishSingleItem(item: BatchPublishItem): Promise<void> {
    await this.publisher.publish(
      {
        domain: item.domain,
        resource: item.resource,
        action: item.action,
        payload: item.payload,
      },
      item.options
    );
  }

  /**
   * Log a publish error
   *
   * @param item - Item that failed to publish
   * @param index - Index of the item
   * @param error - Error that occurred
   */
  private logPublishError(item: BatchPublishItem, index: number, error: unknown): void {
    this.logger.error('Failed to publish batch item', {
      index,
      domain: item.domain,
      resource: item.resource,
      action: item.action,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  /**
   * Validate batch items
   *
   * @param items - Items to validate
   * @throws Error if items are invalid
   */
  private validateBatchItems(items: BatchPublishItem[]): void {
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    if (items.length === 0) {
      throw new Error('Items array cannot be empty');
    }

    for (const item of items) {
      this.validateBatchItem(item);
    }
  }

  /**
   * Validate a single batch item
   *
   * @param item - Item to validate
   * @throws Error if item is invalid
   */
  private validateBatchItem(item: BatchPublishItem): void {
    if (!item || typeof item !== 'object') {
      throw new Error('Batch item must be an object');
    }

    if (!item.domain || typeof item.domain !== 'string') {
      throw new Error('Batch item must have a valid domain');
    }

    if (!item.resource || typeof item.resource !== 'string') {
      throw new Error('Batch item must have a valid resource');
    }

    if (!item.action || typeof item.action !== 'string') {
      throw new Error('Batch item must have a valid action');
    }

    if (!item.payload || typeof item.payload !== 'object') {
      throw new Error('Batch item must have a valid payload');
    }
  }

  /**
   * Validate publishMany parameters
   *
   * @param domain - Domain to validate
   * @param resource - Resource to validate
   * @param events - Events to validate
   * @throws Error if parameters are invalid
   */
  private validatePublishManyParams(
    domain: string,
    resource: string,
    events: Array<{ action: string; payload: Record<string, unknown>; options?: PublishOptions }>
  ): void {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Domain must be a non-empty string');
    }

    if (!resource || typeof resource !== 'string') {
      throw new Error('Resource must be a non-empty string');
    }

    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Events must be a non-empty array');
    }
  }

  /**
   * Validate fanout parameters
   *
   * @param destinations - Destinations to validate
   * @param payload - Payload to validate
   * @throws Error if parameters are invalid
   */
  private validateFanoutParams(
    destinations: Array<{ domain: string; resource: string; action: string }>,
    payload: Record<string, unknown>
  ): void {
    if (!Array.isArray(destinations) || destinations.length === 0) {
      throw new Error('Destinations must be a non-empty array');
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }

    for (const dest of destinations) {
      if (!dest.domain || !dest.resource || !dest.action) {
        throw new Error('Each destination must have domain, resource, and action');
      }
    }
  }
}

export default new BatchPublisher();
