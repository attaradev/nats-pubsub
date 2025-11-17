/**
 * SQL schema definitions for Outbox pattern
 *
 * These schemas can be used with any SQL database (PostgreSQL, MySQL, SQLite, etc.)
 * Adapt the syntax as needed for your specific database.
 */

/**
 * PostgreSQL schema for outbox events
 */
export const POSTGRES_OUTBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS nats_outbox_events (
  event_id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(512) NOT NULL,
  payload TEXT NOT NULL,
  headers TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  enqueued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding pending events
CREATE INDEX IF NOT EXISTS idx_outbox_status_enqueued
  ON nats_outbox_events(status, enqueued_at)
  WHERE status IN ('pending', 'publishing');

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_outbox_sent_at
  ON nats_outbox_events(sent_at)
  WHERE status = 'sent' AND sent_at IS NOT NULL;

-- Index for stale publishing queries
CREATE INDEX IF NOT EXISTS idx_outbox_stale_publishing
  ON nats_outbox_events(status, updated_at)
  WHERE status = 'publishing';
`;

/**
 * MySQL schema for outbox events
 */
export const MYSQL_OUTBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS nats_outbox_events (
  event_id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(512) NOT NULL,
  payload LONGTEXT NOT NULL,
  headers TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  enqueued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_outbox_status_enqueued (status, enqueued_at),
  INDEX idx_outbox_sent_at (sent_at),
  INDEX idx_outbox_stale_publishing (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * SQLite schema for outbox events
 */
export const SQLITE_OUTBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS nats_outbox_events (
  event_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  payload TEXT NOT NULL,
  headers TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  enqueued_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_enqueued
  ON nats_outbox_events(status, enqueued_at);

CREATE INDEX IF NOT EXISTS idx_outbox_sent_at
  ON nats_outbox_events(sent_at);

CREATE INDEX IF NOT EXISTS idx_outbox_stale_publishing
  ON nats_outbox_events(status, updated_at);
`;

/**
 * TypeORM entity example
 */
export const TYPEORM_OUTBOX_ENTITY = `
import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('nats_outbox_events')
@Index('idx_outbox_status_enqueued', ['status', 'enqueuedAt'])
export class OutboxEvent {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  eventId!: string;

  @Column({ type: 'varchar', length: 512 })
  subject!: string;

  @Column({ type: 'text' })
  payload!: string;

  @Column({ type: 'text' })
  headers!: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  enqueuedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
`;

/**
 * Prisma schema example
 */
export const PRISMA_OUTBOX_SCHEMA = `
model NatsOutboxEvent {
  eventId    String   @id @map("event_id") @db.VarChar(255)
  subject    String   @db.VarChar(512)
  payload    String   @db.Text
  headers    String   @db.Text
  status     String   @default("pending") @db.VarChar(50)
  attempts   Int      @default(0)
  lastError  String?  @map("last_error") @db.Text
  enqueuedAt DateTime @default(now()) @map("enqueued_at")
  sentAt     DateTime? @map("sent_at")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@index([status, enqueuedAt], map: "idx_outbox_status_enqueued")
  @@index([sentAt], map: "idx_outbox_sent_at")
  @@map("nats_outbox_events")
}
`;

/**
 * Knex.js migration example
 */
export const KNEX_OUTBOX_MIGRATION = `
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('nats_outbox_events', (table) => {
    table.string('event_id', 255).primary();
    table.string('subject', 512).notNullable();
    table.text('payload').notNullable();
    table.text('headers').notNullable();
    table.string('status', 50).notNullable().defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.text('last_error');
    table.timestamp('enqueued_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('sent_at');
    table.timestamps(true, true);

    table.index(['status', 'enqueued_at'], 'idx_outbox_status_enqueued');
    table.index(['sent_at'], 'idx_outbox_sent_at');
    table.index(['status', 'updated_at'], 'idx_outbox_stale_publishing');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('nats_outbox_events');
}
`;
