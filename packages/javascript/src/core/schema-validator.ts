import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Schema validator using Zod
 *
 * Provides runtime validation for messages with full TypeScript type inference.
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string().min(1),
 *   email: z.string().email()
 * });
 *
 * const validator = new SchemaValidator(UserSchema);
 * const result = validator.validate(data);
 *
 * if (!result.success) {
 *   console.error(result.errors);
 * }
 * ```
 */
export class SchemaValidator<T extends z.ZodType> {
  constructor(private schema: T) {}

  /**
   * Validate data against schema
   *
   * @param data - Data to validate
   * @returns Validation result
   */
  validate(data: unknown): ValidationResult<z.infer<T>> {
    try {
      const parsed = this.schema.parse(data);
      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          zodError: error,
        };
      }

      return {
        success: false,
        errors: [
          {
            path: '',
            message: error instanceof Error ? error.message : String(error),
            code: 'unknown',
          },
        ],
      };
    }
  }

  /**
   * Validate and throw on error
   *
   * @param data - Data to validate
   * @returns Parsed data
   * @throws ValidationError if validation fails
   */
  validateOrThrow(data: unknown): z.infer<T> {
    const result = this.validate(data);

    if (!result.success) {
      throw new ValidationError(
        `Schema validation failed: ${result.errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`,
        result.errors
      );
    }

    return result.data;
  }

  /**
   * Validate partially (for updates)
   *
   * @param data - Data to validate
   * @returns Validation result
   */
  validatePartial(data: unknown): ValidationResult<Partial<z.infer<T>>> {
    try {
      const partialSchema = this.schema.partial() as z.ZodType<Partial<z.infer<T>>>;
      const parsed = partialSchema.parse(data);
      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          zodError: error,
        };
      }

      return {
        success: false,
        errors: [
          {
            path: '',
            message: error instanceof Error ? error.message : String(error),
            code: 'unknown',
          },
        ],
      };
    }
  }

  /**
   * Get the underlying Zod schema
   *
   * @returns Zod schema
   */
  getSchema(): T {
    return this.schema;
  }
}

/**
 * Validation result
 */
export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      errors: ValidationErrorDetail[];
      zodError?: z.ZodError;
    };

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  code: string;
}

/**
 * Create a schema validator
 *
 * @param schema - Zod schema
 * @returns Schema validator instance
 *
 * @example
 * ```typescript
 * const validator = createValidator(z.object({ id: z.string() }));
 * const result = validator.validate(data);
 * ```
 */
export function createValidator<T extends z.ZodType>(schema: T): SchemaValidator<T> {
  return new SchemaValidator(schema);
}

/**
 * Validate data against a schema
 *
 * @param schema - Zod schema
 * @param data - Data to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateSchema(UserSchema, userData);
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const validator = new SchemaValidator(schema);
  return validator.validate(data);
}

/**
 * Common schemas for reuse
 */
export const CommonSchemas = {
  /**
   * UUID string
   */
  uuid: z.string().uuid(),

  /**
   * Email address
   */
  email: z.string().email(),

  /**
   * URL
   */
  url: z.string().url(),

  /**
   * ISO 8601 date string
   */
  isoDate: z.string().datetime(),

  /**
   * Positive integer
   */
  positiveInt: z.number().int().positive(),

  /**
   * Non-empty string
   */
  nonEmptyString: z.string().min(1),

  /**
   * Trace ID (hex string)
   */
  traceId: z.string().regex(/^[0-9a-fA-F]+$/),

  /**
   * Topic name (alphanumeric with dots, dashes, underscores)
   */
  topic: z.string().regex(/^[a-zA-Z0-9._-]+$/),
};

/**
 * Create a message schema with standard fields
 *
 * @param payloadSchema - Schema for the message payload
 * @returns Complete message schema
 *
 * @example
 * ```typescript
 * const UserCreatedMessageSchema = createMessageSchema(
 *   z.object({
 *     id: z.string().uuid(),
 *     name: z.string(),
 *     email: z.string().email()
 *   })
 * );
 * ```
 */
export function createMessageSchema<T extends z.ZodType>(payloadSchema: T) {
  return z.object({
    payload: payloadSchema,
    metadata: z
      .object({
        eventId: CommonSchemas.uuid.optional(),
        traceId: z.string().optional(),
        correlationId: z.string().optional(),
        occurredAt: z.date().optional(),
      })
      .optional(),
  });
}
