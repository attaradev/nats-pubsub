import { Subscriber, EventMetadata } from '../types';
import { Consumer } from '../subscribers/consumer';
import { Publisher } from '../publisher/publisher';
import config from '../core/config';
import connection from '../core/connection';

/**
 * Message captured during testing
 */
export interface CapturedMessage {
  topic: string;
  message: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: Date;
}

/**
 * DLQ message captured during testing
 */
export interface CapturedDlqMessage {
  originalSubject: string;
  event: Record<string, unknown>;
  metadata: EventMetadata;
  error?: string;
  reason?: string;
  timestamp: Date;
}

/**
 * Options for creating a test harness
 */
export interface TestHarnessOptions {
  /** Subscribers to register */
  subscribers?: Subscriber[];
  /** Process messages synchronously (inline mode) */
  inlineMode?: boolean;
  /** Auto-start consumer */
  autoStart?: boolean;
  /** Mock NATS connection */
  mockConnection?: boolean;
}

/**
 * TestHarness provides comprehensive testing utilities for NatsPubsub
 *
 * Features:
 * - Message capture and inspection
 * - Inline/synchronous processing for deterministic tests
 * - DLQ message tracking
 * - Subscriber call tracking
 * - Error simulation
 *
 * @example
 * ```typescript
 * describe('OrderProcessor', () => {
 *   let harness: TestHarness;
 *
 *   beforeEach(async () => {
 *     harness = await TestHarness.create({
 *       subscribers: [OrderSubscriber],
 *       inlineMode: true
 *     });
 *   });
 *
 *   afterEach(async () => {
 *     await harness.cleanup();
 *   });
 *
 *   it('processes orders', async () => {
 *     await harness.publish('order.placed', { id: '123' });
 *     expect(harness.subscriberCalled(OrderSubscriber)).toBe(true);
 *   });
 * });
 * ```
 */
export class TestHarness {
  private messages: CapturedMessage[] = [];
  private _dlqMessages: CapturedDlqMessage[] = [];
  private subscriberCalls: Map<string, number> = new Map();
  private consumer: Consumer;
  private publisher: Publisher;
  private errorSimulations: Map<string, Error> = new Map();

  private constructor(options: TestHarnessOptions = {}) {
    this.consumer = new Consumer();
    this.publisher = new Publisher();

    // Register subscribers if provided
    if (options.subscribers) {
      for (const subscriber of options.subscribers) {
        this.registerSubscriber(subscriber);
      }
    }
  }

  /**
   * Create a new test harness
   *
   * @param options - Configuration options
   * @returns Initialized test harness
   */
  static async create(options: TestHarnessOptions = {}): Promise<TestHarness> {
    const harness = new TestHarness(options);

    // Connect and setup topology if not mocking
    if (!options.mockConnection) {
      await connection.ensureConnection();
    }

    // Auto-start consumer if requested
    if (options.autoStart && !options.inlineMode) {
      await harness.consumer.start();
    }

    return harness;
  }

  /**
   * Register a subscriber for testing
   *
   * @param subscriber - Subscriber to register
   */
  registerSubscriber(subscriber: Subscriber): void {
    // Wrap subscriber to track calls
    const originalHandle = subscriber.handle.bind(subscriber);
    const subscriberName = subscriber.constructor.name;

    subscriber.handle = async (event: Record<string, unknown>, metadata: EventMetadata) => {
      this.trackSubscriberCall(subscriberName);

      // Check for simulated error
      const error = this.errorSimulations.get(subscriberName);
      if (error) {
        throw error;
      }

      return originalHandle(event, metadata);
    };

    this.consumer.registerSubscriber(subscriber);
  }

  /**
   * Publish a message for testing
   *
   * @param topic - Topic to publish to
   * @param message - Message payload
   * @param options - Publish options
   */
  async publish(topic: string, message: Record<string, unknown>, options?: any): Promise<void> {
    // Capture message
    const metadata: EventMetadata = {
      event_id: options?.event_id || `test-${Date.now()}`,
      subject: `${config.get().env}.${config.get().appName}.${topic}`,
      domain: '',
      resource: '',
      action: '',
      deliveries: 1,
      trace_id: options?.trace_id,
    };

    this.messages.push({
      topic,
      message,
      metadata,
      timestamp: new Date(),
    });

    // Actually publish
    await this.publisher.publishToTopic(topic, message, options);
  }

