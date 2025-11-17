import { topicSubscriber } from 'nats-pubsub';
import { MessageContext, ErrorContext, ErrorAction } from 'nats-pubsub';
import { EmailService } from '../services/email-service.js';
import { OrderConfirmedEventSchema, OrderConfirmedEvent } from '../types.js';

@topicSubscriber<OrderConfirmedEvent>('order.confirmed', {
  maxDeliver: 3,
  ackWait: 30000,
})
export class OrderConfirmedSubscriber {
  constructor(private emailService: EmailService) {}

  async handle(message: OrderConfirmedEvent, context: MessageContext): Promise<void> {
    console.log(`[OrderConfirmedSubscriber] Processing event ${context.eventId}`);

    // Validate message
    const validated = OrderConfirmedEventSchema.parse(message);

    // Send order confirmation email
    await this.emailService.sendOrderConfirmationEmail(
      validated.orderId,
      validated.userId,
      validated.totalAmount,
      validated.transactionId
    );

    console.log(`[OrderConfirmedSubscriber] Processed event ${context.eventId}`);
  }

  async onError(errorContext: ErrorContext): Promise<ErrorAction> {
    const { error, attemptNumber, maxAttempts } = errorContext;

    console.error(`[OrderConfirmedSubscriber] Error processing message:`, {
      error: error.message,
      attemptNumber,
      maxAttempts,
    });

    // Retry on SMTP errors
    if (error.message.includes('SMTP') || error.message.includes('connection')) {
      if (attemptNumber < maxAttempts) {
        return ErrorAction.RETRY;
      }
    }

    // Send to DLQ on validation errors
    if (error.message.includes('validation')) {
      return ErrorAction.DLQ;
    }

    // Retry with exponential backoff for other errors
    if (attemptNumber < maxAttempts) {
      return ErrorAction.RETRY;
    }

    // Send to DLQ after max attempts
    return ErrorAction.DLQ;
  }
}
