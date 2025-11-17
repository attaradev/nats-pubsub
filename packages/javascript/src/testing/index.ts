/**
 * Testing utilities for nats-pubsub
 *
 * Provides test helpers, mocks, and utilities for testing subscribers,
 * publishers, and message handlers without requiring a real NATS server.
 *
 * @example
 * ```typescript
 * import { createMockMetadata, createMockMessage, MockPublisher } from 'nats-pubsub/testing';
 *
 * describe('MySubscriber', () => {
 *   it('processes messages', async () => {
 *     const subscriber = new MySubscriber();
 *     const message = createMockMessage({ id: '123', name: 'Test' });
 *     const metadata = createMockMetadata({ action: 'created' });
 *
 *     await subscriber.call(message, metadata);
 *     // assertions...
 *   });
 * });
 * ```
 */

import { EventMetadata, PublishOptions, Logger } from '../types';

/**
 * Creates mock event metadata for testing
 *
 * @param overrides - Partial metadata to override defaults
 * @returns Complete EventMetadata object with sensible defaults
 *
 * @example
 * ```typescript
 * const metadata = createMockMetadata({
 *   action: 'created',
 *   domain: 'users',
 *   resource: 'user',
 * });
 * ```
 */
export function createMockMetadata(overrides?: Partial<EventMetadata>): EventMetadata {
  return {
    event_id: 'test-event-id',
    subject: 'test.app.domain.resource.action',
    domain: 'domain',
    resource: 'resource',
    action: 'action',
    stream: 'TEST_STREAM',
    stream_seq: 1,
    deliveries: 1,
    trace_id: 'test-trace-id',
    ...overrides,
  };
}

/**
 * Creates a mock message payload for testing
 *
 * @param data - Message data
 * @returns Message as Record<string, unknown>
 *
 * @example
 * ```typescript
 * const message = createMockMessage({ id: '123', name: 'Alice' });
 * ```
 */
export function createMockMessage(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data };
}

/**
 * Mock publisher for testing without real NATS connection
 * Tracks all published messages for assertions
 *
 * @example
 * ```typescript
 * const publisher = new MockPublisher();
 * await publisher.publish('notifications.email', { to: 'test@example.com' });
 *
 * expect(publisher.published).toHaveLength(1);
 * expect(publisher.published[0]).toMatchObject({
 *   topic: 'notifications.email',
 *   message: { to: 'test@example.com' }
 * });
 * ```
 */
export class MockPublisher {
  public published: Array<{
    topic?: string;
    topics?: string[];
    message: Record<string, unknown>;
    options?: PublishOptions;
    domain?: string;
    resource?: string;
    action?: string;
  }> = [];

  async publish(
    topicOrOptions:
      | string
      | {
          topics?: string[];
          domain?: string;
          resource?: string;
          action?: string;
          message?: Record<string, unknown>;
          payload?: Record<string, unknown>;
        },
    messageOrOptions?: Record<string, unknown> | PublishOptions,
    options?: PublishOptions
  ): Promise<void> {
    if (typeof topicOrOptions === 'string') {
      // Topic-based publish
      this.published.push({
        topic: topicOrOptions,
        message: messageOrOptions as Record<string, unknown>,
        options,
      });
    } else {
      // Object-based publish
      const payload = topicOrOptions.payload || topicOrOptions.message || {};
      this.published.push({
        topics: topicOrOptions.topics,
        domain: topicOrOptions.domain,
        resource: topicOrOptions.resource,
        action: topicOrOptions.action,
        message: payload,
        options: messageOrOptions as PublishOptions,
      });
    }
  }

  /**
   * Clear all published messages
   */
  clear(): void {
    this.published = [];
  }

  /**
   * Get last published message
   */
  getLastPublished() {
    return this.published[this.published.length - 1];
  }

  /**
   * Find published messages by topic
   */
  findByTopic(topic: string) {
    return this.published.filter((p) => p.topic === topic);
  }

