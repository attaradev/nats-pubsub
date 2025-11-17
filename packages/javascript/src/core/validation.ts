/**
 * Runtime validation utilities using Zod
 *
 * Provides schema-based validation for messages, configuration, and metadata.
 * Enables type-safe runtime validation with helpful error messages.
 *
 * @module validation
 */

import { z } from 'zod';
import { EventMetadata, NatsPubsubConfig } from '../types';

/**
 * Zod schema for event metadata validation
 */
export const EventMetadataSchema = z.object({
  event_id: z.string().min(1, 'Event ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  domain: z.string().min(1, 'Domain is required'),
  resource: z.string().min(1, 'Resource is required'),
  action: z.string().min(1, 'Action is required'),
  stream: z.string().optional(),
  stream_seq: z.number().int().positive().optional(),
  deliveries: z.number().int().positive().optional(),
  trace_id: z.string().optional(),
});

/**
 * Zod schema for NATS PubSub configuration validation
 */
export const ConfigSchema = z.object({
  natsUrls: z.union([z.string(), z.array(z.string())]),
  env: z.string().min(1, 'Environment is required'),
  appName: z.string().min(1, 'Application name is required'),
  concurrency: z.number().int().positive().optional(),
  maxDeliver: z.number().int().positive().optional(),
  ackWait: z.number().int().positive().optional(),
  backoff: z.array(z.number().int().positive()).optional(),
  useOutbox: z.boolean().optional(),
  useInbox: z.boolean().optional(),
  useDlq: z.boolean().optional(),
  streamName: z.string().optional(),
  dlqSubject: z.string().optional(),
  metrics: z
    .object({
      recordDlqMessage: z.function(),
    })
    .passthrough()
    .optional(),
  perMessageConcurrency: z.number().int().positive().optional(),
  subscriberTimeoutMs: z.number().int().positive().optional(),
  dlqMaxAttempts: z.number().int().positive().optional(),
  logger: z
    .object({
      debug: z.function(),
      info: z.function(),
      warn: z.function(),
      error: z.function(),
    })
    .passthrough()
    .optional(),
}) as z.ZodType<NatsPubsubConfig>;

/**
 * Validation error class for schema validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates data against a Zod schema
 *
 * @template T - The type of the schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param errorMessage - Optional custom error message
 * @returns The validated and typed data
 * @throws ValidationError if validation fails
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string(),
 *   name: z.string().min(1),
 *   email: z.string().email(),
 * });
 *
 * const user = validate(UserSchema, rawData, 'Invalid user data');
 * // user is now typed as { id: string; name: string; email: string }
 * ```
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
  errorMessage?: string
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const message =
      errorMessage || `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`;
    throw new ValidationError(message, result.error.issues);
  }

  return result.data;
}

/**
 * Creates a type-safe subscriber with runtime message validation
 *
 * @template TMessage - The schema type for the message
 * @param messageSchema - Zod schema for validating incoming messages
 * @param handler - Handler function that receives validated messages
 * @returns A subscriber call function with runtime validation
 *
 * @example
 * ```typescript
 * const UserCreatedSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * class UserSubscriber extends Subscriber {
 *   private validatedHandle = createValidatedSubscriber(
 *     UserCreatedSchema,
 *     async (message, metadata) => {
 *       // message is typed and validated!
 *       console.log(message.email); // TypeScript knows this is a string
 *     }
 *   );
 *
 *   async handle(message: Record<string, unknown>, metadata: EventMetadata) {
 *     return this.validatedHandle(message, metadata);
 *   }
 * }
 * ```
 */
export function createValidatedSubscriber<T extends z.ZodType>(
  messageSchema: T,
  handler: (message: z.infer<T>, metadata: EventMetadata) => Promise<void>
): (message: Record<string, unknown>, metadata: EventMetadata) => Promise<void> {
  return async (message: Record<string, unknown>, metadata: EventMetadata): Promise<void> => {
    const validatedMessage = validate(
      messageSchema,
      message,
      `Invalid message format for subject ${metadata.subject}`
    );
    return handler(validatedMessage, metadata);
  };
}

/**
 * Validates configuration at runtime
 *
 * @param config - Configuration object to validate
 * @returns Validated configuration
 * @throws ValidationError if configuration is invalid
 *
 * @example
 * ```typescript
 * const config = validateConfig({
 *   natsUrls: 'nats://localhost:4222',
 *   env: 'development',
 *   appName: 'my-app',
 * });
 * ```
 */
export function validateConfig(config: unknown): NatsPubsubConfig {
  return validate(ConfigSchema, config, 'Invalid NatsPubsub configuration');
}

/**
 * Validates event metadata at runtime
 *
 * @param metadata - Metadata object to validate
 * @returns Validated metadata
 * @throws ValidationError if metadata is invalid
 *
 * @example
 * ```typescript
 * const metadata = validateMetadata(rawMetadata);
 * ```
 */
export function validateMetadata(metadata: unknown): EventMetadata {
  return validate(EventMetadataSchema, metadata, 'Invalid event metadata');
}

// Re-export Zod for convenience
export { z } from 'zod';
