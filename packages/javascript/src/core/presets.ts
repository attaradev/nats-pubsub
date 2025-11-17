import { NatsPubsubConfig } from '../types';

/**
 * Configuration preset options
 */
export interface PresetOptions {
  appName: string;
  natsUrls: string | string[];
  auth?: {
    type?: 'token' | 'credentials' | 'nkey';
    token?: string;
    credentials?: string;
    nkey?: string;
  };
}

/**
 * Development preset with sensible defaults for local development
 *
 * Features:
 * - Lower concurrency for easier debugging
 * - Shorter timeouts for faster feedback
 * - DLQ enabled for error visibility
 * - Debug logging
 *
 * @param options - Basic configuration options
 * @returns Development configuration
 *
 * @example
 * ```typescript
 * await NatsPubsub.setup(Presets.development({
 *   appName: 'my-service',
 *   natsUrls: 'nats://localhost:4222'
 * }));
 * ```
 */
export function development(options: PresetOptions): Partial<NatsPubsubConfig> {
  return {
    appName: options.appName,
    natsUrls: options.natsUrls,
    env: 'development',

    // Lower concurrency for easier debugging
    concurrency: 5,
    perMessageConcurrency: 3,

    // Faster feedback during development
    maxDeliver: 3,
    ackWait: 15000, // 15 seconds
    backoff: [1000, 3000, 5000], // Shorter backoff

    // DLQ enabled for visibility
    useDlq: true,
    dlqMaxAttempts: 2,

    // Inbox/Outbox typically not needed in dev
    useInbox: false,
    useOutbox: false,

    // Shorter timeouts
    subscriberTimeoutMs: 15000,
  };
}

/**
 * Production preset optimized for reliability and performance
 *
 * Features:
 * - Higher concurrency for throughput
 * - Longer timeouts for network latency
 * - Aggressive retry strategy
 * - DLQ enabled for operational safety
 * - Info-level logging
 *
 * @param options - Basic configuration options
 * @returns Production configuration
 *
 * @example
 * ```typescript
 * await NatsPubsub.setup(Presets.production({
 *   appName: 'my-service',
 *   natsUrls: process.env.NATS_CLUSTER_URLS!.split(','),
 *   auth: {
 *     type: 'token',
 *     token: process.env.NATS_TOKEN
 *   }
 * }));
 * ```
 */
export function production(options: PresetOptions): Partial<NatsPubsubConfig> {
  return {
    appName: options.appName,
    natsUrls: options.natsUrls,
    env: 'production',

    // Higher concurrency for throughput
    concurrency: 20,
    perMessageConcurrency: 5,

    // More aggressive retry strategy
    maxDeliver: 5,
    ackWait: 30000, // 30 seconds
    backoff: [1000, 5000, 15000, 30000, 60000], // Exponential backoff

    // DLQ enabled for operational safety
    useDlq: true,
    dlqMaxAttempts: 3,

    // Consider enabling for transactional guarantees
    useInbox: false,
    useOutbox: false,

    // Longer timeouts for network latency
    subscriberTimeoutMs: 30000,
  };
}

/**
 * Staging preset balanced between development and production
 *
 * Features:
 * - Moderate concurrency
 * - Production-like retry strategy
 * - DLQ enabled
 * - Debug logging for troubleshooting
 *
 * @param options - Basic configuration options
 * @returns Staging configuration
 *
 * @example
 * ```typescript
 * await NatsPubsub.setup(Presets.staging({
 *   appName: 'my-service',
 *   natsUrls: 'nats://staging-nats:4222'
 * }));
 * ```
 */
export function staging(options: PresetOptions): Partial<NatsPubsubConfig> {
  return {
    appName: options.appName,
    natsUrls: options.natsUrls,
    env: 'staging',

    // Moderate concurrency
    concurrency: 10,
    perMessageConcurrency: 5,

    // Production-like retry strategy
    maxDeliver: 5,
    ackWait: 30000,
    backoff: [1000, 5000, 15000, 30000, 60000],

    // DLQ enabled
    useDlq: true,
    dlqMaxAttempts: 3,

    // Inbox/Outbox optional
    useInbox: false,
    useOutbox: false,

    subscriberTimeoutMs: 30000,
  };
}

/**
 * Testing preset optimized for unit and integration tests
 *
 * Features:
 * - Minimal concurrency
 * - Very short timeouts for fast tests
 * - No retries for deterministic behavior
 * - DLQ disabled
 *
 * @param options - Basic configuration options
 * @returns Testing configuration
 *
 * @example
 * ```typescript
 * await NatsPubsub.setup(Presets.testing({
 *   appName: 'test-service',
 *   natsUrls: 'nats://localhost:4222'
 * }));
 * ```
 */
export function testing(options: PresetOptions): Partial<NatsPubsubConfig> {
  return {
    appName: options.appName,
    natsUrls: options.natsUrls,
    env: 'test',

    // Minimal concurrency
    concurrency: 1,
    perMessageConcurrency: 1,

    // No retries for deterministic behavior
    maxDeliver: 1,
    ackWait: 5000, // 5 seconds
    backoff: [],

    // DLQ disabled for simpler testing
    useDlq: false,
    dlqMaxAttempts: 0,

    // Inbox/Outbox disabled
    useInbox: false,
    useOutbox: false,

    // Short timeouts for fast tests
    subscriberTimeoutMs: 5000,
  };
}

/**
 * Configuration presets for common environments
 */
export const Presets = {
  development,
  production,
  staging,
  testing,
};
