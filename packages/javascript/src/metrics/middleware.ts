import { Middleware, EventMetadata } from '../types';
import { PrometheusMetrics } from './prometheus';

/**
 * Middleware that automatically records metrics for message processing
 */
export class MetricsMiddleware implements Middleware {
  private metrics: PrometheusMetrics;

  constructor(metrics: PrometheusMetrics) {
    this.metrics = metrics;
  }

  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();

    // Record message received
    this.metrics.recordMessageReceived(
      metadata.subject,
      metadata.domain,
      metadata.resource,
      metadata.action
    );

    try {
      await next();

      // Record success
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metrics.recordProcessingDuration(
        metadata.subject,
        metadata.domain,
        metadata.resource,
        metadata.action,
        'unknown', // subscriber name would need to be passed in metadata
        durationSeconds
      );

      this.metrics.recordMessageProcessed(
        metadata.subject,
        metadata.domain,
        metadata.resource,
        metadata.action,
        'unknown'
      );
    } catch (error) {
      // Record failure
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      this.metrics.recordMessageFailed(
        metadata.subject,
        metadata.domain,
        metadata.resource,
        metadata.action,
        'unknown',
        errorType
      );

      throw error;
    }
  }
}
