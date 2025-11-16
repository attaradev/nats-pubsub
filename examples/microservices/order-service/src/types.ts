import { z } from 'zod';

export enum OrderStatus {
  PENDING = 'PENDING',
  INVENTORY_RESERVED = 'INVENTORY_RESERVED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

// Zod schemas for validation
export const OrderItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

export const CreateOrderSchema = z.object({
  userId: z.string(),
  items: z.array(OrderItemSchema).min(1),
});

export const OrderCreatedEventSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  items: z.array(OrderItemSchema),
  totalAmount: z.number(),
  createdAt: z.string(),
});

export const InventoryReservedEventSchema = z.object({
  orderId: z.string(),
  reservationId: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
});

export const PaymentProcessedEventSchema = z.object({
  orderId: z.string(),
  transactionId: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
});
