import { JsMsg, headers as natsHeaders } from 'nats';
import connection from '../core/connection';
import config from '../core/config';

/**
 * DlqHandler handles dead letter queue operations
 *
 * Responsibilities:
 * - Publish failed messages to DLQ
 * - Handle message failures with retry logic
 * - Manage message acknowledgements
 */
export class DlqHandler {
  /**
   * Handle a message processing failure
   *
   * @param msg - The NATS message that failed
   * @param error - The error that occurred
   * @param extra - Additional context to include in DLQ message
   */
  async handleFailure(msg: JsMsg, error: unknown, extra?: Record<string, unknown>): Promise<void> {
    const logger = config.logger;
    const cfg = config.get();
    const deliveries = msg.info?.deliveryCount ?? 0;
    const maxDeliver = cfg.maxDeliver || 5;
    const exceededMaxDeliver = deliveries >= maxDeliver;

    if (cfg.useDlq) {
      try {
        await this.publishToDlq(
          msg,
          error,
          exceededMaxDeliver ? 'max_deliver_exceeded' : 'handler_error',
          extra
        );
        // Only ack after DLQ publish succeeds
        msg.ack();
        return;
      } catch (dlqError) {
        logger.error('Failed to publish to DLQ', {
          subject: msg.subject,
          error: dlqError,
        });
        // Fall through to NAK so the message can be retried
      }
    }

    if (exceededMaxDeliver || deliveries >= (cfg.dlqMaxAttempts || 3)) {
      logger.warn('Message exceeded max_deliver; dropping', {
        subject: msg.subject,
        deliveries,
      });
      msg.term();
    } else {
      msg.nak(); // Negative acknowledge for retry
    }
  }

  /**
   * Publish a failed message to the DLQ with context
   *
   * @param msg - The NATS message that failed
   * @param error - The error that occurred
   * @param reason - Reason for DLQ (e.g., 'max_deliver_exceeded', 'handler_error')
   * @param extra - Additional context to include
   */
  private async publishToDlq(
    msg: JsMsg,
    error: unknown,
    reason: string,
    extra?: Record<string, unknown>
  ): Promise<void> {
    const js = connection.getJetStream();
    const cfg = config.get();
    const rawBuffer = msg.data ? Buffer.from(msg.data) : Buffer.alloc(0);
    const rawPayload = rawBuffer.toString('utf8');
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      parsedPayload = rawPayload; // Keep raw if not JSON
    }

    const traceId =
      (parsedPayload as { trace_id?: string })?.trace_id || msg.headers?.get('trace_id');

    const payload = {
      event_id:
        (parsedPayload as { event_id?: string })?.event_id ||
        msg.headers?.get('nats-msg-id') ||
        msg.sid.toString(),
      original_subject: msg.subject,
      payload: parsedPayload,
      raw_base64: rawBuffer.toString('base64'),
      headers: msg.headers ? Object.fromEntries(msg.headers) : undefined,
      deliveries: msg.info?.deliveryCount ?? 0,
      reason,
      error:
        error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? 'unknown'),
      occurred_at: new Date().toISOString(),
      trace_id: traceId || undefined,
      ...extra,
    };

    if (!cfg.dlqSubject) {
      throw new Error('DLQ subject is not configured');
    }

    const hdrs = natsHeaders();
    hdrs.set('x-dead-letter', 'true');
    hdrs.set('x-dlq-reason', reason);
    hdrs.set('x-deliveries', String(msg.info?.deliveryCount ?? 0));
    if (payload.event_id) hdrs.set('x-event-id', payload.event_id);
    if (traceId) hdrs.set('x-trace-id', traceId);

    await js.publish(cfg.dlqSubject, Buffer.from(JSON.stringify(payload)), {
      headers: hdrs,
      expect: { streamName: cfg.streamName },
    });
    cfg.metrics?.recordDlqMessage?.(msg.subject, reason);

    config.logger.warn('Message moved to DLQ', {
      subject: msg.subject,
      deliveries: msg.info?.deliveryCount,
      reason,
    });
  }
}
