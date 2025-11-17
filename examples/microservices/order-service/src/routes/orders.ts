import { Router } from 'express';
import { OrderService } from '../services/order-service.js';

export function ordersRouter(orderService: OrderService): Router {
  const router = Router();

  // Create order
  router.post('/', async (req, res, next) => {
    try {
      const { userId, items } = req.body;

      if (!userId || !items || !Array.isArray(items)) {
        res.status(400).json({ error: 'Invalid request body' });
        return;
      }

      const order = await orderService.createOrder(userId, items);
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  });

  // Get order by ID
  router.get('/:orderId', async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const order = await orderService.getOrder(orderId);

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  // Get user orders
  router.get('/user/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      const orders = await orderService.getUserOrders(userId);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
