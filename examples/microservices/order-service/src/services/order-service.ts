import { v4 as uuidv4 } from 'uuid';
import NatsPubsub from 'nats-pubsub';
import { Order, OrderStatus, OrderItem, CreateOrderSchema } from '../types.js';
import { OrderRepository } from '../repositories/order-repository.js';

export class OrderService {
  constructor(private orderRepository: OrderRepository) {}

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    // Validate input
    const validated = CreateOrderSchema.parse({ userId, items });

    // Calculate total
    const totalAmount = validated.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Create order
    const order: Omit<Order, 'createdAt' | 'updatedAt'> = {
      id: uuidv4(),
      userId: validated.userId,
      items: validated.items,
      totalAmount,
      status: OrderStatus.PENDING,
    };

    const createdOrder = await this.orderRepository.create(order);

    // Publish order.created event
    await NatsPubsub.publish('order.created', {
      orderId: createdOrder.id,
      userId: createdOrder.userId,
      items: createdOrder.items,
      totalAmount: createdOrder.totalAmount,
      createdAt: createdOrder.createdAt.toISOString(),
    });

    console.log(`Order created: ${createdOrder.id}`);
    return createdOrder;
  }

  async handleInventoryReserved(orderId: string, reservationId: string, success: boolean): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (success) {
      // Update order status
      await this.orderRepository.updateStatus(orderId, OrderStatus.INVENTORY_RESERVED);

      // Publish order.inventory_reserved event
      await NatsPubsub.publish('order.inventory_reserved', {
        orderId,
        reservationId,
      });

      console.log(`Inventory reserved for order: ${orderId}`);
    } else {
      // Cancel order if inventory reservation failed
      await this.orderRepository.updateStatus(orderId, OrderStatus.CANCELLED);

      // Publish order.cancelled event
      await NatsPubsub.publish('order.cancelled', {
        orderId,
        reason: 'Inventory reservation failed',
      });

      console.log(`Order cancelled due to inventory reservation failure: ${orderId}`);
    }
  }

  async handlePaymentProcessed(orderId: string, transactionId: string, success: boolean): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (success) {
      // Update order status to confirmed
      await this.orderRepository.updateStatus(orderId, OrderStatus.CONFIRMED);

      // Publish order.confirmed event
      await NatsPubsub.publish('order.confirmed', {
        orderId,
        transactionId,
        userId: order.userId,
        totalAmount: order.totalAmount,
      });

      console.log(`Order confirmed: ${orderId}`);
    } else {
      // Cancel order if payment failed
      await this.orderRepository.updateStatus(orderId, OrderStatus.CANCELLED);

      // Publish order.cancelled event
      await NatsPubsub.publish('order.cancelled', {
        orderId,
        reason: 'Payment processing failed',
      });

      console.log(`Order cancelled due to payment failure: ${orderId}`);
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderRepository.findById(orderId);
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return this.orderRepository.findByUserId(userId);
  }
}
