import { EventMetadata, Middleware } from '../types';
import config from '../core/config';

export class RetryLoggerMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    const logger = config.logger;

    if (metadata.deliveries && metadata.deliveries > 1) {
      logger.warn('Retrying event', {
        event_id: metadata.event_id,
        subject: metadata.subject,
        delivery_count: metadata.deliveries,
      });
    }

    await next();
  }
}

export default new RetryLoggerMiddleware();
