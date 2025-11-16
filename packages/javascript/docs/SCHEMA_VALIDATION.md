# Schema Validation with Zod

This guide shows you how to add runtime schema validation to your NatsPubsub messages using Zod.

## Why Schema Validation?

Schema validation provides:

- **Type Safety**: Runtime validation that messages match expected structure
- **Better Error Messages**: Clear validation errors instead of undefined behavior
- **Documentation**: Schemas serve as living documentation
- **Confidence**: Catch invalid messages before they cause problems

---

## Installation

```bash
# Zod is already included as a dependency
pnpm add nats-pubsub

# If using separately
pnpm add zod
```

---

## Basic Schema Validation

### Define Your Schema

```typescript
import { z } from 'zod';

// Define message schema
const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional(),
  createdAt: z.string().datetime(),
});

// Infer TypeScript type from schema
type UserCreatedMessage = z.infer<typeof UserCreatedSchema>;
```

### Create Validated Subscriber

```typescript
import { Subscriber, EventMetadata, ValidationError } from 'nats-pubsub';
import { z } from 'zod';

const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

type UserCreatedMessage = z.infer<typeof UserCreatedSchema>;

class UserCreatedSubscriber extends Subscriber<UserCreatedMessage> {
  constructor() {
    super('production.myapp.user.created');
  }

  async call(message: Record<string, unknown>, metadata: EventMetadata) {
    // Validate message
    const parseResult = UserCreatedSchema.safeParse(message);

    if (!parseResult.success) {
      throw new ValidationError('Invalid UserCreated message', parseResult.error.errors, {
        subject: metadata.subject,
        event_id: metadata.event_id,
      });
    }

    // Now we have fully typed, validated message
    const validatedMessage = parseResult.data;
    console.log(`User created: ${validatedMessage.name} <${validatedMessage.email}>`);

    // Your business logic here
    await this.processUser(validatedMessage);
  }

  private async processUser(user: UserCreatedMessage) {
    // Business logic with type-safe message
  }
}
```

---

## Reusable Validated Subscriber Base Class

Create a base class for all validated subscribers:

```typescript
import { Subscriber, EventMetadata, ValidationError } from 'nats-pubsub';
import { z, ZodSchema } from 'zod';

/**
 * Abstract base class for subscribers with built-in Zod validation
 */
export abstract class ValidatedSubscriber<TSchema extends ZodSchema> extends Subscriber<
  z.infer<TSchema>
> {
  protected abstract schema: TSchema;

  async call(message: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    const parseResult = this.schema.safeParse(message);

    if (!parseResult.success) {
      throw new ValidationError(
        `Validation failed for ${metadata.subject}`,
        parseResult.error.errors,
        { subject: metadata.subject, event_id: metadata.event_id }
      );
    }

    // Call the validated handler with typed message
    await this.handleValidated(parseResult.data, metadata);
  }

  /**
   * Handle validated message - implemented by subclasses
   * Message is fully validated and typed
   */
  protected abstract handleValidated(
    message: z.infer<TSchema>,
    metadata: EventMetadata
  ): Promise<void>;
}
```

### Usage

```typescript
const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

class UserCreatedSubscriber extends ValidatedSubscriber<typeof UserCreatedSchema> {
  protected schema = UserCreatedSchema;

  constructor() {
    super('production.myapp.user.created');
  }

  protected async handleValidated(message: z.infer<typeof UserCreatedSchema>) {
    // message is fully typed and validated!
    console.log(`User: ${message.name} <${message.email}>`);
  }
}
```

---

## Advanced Schema Patterns

### Nested Objects

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
});

const UserWithAddressSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  address: AddressSchema, // Nested schema
});
```

### Enums

```typescript
const OrderStatus = z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

const OrderSchema = z.object({
  id: z.string().uuid(),
  status: OrderStatus,
  total: z.number().positive(),
});
```

### Arrays

```typescript
const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const OrderSchema = z.object({
  id: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1), // At least one item
  total: z.number().positive(),
});
```

### Discriminated Unions

```typescript
const EmailNotificationSchema = z.object({
  type: z.literal('email'),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
});

const SmsNotificationSchema = z.object({
  type: z.literal('sms'),
  to: z.string().regex(/^\+\d{10,15}$/),
  message: z.string().max(160),
});

const NotificationSchema = z.discriminatedUnion('type', [
  EmailNotificationSchema,
  SmsNotificationSchema,
]);

class NotificationSubscriber extends ValidatedSubscriber<typeof NotificationSchema> {
  protected schema = NotificationSchema;

  constructor() {
    super('production.myapp.notification.*');
  }

