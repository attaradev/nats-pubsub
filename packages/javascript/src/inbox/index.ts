/**
 * Inbox Pattern for Idempotent Message Processing
 *
 * The Inbox pattern ensures messages are processed exactly once by:
 * 1. Checking if message was already processed (by event_id or stream_seq)
 * 2. Marking message as processing
 * 3. Processing the message
 * 4. Marking as processed
 *
 * This prevents duplicate processing of the same message.
 *
 * @module inbox
 */

// Types
export * from './types';

// Core implementation
export { InboxProcessor } from './inbox-processor';

// Repository implementations
export { MemoryInboxRepository } from './memory-inbox-repository';

// SQL schemas for various databases
export * from './sql-schemas';
