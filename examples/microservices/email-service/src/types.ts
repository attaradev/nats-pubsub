import { z } from 'zod';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Event schemas
export const OrderConfirmedEventSchema = z.object({
  orderId: z.string(),
  transactionId: z.string(),
  userId: z.string(),
  totalAmount: z.number(),
});

export interface OrderConfirmedEvent {
  orderId: string;
  transactionId: string;
  userId: string;
  totalAmount: number;
}
