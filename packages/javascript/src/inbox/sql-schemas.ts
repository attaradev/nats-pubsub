/**
 * SQL schema definitions for Inbox pattern
 *
 * These schemas can be used with any SQL database (PostgreSQL, MySQL, SQLite, etc.)
 * Adapt the syntax as needed for your specific database.
 */

/**
 * PostgreSQL schema for inbox events
 */
export const POSTGRES_INBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS nats_inbox_events (
  event_id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(512) NOT NULL,
  payload TEXT NOT NULL,
  headers TEXT NOT NULL,
  stream VARCHAR(255),
  stream_seq BIGINT,
  deliveries INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  last_error TEXT,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint on stream + sequence for JetStream deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_stream_seq
  ON nats_inbox_events(stream, stream_seq)
  WHERE stream IS NOT NULL AND stream_seq IS NOT NULL;

-- Index for finding processed events
CREATE INDEX IF NOT EXISTS idx_inbox_status_processed
  ON nats_inbox_events(status, processed_at)
  WHERE status = 'processed' AND processed_at IS NOT NULL;

-- Index for finding failed events
CREATE INDEX IF NOT EXISTS idx_inbox_status_failed
  ON nats_inbox_events(status, received_at)
  WHERE status = 'failed';

-- Index for stale processing queries
CREATE INDEX IF NOT EXISTS idx_inbox_stale_processing
  ON nats_inbox_events(status, updated_at)
  WHERE status = 'processing';
`;

/**
 * MySQL schema for inbox events
 */
export const MYSQL_INBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS nats_inbox_events (
  event_id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(512) NOT NULL,
  payload LONGTEXT NOT NULL,
  headers TEXT NOT NULL,
  stream VARCHAR(255),
  stream_seq BIGINT,
  deliveries INT NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  last_error TEXT,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_inbox_stream_seq (stream, stream_seq),
  INDEX idx_inbox_status_processed (status, processed_at),
  INDEX idx_inbox_status_failed (status, received_at),
  INDEX idx_inbox_stale_processing (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * SQLite schema for inbox events
 */
export const SQLITE_INBOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS nats_inbox_events (
  event_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  payload TEXT NOT NULL,
  headers TEXT NOT NULL,
  stream TEXT,
  stream_seq INTEGER,
  deliveries INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'processing',
  last_error TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_stream_seq
  ON nats_inbox_events(stream, stream_seq)
  WHERE stream IS NOT NULL AND stream_seq IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_status_processed
  ON nats_inbox_events(status, processed_at);

CREATE INDEX IF NOT EXISTS idx_inbox_status_failed
  ON nats_inbox_events(status, received_at);

CREATE INDEX IF NOT EXISTS idx_inbox_stale_processing
  ON nats_inbox_events(status, updated_at);
`;

/**
 * TypeORM entity example
 */
export const TYPEORM_INBOX_ENTITY = `
import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('nats_inbox_events')
@Unique('idx_inbox_stream_seq', ['stream', 'streamSeq'])
@Index('idx_inbox_status_processed', ['status', 'processedAt'])
@Index('idx_inbox_status_failed', ['status', 'receivedAt'])
export class InboxEvent {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  eventId!: string;

  @Column({ type: 'varchar', length: 512 })
  subject!: string;

  @Column({ type: 'text' })
  payload!: string;

  @Column({ type: 'text' })
  headers!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stream?: string;

  @Column({ type: 'bigint', nullable: true })
  streamSeq?: number;

  @Column({ type: 'int', default: 1 })
  deliveries!: number;

  @Column({ type: 'varchar', length: 50, default: 'processing' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
`;

/**
 * Prisma schema example
 */
export const PRISMA_INBOX_SCHEMA = `
model NatsInboxEvent {
  eventId     String    @id @map("event_id") @db.VarChar(255)
  subject     String    @db.VarChar(512)
  payload     String    @db.Text
  headers     String    @db.Text
  stream      String?   @db.VarChar(255)
  streamSeq   BigInt?   @map("stream_seq")
  deliveries  Int       @default(1)
  status      String    @default("processing") @db.VarChar(50)
  lastError   String?   @map("last_error") @db.Text
  receivedAt  DateTime  @default(now()) @map("received_at")
  processedAt DateTime? @map("processed_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@unique([stream, streamSeq], map: "idx_inbox_stream_seq")
  @@index([status, processedAt], map: "idx_inbox_status_processed")
  @@index([status, receivedAt], map: "idx_inbox_status_failed")
  @@map("nats_inbox_events")
}
`;

/**
 * Knex.js migration example
 */
export const KNEX_INBOX_MIGRATION = `
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('nats_inbox_events', (table) => {
    table.string('event_id', 255).primary();
    table.string('subject', 512).notNullable();
    table.text('payload').notNullable();
    table.text('headers').notNullable();
    table.string('stream', 255);
    table.bigInteger('stream_seq');
    table.integer('deliveries').notNullable().defaultTo(1);
    table.string('status', 50).notNullable().defaultTo('processing');
    table.text('last_error');
    table.timestamp('received_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('processed_at');
    table.timestamps(true, true);

    table.unique(['stream', 'stream_seq'], { indexName: 'idx_inbox_stream_seq' });
    table.index(['status', 'processed_at'], 'idx_inbox_status_processed');
    table.index(['status', 'received_at'], 'idx_inbox_status_failed');
    table.index(['status', 'updated_at'], 'idx_inbox_stale_processing');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('nats_inbox_events');
}
`;