  /**
   * Get all messages received on a topic
   *
   * @param topic - Topic to filter by
   * @returns Array of captured messages
   */
  received(topic: string): CapturedMessage[] {
    return this.messages.filter((m) => m.topic === topic);
  }

  /**
   * Get the last message received on a topic
   *
   * @param topic - Topic to filter by
   * @returns Last captured message or undefined
   */
  lastMessage(topic: string): Record<string, unknown> | undefined {
    const messages = this.received(topic);
    return messages.length > 0 ? messages[messages.length - 1].message : undefined;
  }

  /**
   * Check if a subscriber was called
   *
   * @param subscriber - Subscriber class or instance
   * @returns True if subscriber was called
   */
  subscriberCalled(subscriber: any): boolean {
    const name = typeof subscriber === 'function' ? subscriber.name : subscriber.constructor.name;
    return (this.subscriberCalls.get(name) || 0) > 0;
  }

  /**
   * Get the number of times a subscriber was called
   *
   * @param subscriber - Subscriber class or instance
   * @returns Number of calls
   */
  subscriberCallCount(subscriber: any): number {
    const name = typeof subscriber === 'function' ? subscriber.name : subscriber.constructor.name;
    return this.subscriberCalls.get(name) || 0;
  }

  /**
   * Get all DLQ messages
   *
   * @returns Array of captured DLQ messages
   */
  dlqMessages(): CapturedDlqMessage[] {
    return this._dlqMessages;
  }

  /**
   * Get the last DLQ message
   *
   * @returns Last DLQ message or undefined
   */
  lastDlqMessage(): CapturedDlqMessage | undefined {
    return this._dlqMessages.length > 0
      ? this._dlqMessages[this._dlqMessages.length - 1]
      : undefined;
  }

  /**
   * Simulate an error for a subscriber
   *
   * @param subscriber - Subscriber class or instance
   * @param error - Error to throw
   */
  simulateError(subscriber: any, error: Error): void {
    const name = typeof subscriber === 'function' ? subscriber.name : subscriber.constructor.name;
    this.errorSimulations.set(name, error);
  }

  /**
   * Clear simulated error for a subscriber
   *
   * @param subscriber - Subscriber class or instance
   */
  clearSimulatedError(subscriber: any): void {
    const name = typeof subscriber === 'function' ? subscriber.name : subscriber.constructor.name;
    this.errorSimulations.delete(name);
  }

  /**
   * Clear all captured data
   */
  clear(): void {
    this.messages = [];
    this._dlqMessages = [];
    this.subscriberCalls.clear();
    this.errorSimulations.clear();
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    await this.consumer.stop();
    this.clear();
  }

  /**
   * Track a subscriber call
   */
  private trackSubscriberCall(subscriberName: string): void {
    const count = this.subscriberCalls.get(subscriberName) || 0;
    this.subscriberCalls.set(subscriberName, count + 1);
  }

  /**
   * Wait for a condition to be true
   *
   * @param condition - Function that returns true when condition is met
   * @param timeoutMs - Timeout in milliseconds
   * @param intervalMs - Polling interval in milliseconds
   */
  async waitFor(
    condition: () => boolean,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Wait for a subscriber to be called
   *
   * @param subscriber - Subscriber class or instance
   * @param timeoutMs - Timeout in milliseconds
   */
  async waitForSubscriber(subscriber: any, timeoutMs: number = 5000): Promise<void> {
    await this.waitFor(() => this.subscriberCalled(subscriber), timeoutMs);
  }

  /**
   * Wait for messages on a topic
   *
   * @param topic - Topic to wait for
   * @param count - Expected number of messages
   * @param timeoutMs - Timeout in milliseconds
   */
  async waitForMessages(topic: string, count: number = 1, timeoutMs: number = 5000): Promise<void> {
    await this.waitFor(() => this.received(topic).length >= count, timeoutMs);
  }
}
