/**
 * Configuration presets for common deployment scenarios
 * Provides smart defaults for development, production, and testing environments
 */

import type { NatsPubsubConfig } from '../types';
import { Consumer, Retry, Timeouts, DLQ } from './constants';

export type PresetName = 'development' | 'production' | 'testing';

/**
 * Configuration preset definitions
 */
export class ConfigPresets {
  /**
   * Apply a preset to a configuration object
   *
   * @param config - Partial configuration object to modify
   * @param preset - Preset name (development, production, testing)
   * @returns Configuration with preset applied
   */
  static apply(config: Partial<NatsPubsubConfig>, preset: PresetName): Partial<NatsPubsubConfig> {
    switch (preset) {
      case 'development':
        return this.applyDevelopment(config);
      case 'production':
        return this.applyProduction(config);
      case 'testing':
        return this.applyTesting(config);
      default:
        throw new Error(`Unknown preset: ${preset}. Available: development, production, testing`);
    }
  }

  /**
   * Get preset description
   *
   * @param preset - Preset name
   * @returns Description of the preset
   */
  static description(preset: PresetName): string {
    return PRESET_DESCRIPTIONS[preset] || `Unknown preset: ${preset}`;
  }

  /**
   * List all available presets
   *
   * @returns Array of available preset names
   */
  static availablePresets(): PresetName[] {
    return ['development', 'production', 'testing'];
  }

  /**
   * Development preset - optimized for local development
   * - Verbose logging for debugging
   * - Lower concurrency to avoid resource exhaustion
   * - DLQ enabled for debugging failed messages
   * - Shorter timeouts for faster feedback
   */
  private static applyDevelopment(config: Partial<NatsPubsubConfig>): Partial<NatsPubsubConfig> {
    return {
      ...config,
      env: config.env || 'development',
      concurrency: Consumer.DEFAULT_CONCURRENCY,
      maxDeliver: 3, // Fail faster in development
      ackWait: 10_000, // 10 seconds - shorter for faster feedback
      backoff: [500, 2_000, 5_000], // Faster retries
      useDlq: true,
      dlqMaxAttempts: 2, // Fail to DLQ faster for debugging
    };
  }

  /**
   * Production preset - optimized for reliability and performance
   * - Error-level logging to reduce noise
   * - Higher concurrency for throughput
   * - DLQ enabled for failure recovery
   * - Longer timeouts for stability
   */
  private static applyProduction(config: Partial<NatsPubsubConfig>): Partial<NatsPubsubConfig> {
    return {
      ...config,
      env: config.env || 'production',
      concurrency: 20, // Higher throughput
      maxDeliver: Retry.MAX_ATTEMPTS,
      ackWait: Timeouts.ACK_WAIT_DEFAULT,
      backoff: [...Retry.DEFAULT_BACKOFF],
      useDlq: true,
      dlqMaxAttempts: DLQ.MAX_ATTEMPTS,
    };
  }

  /**
   * Testing preset - optimized for test suite performance
   * - Minimal logging to avoid test output noise
   * - Low concurrency for deterministic behavior
   * - DLQ disabled (tests should verify behavior directly)
   * - Fast timeouts
   */
  private static applyTesting(config: Partial<NatsPubsubConfig>): Partial<NatsPubsubConfig> {
    return {
      ...config,
      env: config.env || 'test',
      concurrency: 1, // Synchronous processing
      maxDeliver: 2, // Fail fast in tests
      ackWait: 1_000, // Fast timeout
      backoff: [100, 500], // Minimal retries
      useDlq: false, // Disabled for speed
      dlqMaxAttempts: 1,
    };
  }
}

/**
 * Preset descriptions for documentation
 */
const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  development: 'Optimized for local development with verbose logging and fast feedback',
  production: 'Optimized for reliability and performance in production environments',
  testing: 'Optimized for test suite performance with synchronous processing',
};