  protected async handleValidated(message: z.infer<typeof NotificationSchema>) {
    if (message.type === 'email') {
      // TypeScript knows this is EmailNotification
      await this.sendEmail(message);
    } else {
      // TypeScript knows this is SmsNotification
      await this.sendSms(message);
    }
  }
}
```

### Optional and Nullable Fields

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(), // May be undefined
  middleName: z.string().nullable(), // May be null
  bio: z.string().optional().nullable(), // May be undefined or null
});
```

### Default Values

```typescript
const OrderSchema = z.object({
  id: z.string().uuid(),
  status: z.string().default('pending'),
  priority: z.number().default(0),
  tags: z.array(z.string()).default([]),
});
```

### Transformations

```typescript
const DateStringSchema = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

const EventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  occurredAt: DateStringSchema, // Automatically transforms to Date object
  amount: z.string().transform((val) => parseFloat(val)), // String to number
});
```

---

## Publishing with Validation

Validate messages before publishing:

```typescript
import NatsPubsub from 'nats-pubsub';
import { z } from 'zod';

const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

async function publishUserCreated(userData: unknown) {
  // Validate before publishing
  const parseResult = UserCreatedSchema.safeParse(userData);

  if (!parseResult.success) {
    console.error('Invalid user data:', parseResult.error.errors);
    throw new Error('Cannot publish invalid user data');
  }

  // Publish validated data
  await NatsPubsub.publish('user.created', parseResult.data);
}

// Usage
try {
  await publishUserCreated({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Alice',
    email: 'alice@example.com',
  });
} catch (error) {
  console.error('Publish failed:', error);
}
```

---

## Error Handling

### Handling Validation Errors

```typescript
import { ValidationError } from 'nats-pubsub';

class UserSubscriber extends ValidatedSubscriber<typeof UserCreatedSchema> {
  protected schema = UserCreatedSchema;

  constructor() {
    super('production.myapp.user.created');
  }

  protected async handleValidated(message: z.infer<typeof UserCreatedSchema>) {
    await User.create(message);
  }

  // Override call to add custom error handling
  async call(message: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    try {
      await super.call(message, metadata);
    } catch (error) {
      if (error instanceof ValidationError) {
        // Log validation errors differently
        console.error('Message validation failed:', {
          subject: metadata.subject,
          eventId: metadata.event_id,
          errors: error.validationErrors,
          message: message,
        });

        // Don't retry validation errors - ack the message
        return;
      }

      // Re-throw other errors for retry
      throw error;
    }
  }
}
```

### Logging Validation Errors

```typescript
class ValidationLoggingMiddleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>
  ): Promise<void> {
    try {
      await next();
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error('Validation error:', {
          subject: metadata.subject,
          eventId: metadata.event_id,
          errors: error.validationErrors,
          context: error.context,
          resolution: error.resolution,
        });
      }
      throw error;
    }
  }
}

NatsPubsub.use(new ValidationLoggingMiddleware());
```

---

## Schema Versioning

Handle multiple schema versions:

```typescript
const UserCreatedSchemaV1 = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

const UserCreatedSchemaV2 = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
});

class UserCreatedSubscriber extends Subscriber {
  constructor() {
    super('production.myapp.user.created');
  }

  async call(message: Record<string, unknown>, metadata: EventMetadata) {
    const schemaVersion = metadata.schema_version || 1;

    switch (schemaVersion) {
      case 1:
        return this.handleV1(UserCreatedSchemaV1.parse(message));
      case 2:
        return this.handleV2(UserCreatedSchemaV2.parse(message));
      default:
        throw new Error(`Unsupported schema version: ${schemaVersion}`);
    }
  }

  private async handleV1(message: z.infer<typeof UserCreatedSchemaV1>) {
    // Handle v1 schema
  }

  private async handleV2(message: z.infer<typeof UserCreatedSchemaV2>) {
    // Handle v2 schema
  }
}
```

---

## Testing with Validation

### Test Fixtures

```typescript
import { z } from 'zod';

const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

// Create valid test fixtures
const createValidUserMessage = (
  overrides?: Partial<z.infer<typeof UserCreatedSchema>>
): z.infer<typeof UserCreatedSchema> => {
  return UserCreatedSchema.parse({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  });
};

// Usage in tests
describe('UserCreatedSubscriber', () => {
  it('processes valid messages', async () => {
    const message = createValidUserMessage({ name: 'Alice' });
    const subscriber = new UserCreatedSubscriber();

    await subscriber.call(message, {
      event_id: 'test-id',
      subject: 'production.myapp.user.created',
      // ... other metadata
    });

    // Assertions
  });

  it('rejects invalid email', async () => {
    const subscriber = new UserCreatedSubscriber();

    await expect(
      subscriber.call(
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Alice',
          email: 'invalid-email', // Invalid
        },
        { event_id: 'test-id', subject: 'test' } as EventMetadata
      )
    ).rejects.toThrow(ValidationError);
  });
});
```