  /**
   * Find published messages by domain/resource/action
   */
  findByEvent(domain: string, resource: string, action: string) {
    return this.published.filter(
      (p) => p.domain === domain && p.resource === resource && p.action === action
    );
  }
}

/**
 * Mock logger for testing without console output
 * Captures all log calls for assertions
 *
 * @example
 * ```typescript
 * const logger = new MockLogger();
 * logger.info('Test message', { key: 'value' });
 *
 * expect(logger.logs.info).toHaveLength(1);
 * expect(logger.logs.info[0].message).toBe('Test message');
 * ```
 */
export class MockLogger implements Logger {
  public logs: {
    debug: Array<{ message: string; meta?: Record<string, unknown> }>;
    info: Array<{ message: string; meta?: Record<string, unknown> }>;
    warn: Array<{ message: string; meta?: Record<string, unknown> }>;
    error: Array<{ message: string; meta?: Record<string, unknown> }>;
  } = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logs.debug.push({ message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.info.push({ message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.warn.push({ message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logs.error.push({ message, meta });
  }

  /**
   * Clear all logged messages
   */
  clear(): void {
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  /**
   * Get all logs as a flat array
   */
  getAllLogs() {
    return [
      ...this.logs.debug.map((l) => ({ level: 'debug', ...l })),
      ...this.logs.info.map((l) => ({ level: 'info', ...l })),
      ...this.logs.warn.map((l) => ({ level: 'warn', ...l })),
      ...this.logs.error.map((l) => ({ level: 'error', ...l })),
    ];
  }
}

/**
 * Wait for a condition to be true (useful for async tests)
 *
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @param intervalMs - Polling interval in milliseconds (default: 100)
 * @returns Promise that resolves when condition is true
 * @throws Error if timeout is reached
 *
 * @example
 * ```typescript
 * const publisher = new MockPublisher();
 * await someAsyncOperation(publisher);
 * await waitFor(() => publisher.published.length > 0, 1000);
 * ```
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Create a spy function that tracks calls
 * Similar to jest.fn() but framework-agnostic
 *
 * @example
 * ```typescript
 * const spy = createSpy();
 * await subscriber.call(message, metadata);
 * expect(spy.calls).toHaveLength(1);
 * ```
 */
export function createSpy<T extends (...args: any[]) => any>(
  implementation?: T
): T & { calls: any[][]; reset: () => void } {
  const calls: any[][] = [];

  const spy = ((...args: any[]) => {
    calls.push(args);
    return implementation?.(...args);
  }) as T & { calls: any[][]; reset: () => void };

  spy.calls = calls;
  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Sleep utility for tests
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 *
 * @example
 * ```typescript
 * await sleep(100); // Wait 100ms
 * ```
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a test suite helper with common setup/teardown
 *
 * @example
 * ```typescript
 * const testSuite = createTestSuite({
 *   beforeEach: async () => ({ publisher: new MockPublisher() }),
 *   afterEach: async (ctx) => ctx.publisher.clear(),
 * });
 *
 * it('test case', async () => {
 *   const { publisher } = await testSuite.setup();
 *   // ... test code
 *   await testSuite.teardown({ publisher });
 * });
 * ```
 */
export function createTestSuite<T>(options: {
  beforeEach?: () => Promise<T> | T;
  afterEach?: (context: T) => Promise<void> | void;
  beforeAll?: () => Promise<void> | void;
  afterAll?: () => Promise<void> | void;
}) {
  return {
    async setup(): Promise<T> {
      if (options.beforeAll) {
        await options.beforeAll();
      }
      if (options.beforeEach) {
        return await options.beforeEach();
      }
      return {} as T;
    },
    async teardown(context: T): Promise<void> {
      if (options.afterEach) {
        await options.afterEach(context);
      }
      if (options.afterAll) {
        await options.afterAll();
      }
    },
  };
}

// Export TestHarness
export { TestHarness } from './test-harness';
export type { TestHarnessOptions, CapturedMessage, CapturedDlqMessage } from './test-harness';
