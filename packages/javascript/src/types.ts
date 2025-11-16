import { NatsConnection, JetStreamClient } from 'nats';

export interface NatsPubsubConfig {
  natsUrls: string | string[];
  env: string;
  appName: string;
  concurrency?: number;
  maxDeliver?: number;
  ackWait?: number; // in milliseconds
  backoff?: number[]; // array of milliseconds
  useOutbox?: boolean;
  useInbox?: boolean;
  useDlq?: boolean;
  streamName?: string;
  dlqSubject?: string;
  logger?: Logger;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface EventEnvelope {
  event_id: string;
  schema_version: number;
  event_type: string;
  producer: string;
  resource_type: string;
  resource_id?: string;
  occurred_at: string;
  trace_id?: string;
  payload: Record<string, unknown>;
}

export interface EventMetadata {
  event_id: string;
  subject: string;
  domain: string;
  resource: string;
  action: string;
  stream?: string;
  stream_seq?: number;
  deliveries?: number;
  trace_id?: string;
}

export interface PublishOptions {
  event_id?: string;
  trace_id?: string;
  occurred_at?: Date;
}

export interface SubscriberOptions {
  retry?: number;
  ackWait?: number;
  maxDeliver?: number;
}

export interface Subscriber {
  subjects: string[];
  options?: SubscriberOptions;
  call(event: Record<string, unknown>, metadata: EventMetadata): Promise<void>;
}

export interface Middleware {
  call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void>;
}

export interface ConnectionManager {
  connection: NatsConnection | null;
  jetstream: JetStreamClient | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ensureConnection(): Promise<void>;
}

export type MessageHandler = (
  event: Record<string, unknown>,
  metadata: EventMetadata
) => Promise<void>;
