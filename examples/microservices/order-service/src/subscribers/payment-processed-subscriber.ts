import { topicSubscriber } from 'nats-pubsub';
import { MessageContext, ErrorContext, ErrorAction } from 'nats-pubsub';
import { OrderService } from '../services/order-service.js';
import { PaymentProcessedEventSchema } from '../types.js';

interface PaymentProcessedMessage {
  orderId: string;
  transactionId: string;
  success: boolean;
  message?: string;
}

@topicSubscriber<PaymentProcessedMessage>('payment.processed', {
  maxDeliver: 5,
  ackWait: 30000,
})
export class PaymentProcessedSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(message: PaymentProcessedMessage, context: MessageContext): Promise<void> {
    console.log(`[PaymentProcessedSubscriber] Processing event ${context.eventId}`);

    // Validate message
    const validated = PaymentProcessedEventSchema.parse(message);

    // Handle payment processing
    await this.orderService.handlePaymentProcessed(
      validated.orderId,
      validated.transactionId,
      validated.success
    );

    console.log(`[PaymentProcessedSubscriber] Processed event ${context.eventId}`);
  }

  async onError(errorContext: ErrorContext): Promise<ErrorAction> {
    const { error, attemptNumber, maxAttempts } = errorContext;

    console.error(`[PaymentProcessedSubscriber] Error processing message:`, {
      error: error.message,
      attemptNumber,
      maxAttempts,
    });

    // Retry on transient errors
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      return ErrorAction.RETRY;
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
