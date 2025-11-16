import { EventMetadata, Middleware } from '../types';
import config from '../core/config';

export class LoggingMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    const logger = config.logger;
    const startTime = Date.now();

    logger.info('Processing event', {
      event_id: metadata.event_id,
      subject: metadata.subject,
      action: metadata.action,
    });

    try {
      await next();
      const duration = Date.now() - startTime;
      logger.info('Event processed successfully', {
        event_id: metadata.event_id,
        duration_ms: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Event processing failed', {
        event_id: metadata.event_id,
        duration_ms: duration,
        error,
      });
      throw error;
    }
  }
}

export default new LoggingMiddleware();
