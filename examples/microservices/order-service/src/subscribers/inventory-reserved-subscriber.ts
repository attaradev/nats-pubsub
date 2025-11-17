import { topicSubscriber } from 'nats-pubsub';
import { MessageContext, ErrorContext, ErrorAction } from 'nats-pubsub';
import { OrderService } from '../services/order-service.js';
import { InventoryReservedEventSchema } from '../types.js';

interface InventoryReservedMessage {
  orderId: string;
  reservationId: string;
  success: boolean;
  message?: string;
}

@topicSubscriber<InventoryReservedMessage>('inventory.reserved', {
  maxDeliver: 5,
  ackWait: 30000,
})
export class InventoryReservedSubscriber {
  constructor(private orderService: OrderService) {}

  async handle(message: InventoryReservedMessage, context: MessageContext): Promise<void> {
    console.log(`[InventoryReservedSubscriber] Processing event ${context.eventId}`);

    // Validate message
    const validated = InventoryReservedEventSchema.parse(message);

    // Handle inventory reservation
    await this.orderService.handleInventoryReserved(
      validated.orderId,
      validated.reservationId,
      validated.success
    );

    console.log(`[InventoryReservedSubscriber] Processed event ${context.eventId}`);
  }

  async onError(errorContext: ErrorContext): Promise<ErrorAction> {
    const { error, attemptNumber, maxAttempts } = errorContext;

    console.error(`[InventoryReservedSubscriber] Error processing message:`, {
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