---

## Best Practices

### 1. Define Schemas Close to Usage

```typescript
// schemas/user-events.ts
export const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

export type UserCreatedMessage = z.infer<typeof UserCreatedSchema>;
```

### 2. Share Schemas Between Publisher and Subscriber

```typescript
// schemas/user-events.ts - Shared file
export const UserCreatedSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

// publisher-service/user-service.ts
import { UserCreatedSchema } from './schemas/user-events';

async function createUser(data: unknown) {
  const user = UserCreatedSchema.parse(data);
  await NatsPubsub.publish('user.created', user);
}

// subscriber-service/user-subscriber.ts
import { UserCreatedSchema } from './schemas/user-events';

class UserSubscriber extends ValidatedSubscriber<typeof UserCreatedSchema> {
  protected schema = UserCreatedSchema;
  // ...
}
```

### 3. Use Strict Validation

```typescript
// Be explicit about what's allowed
const UserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  })
  .strict(); // Reject unknown keys
```

### 4. Add Custom Error Messages

```typescript
const UserSchema = z.object({
  id: z.string().uuid('Invalid UUID format for user ID'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  age: z
    .number()
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(150, 'Age too high'),
});
```

### 5. Document Your Schemas

```typescript
/**
 * User created event schema
 *
 * Published when a new user account is created
 * Topic: user.created
 * Version: 1.0.0
 */
const UserCreatedSchema = z.object({
  /** UUID v4 of the user */
  id: z.string().uuid(),

  /** User's full name (1-100 characters) */
  name: z.string().min(1).max(100),

  /** User's email address */
  email: z.string().email(),

  /** ISO 8601 timestamp when user was created */
  createdAt: z.string().datetime(),
});
```

---

## Complete Example

```typescript
import NatsPubsub, { ValidationError, EventMetadata } from 'nats-pubsub';
import { z, ZodSchema } from 'zod';

// ============================================
// 1. Define Schema
// ============================================
const OrderPlacedSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    )
    .min(1),
  total: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  placedAt: z.string().datetime(),
});

type OrderPlacedMessage = z.infer<typeof OrderPlacedSchema>;

// ============================================
// 2. Validated Subscriber Base
// ============================================
abstract class ValidatedSubscriber<TSchema extends ZodSchema> extends Subscriber<z.infer<TSchema>> {
  protected abstract schema: TSchema;

  async call(message: Record<string, unknown>, metadata: EventMetadata): Promise<void> {
    const parseResult = this.schema.safeParse(message);

    if (!parseResult.success) {
      throw new ValidationError(
        `Validation failed for ${metadata.subject}`,
        parseResult.error.errors,
        { subject: metadata.subject, event_id: metadata.event_id }
      );
    }

    await this.handleValidated(parseResult.data, metadata);
  }

  protected abstract handleValidated(
    message: z.infer<TSchema>,
    metadata: EventMetadata
  ): Promise<void>;
}

// ============================================
// 3. Implement Subscriber
// ============================================
class OrderPlacedSubscriber extends ValidatedSubscriber<typeof OrderPlacedSchema> {
  protected schema = OrderPlacedSchema;

  constructor() {
    super('production.shop.order.placed');
  }

  protected async handleValidated(message: OrderPlacedMessage, metadata: EventMetadata) {
    console.log(`Processing order ${message.orderId} for $${message.total} ${message.currency}`);

    // Fully typed message - no casting needed!
    for (const item of message.items) {
      await this.processOrderItem(item.productId, item.quantity);
    }

    await this.sendConfirmationEmail(message.userId, message.orderId);
  }

  private async processOrderItem(productId: string, quantity: number) {
    // Implementation
  }

  private async sendConfirmationEmail(userId: string, orderId: string) {
    // Implementation
  }
}

// ============================================
// 4. Setup and Start
// ============================================
NatsPubsub.configure({
  natsUrls: 'nats://localhost:4222',
  env: 'production',
  appName: 'shop',
});

const subscriber = new OrderPlacedSubscriber();
NatsPubsub.registerSubscriber(subscriber);

await NatsPubsub.start();
```

---

## Resources

- [Zod Documentation](https://zod.dev/)
- [NatsPubsub Validation API](../src/core/validation.ts)
- [TypeScript Best Practices](./TYPESCRIPT_BEST_PRACTICES.md)
- [Error Handling Guide](./ERROR_HANDLING.md)

---

**Last updated**: 2025-11-17
