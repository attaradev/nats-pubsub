import pg from 'pg';
import { Order, OrderStatus, OrderItem } from '../types.js';
import config from '../config.js';

const { Pool } = pg;

export class OrderRepository {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    // Create orders table if it doesn't exist
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        items JSONB NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
    console.log('Order repository initialized');
  }

  async create(order: Omit<Order, 'createdAt' | 'updatedAt'>): Promise<Order> {
    const result = await this.pool.query(
      `INSERT INTO orders (id, user_id, items, total_amount, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [order.id, order.userId, JSON.stringify(order.items), order.totalAmount, order.status]
    );

    return this.mapRowToOrder(result.rows[0]);
  }

  async findById(id: string): Promise<Order | null> {
    const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToOrder(result.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(this.mapRowToOrder);
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
    const result = await this.pool.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, orderId]
    );

    return result.rows.length > 0 ? this.mapRowToOrder(result.rows[0]) : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private mapRowToOrder(row: any): Order {
    return {
      id: row.id,
      userId: row.user_id,
      items: row.items as OrderItem[],
      totalAmount: parseFloat(row.total_amount),
      status: row.status as OrderStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
