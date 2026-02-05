# Configuration Reference

Complete configuration reference for NatsPubsub (JavaScript/TypeScript and Ruby).

## Table of Contents

- [JavaScript/TypeScript Configuration](#javascripttypescript-configuration)
- [Ruby Configuration](#ruby-configuration)
- [Connection Settings](#connection-settings)
- [Stream Settings](#stream-settings)
- [Consumer Settings](#consumer-settings)
- [Inbox/Outbox Settings](#inboxoutbox-settings)
- [Logging Configuration](#logging-configuration)
- [Security Settings](#security-settings)
- [Environment Variables](#environment-variables)
- [Configuration Presets](#configuration-presets)
- [Configuration Examples](#configuration-examples)

---

## JavaScript/TypeScript Configuration

### NatsPubsubConfig Interface

Complete configuration interface for JavaScript/TypeScript.

```typescript
interface NatsPubsubConfig {
  // Core Settings
  natsUrls: string | string[];
  env: string;
  appName: string;

  // Consumer Settings
  concurrency?: number;
  maxDeliver?: number;
  ackWait?: number;
  backoff?: number[];
  perMessageConcurrency?: number;
  subscriberTimeoutMs?: number;

  // Pattern Toggles
  useOutbox?: boolean;
  useInbox?: boolean;
  useDlq?: boolean;

  // Stream Settings
  streamName?: string;
  dlqSubject?: string;
  dlqMaxAttempts?: number;

  // Authentication
  auth?: NatsAuthConfig;

  // TLS
  tls?: NatsTlsConfig;

  // Monitoring
  metrics?: {
    recordDlqMessage(subject: string, reason: string): void;
  };

  // Logging
  logger?: Logger;
}

interface NatsAuthConfig {
  type: "token" | "user-password" | "nkey" | "credentials";
  token?: string; // For type: 'token'
  user?: string; // For type: 'user-password'
  pass?: string; // For type: 'user-password'
  nkey?: string; // For type: 'nkey'
  credentialsPath?: string; // For type: 'credentials'
}

interface NatsTlsConfig {
  caFile?: string; // Path to CA certificate
  certFile?: string; // Path to client certificate
  keyFile?: string; // Path to client key
  rejectUnauthorized?: boolean; // Verify server cert (default: true)
}
```

### Configuration Options

#### Core Settings

##### `natsUrls`

NATS server URL(s).

**Type:** `string | string[]`
**Required:** Yes
**Default:** `'nats://localhost:4222'`

**Examples:**

```typescript
// Single server
natsUrls: "nats://localhost:4222";

// Multiple servers (cluster)
natsUrls: [
  "nats://nats1.example.com:4222",
  "nats://nats2.example.com:4222",
  "nats://nats3.example.com:4222",
];

// With authentication
natsUrls: "nats://user:password@nats.example.com:4222";

// TLS connection
natsUrls: "tls://nats.example.com:4222";
```

##### `env`

Environment name (used in subject naming).

**Type:** `string`
**Required:** Yes
**Default:** `process.env.NODE_ENV || 'development'`

**Examples:**

```typescript
env: "development";
env: "staging";
env: "production";
env: "test";
```

##### `appName`

Application name (used in subject naming and consumer groups).

**Type:** `string`
**Required:** Yes
**Default:** `process.env.APP_NAME || 'app'`

**Examples:**

```typescript
appName: "order-service";
appName: "notification-service";
appName: "analytics-worker";
```

#### Consumer Settings

##### `concurrency`

Number of concurrent message processors.

**Type:** `number`
**Required:** No
**Default:** `5`
**Range:** `1-1000`

**Description:** Controls how many messages can be processed concurrently. Higher values increase throughput but consume more resources.

**Examples:**

```typescript
// Low concurrency for CPU-intensive tasks
concurrency: 2;

// Moderate concurrency (default)
concurrency: 5;

// High concurrency for I/O-bound tasks
concurrency: 50;

// Maximum concurrency
concurrency: 1000;
```

##### `maxDeliver`

Maximum delivery attempts before sending to DLQ.

**Type:** `number`
**Required:** No
**Default:** `5`

**Description:** Number of times NATS will attempt to deliver a message before considering it failed.

**Examples:**

```typescript
// Retry once
maxDeliver: 2;

// Default retries
maxDeliver: 5;

// Aggressive retries
maxDeliver: 10;
```

##### `ackWait`

Acknowledgment wait time in milliseconds.

**Type:** `number`
**Required:** No
**Default:** `30000` (30 seconds)

**Description:** How long NATS waits for an acknowledgment before redelivering the message.

**Examples:**

```typescript
// Quick operations
ackWait: 10000; // 10 seconds

// Default
ackWait: 30000; // 30 seconds

// Long-running operations
ackWait: 300000; // 5 minutes
```

##### `backoff`

Exponential backoff delays in milliseconds.

**Type:** `number[]`
**Required:** No
**Default:** `[1000, 5000, 15000, 30000, 60000]`

**Description:** Array of delays between retry attempts. Each index represents the delay for that retry attempt.

**Examples:**

```typescript
// Fast retries
backoff: [500, 1000, 2000, 5000];

// Default backoff
backoff: [1000, 5000, 15000, 30000, 60000];

// Aggressive backoff
backoff: [1000, 2000, 4000, 8000, 16000, 32000, 60000];

// Linear backoff
backoff: [5000, 5000, 5000, 5000, 5000];
```

##### `perMessageConcurrency`

Concurrency limit per message type.

**Type:** `number`
**Required:** No
**Default:** `5`

**Description:** Limits concurrent processing per message type to prevent resource exhaustion.

**Examples:**

```typescript
perMessageConcurrency: 1; // Serial processing
perMessageConcurrency: 5; // Default
perMessageConcurrency: 20; // High concurrency
```

##### `subscriberTimeoutMs`

Timeout for subscriber processing in milliseconds.

**Type:** `number`
**Required:** No
**Default:** `60000` (60 seconds)

**Description:** Maximum time allowed for a subscriber to process a message.

**Examples:**

```typescript
subscriberTimeoutMs: 30000; // 30 seconds
subscriberTimeoutMs: 60000; // 1 minute (default)
subscriberTimeoutMs: 300000; // 5 minutes
```

#### Pattern Toggles

##### `useOutbox`

Enable Outbox pattern for reliable publishing.

**Type:** `boolean`
**Required:** No
**Default:** `false`

**Description:** Enables the Outbox pattern for guaranteed message delivery. Messages are persisted before publishing.

**Examples:**

```typescript
useOutbox: false; // Disabled (default)
useOutbox: true; // Enabled - requires database
```

**See Also:** [Inbox/Outbox Pattern Guide](../patterns/inbox-outbox.md)

##### `useInbox`

Enable Inbox pattern for idempotent processing.

**Type:** `boolean`
**Required:** No
**Default:** `false`

**Description:** Enables the Inbox pattern for exactly-once message processing. Prevents duplicate processing.

**Examples:**

```typescript
useInbox: false; // Disabled (default)
useInbox: true; // Enabled - requires database
```

**See Also:** [Inbox/Outbox Pattern Guide](../patterns/inbox-outbox.md)

##### `useDlq`

Enable Dead Letter Queue.

**Type:** `boolean`
**Required:** No
**Default:** `true`

**Description:** Sends failed messages to a DLQ for inspection and retry.

**Examples:**

```typescript
useDlq: true; // Enabled (default)
useDlq: false; // Disabled - failed messages are dropped
```

**See Also:** [DLQ Guide](../patterns/dlq.md)

#### Stream Settings

##### `streamName`

JetStream stream name.

**Type:** `string`
**Required:** No
**Default:** `'{env}-events-stream'`

**Description:** Name of the JetStream stream. Automatically includes environment.

**Examples:**

```typescript
// Automatic naming (default)
streamName: undefined; // Results in 'production-events-stream'

// Custom stream name
streamName: "my-custom-stream";

// Environment-specific
streamName: `${env}-application-events`;
```

##### `dlqSubject`

Dead Letter Queue subject pattern.

**Type:** `string`
**Required:** No
**Default:** `'{env}.{appName}.dlq'`

**Description:** NATS subject for dead letter messages.

**Examples:**

```typescript
// Default
dlqSubject: undefined; // Results in 'production.myapp.dlq'

// Custom DLQ subject
dlqSubject: "failures.myapp";
dlqSubject: "production.errors";
```

##### `dlqMaxAttempts`

Maximum DLQ processing attempts.

**Type:** `number`
**Required:** No
**Default:** `3`

**Description:** How many times to attempt processing messages from the DLQ.

**Examples:**

```typescript
dlqMaxAttempts: 1; // Process once
dlqMaxAttempts: 3; // Default
dlqMaxAttempts: 5; // Multiple retries
```

#### Monitoring

##### `metrics`

Metrics recording hook.

**Type:** `{ recordDlqMessage(subject: string, reason: string): void }`
**Required:** No
**Default:** `undefined`

**Description:** Optional callback for recording DLQ metrics.

**Examples:**

```typescript
// Prometheus integration
import { dlqCounter } from './metrics';

metrics: {
  recordDlqMessage(subject, reason) {
    dlqCounter.inc({ subject, reason });
  }
}

// StatsD integration
metrics: {
  recordDlqMessage(subject, reason) {
    statsd.increment('nats.dlq', { subject, reason });
  }
}

// Custom logging
metrics: {
  recordDlqMessage(subject, reason) {
    console.log(`DLQ: ${subject} - ${reason}`);
  }
}
```

#### Logging

##### `logger`

Custom logger instance.

**Type:** `Logger`
**Required:** No
**Default:** Console logger

**Interface:**

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

**Examples:**

```typescript
// Winston logger
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "nats.log" })],
});

config.configure({ logger });

// Pino logger
import pino from "pino";

const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
  },
});

config.configure({ logger });

// Custom logger
const logger = {
  debug: (msg, meta) => console.debug(msg, meta),
  info: (msg, meta) => console.log(msg, meta),
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};

config.configure({ logger });
```

---

## Ruby Configuration

### Config Class

Complete configuration class for Ruby.

```ruby
class Config
  attr_accessor :nats_urls, :env, :app_name, :destination_app,
                :max_deliver, :ack_wait, :backoff,
                :use_outbox, :use_inbox, :inbox_model, :outbox_model,
                :use_dlq, :dlq_max_attempts, :dlq_stream_suffix,
                :logger, :concurrency,
                :connection_pool_size, :connection_pool_timeout,
                # Authentication
                :auth_token, :auth_user, :auth_password,
                :nkeys_seed, :user_credentials,
                # TLS
                :tls_ca_file, :tls_cert_file, :tls_key_file
end
```

### Configuration Options

#### Core Settings

##### `nats_urls`

NATS server URL(s).

**Type:** `String | Array<String>`
**Required:** Yes
**Default:** `ENV['NATS_URLS']` or `ENV['NATS_URL']` or `'nats://localhost:4222'`

**Examples:**

```ruby
# Single server
config.nats_urls = 'nats://localhost:4222'

# Multiple servers (cluster)
config.nats_urls = [
  'nats://nats1.example.com:4222',
  'nats://nats2.example.com:4222',
  'nats://nats3.example.com:4222'
]

# Environment variable
config.nats_urls = ENV['NATS_URLS']
```

##### `env`

Environment name.

**Type:** `String`
**Required:** Yes
**Default:** `ENV['NATS_ENV']` or `'development'`

**Examples:**

```ruby
config.env = 'development'
config.env = 'staging'
config.env = 'production'
config.env = ENV['RAILS_ENV']
```

##### `app_name`

Application name.

**Type:** `String`
**Required:** Yes
**Default:** `ENV['APP_NAME']` or `'app'`

**Examples:**

```ruby
config.app_name = 'order-service'
config.app_name = 'notification-service'
config.app_name = ENV['APP_NAME']
```

##### `destination_app`

Destination application name for cross-app messaging.

**Type:** `String`
**Required:** No
**Default:** `ENV['DESTINATION_APP']` or `nil`

**Examples:**

```ruby
config.destination_app = 'analytics-service'
config.destination_app = ENV['DESTINATION_APP']
```

#### Consumer Settings

##### `concurrency`

Number of concurrent workers.

**Type:** `Integer`
**Required:** No
**Default:** `5`
**Range:** `1-1000`

**Examples:**

```ruby
config.concurrency = 2   # Low concurrency
config.concurrency = 5   # Default
config.concurrency = 50  # High concurrency
```

##### `max_deliver`

Maximum delivery attempts.

**Type:** `Integer`
**Required:** No
**Default:** `5`

**Examples:**

```ruby
config.max_deliver = 2   # Retry once
config.max_deliver = 5   # Default
config.max_deliver = 10  # Aggressive retries
```

##### `ack_wait`

Acknowledgment wait time.

**Type:** `String`
**Required:** No
**Default:** `'30s'`

**Format:** Duration string (e.g., '30s', '5m', '1h')

**Examples:**

```ruby
config.ack_wait = '10s'   # 10 seconds
config.ack_wait = '30s'   # 30 seconds (default)
config.ack_wait = '5m'    # 5 minutes
config.ack_wait = '1h'    # 1 hour
```

##### `backoff`

Exponential backoff delays.

**Type:** `Array<String>`
**Required:** No
**Default:** `['1000ms', '5000ms', '15000ms', '30000ms', '60000ms']`

**Examples:**

```ruby
# Fast retries
config.backoff = ['500ms', '1s', '2s', '5s']

# Default backoff
config.backoff = ['1s', '5s', '15s', '30s', '60s']

# Aggressive backoff
config.backoff = ['1s', '2s', '4s', '8s', '16s', '32s', '60s']
```

#### Pattern Toggles

##### `use_outbox`

Enable Outbox pattern.

**Type:** `Boolean`
**Required:** No
**Default:** `false`

**Examples:**

```ruby
config.use_outbox = false  # Disabled (default)
config.use_outbox = true   # Enabled
```

##### `outbox_model`

Outbox model class name.

**Type:** `String`
**Required:** No
**Default:** `'NatsPubsub::OutboxEvent'`

**Examples:**

```ruby
config.outbox_model = 'NatsPubsub::OutboxEvent'  # Default
config.outbox_model = 'MyApp::CustomOutboxEvent'  # Custom
```

##### `use_inbox`

Enable Inbox pattern.

**Type:** `Boolean`
**Required:** No
**Default:** `false`

**Examples:**

```ruby
config.use_inbox = false  # Disabled (default)
config.use_inbox = true   # Enabled
```

##### `inbox_model`

Inbox model class name.

**Type:** `String`
**Required:** No
**Default:** `'NatsPubsub::InboxEvent'`

**Examples:**

```ruby
config.inbox_model = 'NatsPubsub::InboxEvent'  # Default
config.inbox_model = 'MyApp::CustomInboxEvent'  # Custom
```

##### `use_dlq`

Enable Dead Letter Queue.

**Type:** `Boolean`
**Required:** No
**Default:** `true`

**Examples:**

```ruby
config.use_dlq = true   # Enabled (default)
config.use_dlq = false  # Disabled
```

##### `dlq_max_attempts`

Maximum DLQ processing attempts.

**Type:** `Integer`
**Required:** No
**Default:** `3`

**Examples:**

```ruby
config.dlq_max_attempts = 1  # Process once
config.dlq_max_attempts = 3  # Default
config.dlq_max_attempts = 5  # Multiple retries
```

##### `dlq_stream_suffix`

DLQ stream name suffix.

**Type:** `String`
**Required:** No
**Default:** `'-dlq'`

**Examples:**

```ruby
config.dlq_stream_suffix = '-dlq'      # Default
config.dlq_stream_suffix = '-failed'   # Custom
```

#### Connection Pool Settings

##### `connection_pool_size`

NATS connection pool size.

**Type:** `Integer`
**Required:** No
**Default:** `ENV['NATS_POOL_SIZE']` or `5`

**Examples:**

```ruby
config.connection_pool_size = 5   # Default
config.connection_pool_size = 10  # Larger pool
config.connection_pool_size = 20  # High concurrency
```

##### `connection_pool_timeout`

Connection pool timeout in seconds.

**Type:** `Integer`
**Required:** No
**Default:** `ENV['NATS_POOL_TIMEOUT']` or `5`

**Examples:**

```ruby
config.connection_pool_timeout = 5   # Default (5 seconds)
config.connection_pool_timeout = 10  # 10 seconds
config.connection_pool_timeout = 30  # 30 seconds
```

#### Logging

##### `logger`

Custom logger instance.

**Type:** `Logger`
**Required:** No
**Default:** `nil` (uses Rails.logger if available)

**Examples:**

```ruby
# Rails logger
config.logger = Rails.logger

# Custom logger
require 'logger'
config.logger = Logger.new(STDOUT)

# File logger
config.logger = Logger.new('log/nats_pubsub.log')

# Structured logger
require 'semantic_logger'
config.logger = SemanticLogger[NatsPubsub]
```

---

## Connection Settings

### JavaScript/TypeScript

```typescript
import { NatsPubsub } from "nats-pubsub";

NatsPubsub.configure({
  // Single server
  natsUrls: "nats://localhost:4222",

  // Cluster with failover
  natsUrls: [
    "nats://nats1.example.com:4222",
    "nats://nats2.example.com:4222",
    "nats://nats3.example.com:4222",
  ],

  // With authentication
  natsUrls: "nats://user:password@nats.example.com:4222",

  // TLS connection
  natsUrls: "tls://nats.example.com:4222",
});
```

### Ruby

```ruby
NatsPubsub.configure do |config|
  # Single server
  config.nats_urls = 'nats://localhost:4222'

  # Cluster with failover
  config.nats_urls = [
    'nats://nats1.example.com:4222',
    'nats://nats2.example.com:4222',
    'nats://nats3.example.com:4222'
  ]

  # Connection pool
  config.connection_pool_size = 10
  config.connection_pool_timeout = 5
end
```

---

## Stream Settings

### JavaScript/TypeScript

```typescript
NatsPubsub.configure({
  // Stream naming
  streamName: "production-events-stream",

  // DLQ configuration
  useDlq: true,
  dlqSubject: "production.myapp.dlq",
  dlqMaxAttempts: 3,
});
```

### Ruby

```ruby
NatsPubsub.configure do |config|
  # DLQ configuration
  config.use_dlq = true
  config.dlq_max_attempts = 3
  config.dlq_stream_suffix = '-dlq'
end
```

---

## Consumer Settings

### JavaScript/TypeScript

```typescript
NatsPubsub.configure({
  // Concurrency
  concurrency: 10,
  perMessageConcurrency: 5,

  // Retry configuration
  maxDeliver: 5,
  ackWait: 30000,
  backoff: [1000, 5000, 15000, 30000, 60000],

  // Timeouts
  subscriberTimeoutMs: 60000,
});
```

### Ruby

```ruby
NatsPubsub.configure do |config|
  # Concurrency
  config.concurrency = 10

  # Retry configuration
  config.max_deliver = 5
  config.ack_wait = '30s'
  config.backoff = ['1s', '5s', '15s', '30s', '60s']
end
```

---

## Inbox/Outbox Settings

### JavaScript/TypeScript

```typescript
NatsPubsub.configure({
  // Enable patterns
  useOutbox: true,
  useInbox: true,

  // Database required for these features
  // See Outbox/Inbox pattern guides for setup
});
```

### Ruby

```ruby
NatsPubsub.configure do |config|
  # Enable patterns
  config.use_outbox = true
  config.use_inbox = true

  # Custom models (optional)
  config.outbox_model = 'MyApp::OutboxEvent'
  config.inbox_model = 'MyApp::InboxEvent'
end
```

---

## Logging Configuration

### JavaScript/TypeScript

#### Winston Logger

```typescript
import winston from "winston";
import { NatsPubsub } from "nats-pubsub";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "nats-pubsub.log" }),
  ],
});

NatsPubsub.configure({ logger });
```

#### Pino Logger

```typescript
import pino from "pino";
import { NatsPubsub } from "nats-pubsub";

const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

NatsPubsub.configure({ logger });
```

### Ruby

#### Rails Logger

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.logger = Rails.logger
end
```

#### Custom Logger

```ruby
require 'logger'

NatsPubsub.configure do |config|
  config.logger = Logger.new(STDOUT)
  config.logger.level = Logger::INFO
end
```

#### Semantic Logger

```ruby
require 'semantic_logger'

NatsPubsub.configure do |config|
  config.logger = SemanticLogger[NatsPubsub]
end
```

---

## Security Settings

### Authentication

NatsPubsub has built-in support for NATS authentication methods.

#### JavaScript/TypeScript

```typescript
NatsPubsub.configure({
  natsUrls: "nats://nats.example.com:4222",

  // Token authentication
  auth: { type: "token", token: process.env.NATS_TOKEN },

  // User/password authentication
  auth: {
    type: "user-password",
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASSWORD,
  },

  // NKey authentication
  auth: { type: "nkey", nkey: process.env.NATS_NKEY_SEED },

  // Credentials file (JWT + NKey)
  auth: { type: "credentials", credentialsPath: process.env.NATS_CREDENTIALS },
});
```

#### Ruby

```ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'nats://nats.example.com:4222'

  # Token authentication
  config.auth_token = ENV['NATS_TOKEN']

  # User/password authentication
  config.auth_user = ENV['NATS_USER']
  config.auth_password = ENV['NATS_PASSWORD']

  # NKey seed file
  config.nkeys_seed = ENV['NATS_NKEYS_SEED']

  # Credentials file (JWT + NKey)
  config.user_credentials = ENV['NATS_CREDENTIALS']
end
```

### TLS Configuration

#### JavaScript/TypeScript

```typescript
NatsPubsub.configure({
  natsUrls: "tls://nats.example.com:4222",

  // TLS with CA certificate (server verification)
  tls: {
    caFile: "/path/to/ca.crt",
  },

  // Mutual TLS (mTLS) with client certificate
  tls: {
    caFile: "/path/to/ca.crt",
    certFile: "/path/to/client.crt",
    keyFile: "/path/to/client.key",
  },
});
```

#### Ruby

```ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'tls://nats.example.com:4222'

  # TLS with CA certificate
  config.tls_ca_file = '/path/to/ca.crt'

  # Mutual TLS (mTLS) with client certificate
  config.tls_cert_file = '/path/to/client.crt'
  config.tls_key_file = '/path/to/client.key'
end
```

---

## Environment Variables

### Supported Environment Variables

| Variable                 | Description                    | Default                 |
| ------------------------ | ------------------------------ | ----------------------- |
| `NATS_URL` / `NATS_URLS` | NATS server URL(s)             | `nats://localhost:4222` |
| `NATS_ENV`               | Environment name               | `development`           |
| `APP_NAME`               | Application name               | `app`                   |
| `DESTINATION_APP`        | Destination app (Ruby only)    | -                       |
| `NODE_ENV`               | Node environment (JS only)     | `development`           |
| `RAILS_ENV`              | Rails environment (Ruby only)  | `development`           |
| `NATS_POOL_SIZE`         | Connection pool size (Ruby)    | `5`                     |
| `NATS_POOL_TIMEOUT`      | Pool timeout in seconds (Ruby) | `5`                     |
| `NATS_TOKEN`             | Auth token (Ruby)              | -                       |
| `NATS_USER`              | Auth username (Ruby)           | -                       |
| `NATS_PASSWORD`          | Auth password (Ruby)           | -                       |
| `NATS_NKEYS_SEED`        | NKey seed path (Ruby)          | -                       |
| `NATS_CREDENTIALS`       | Credentials file path (Ruby)   | -                       |
| `NATS_TLS_CA_FILE`       | TLS CA certificate (Ruby)      | -                       |
| `NATS_TLS_CERT_FILE`     | TLS client certificate (Ruby)  | -                       |
| `NATS_TLS_KEY_FILE`      | TLS client key (Ruby)          | -                       |

### Example .env File

```bash
# NATS Connection
NATS_URL=nats://nats.example.com:4222
NATS_ENV=production
APP_NAME=my-service

# Ruby-specific
NATS_POOL_SIZE=10
NATS_POOL_TIMEOUT=5

# Optional
DESTINATION_APP=analytics-service
```

---

## Configuration Presets

### JavaScript/TypeScript Presets

#### Development Preset

```typescript
import { config } from "nats-pubsub";

config.configureWithPreset("development", {
  natsUrls: "nats://localhost:4222",
  appName: "my-app",
});

// Preset includes:
// - concurrency: 2
// - maxDeliver: 3
// - useDlq: true
// - Debug logging enabled
```

#### Production Preset

```typescript
config.configureWithPreset("production", {
  natsUrls: "nats://nats.example.com:4222",
  appName: "my-app",
});

// Preset includes:
// - concurrency: 10
// - maxDeliver: 5
// - useDlq: true
// - useOutbox: true (recommended)
// - Optimized for reliability
```

#### Testing Preset

```typescript
config.configureWithPreset("testing", {
  natsUrls: "nats://localhost:4222",
  appName: "test-app",
});

// Preset includes:
// - concurrency: 1
// - maxDeliver: 1
// - useDlq: false
// - Fast timeouts
```

### Ruby Presets

#### Development Preset

```ruby
NatsPubsub::Config.new(preset: :development)

# Preset includes:
# - concurrency: 2
# - max_deliver: 3
# - use_dlq: true
# - ack_wait: '30s'
```

#### Production Preset

```ruby
NatsPubsub::Config.new(preset: :production)

# Preset includes:
# - concurrency: 10
# - max_deliver: 5
# - use_dlq: true
# - ack_wait: '60s'
# - connection_pool_size: 10
```

#### Testing Preset

```ruby
NatsPubsub::Config.new(preset: :testing)

# Preset includes:
# - concurrency: 1
# - max_deliver: 1
# - use_dlq: false
# - ack_wait: '5s'
```

---

## Configuration Examples

### Development Configuration

#### JavaScript/TypeScript

```typescript
import { NatsPubsub } from "nats-pubsub";

NatsPubsub.configure({
  env: "development",
  appName: "my-service",
  natsUrls: "nats://localhost:4222",
  concurrency: 2,
  maxDeliver: 3,
  ackWait: 30000,
  useDlq: true,
  useOutbox: false,
  useInbox: false,
  logger: console,
});
```

#### Ruby

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = 'development'
  config.app_name = 'my-service'
  config.nats_urls = 'nats://localhost:4222'
  config.concurrency = 2
  config.max_deliver = 3
  config.ack_wait = '30s'
  config.use_dlq = true
  config.use_outbox = false
  config.use_inbox = false
  config.logger = Rails.logger
end
```

### Production Configuration

#### JavaScript/TypeScript

```typescript
import { NatsPubsub } from "nats-pubsub";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "nats-error.log", level: "error" }),
    new winston.transports.File({ filename: "nats-combined.log" }),
  ],
});

NatsPubsub.configure({
  env: "production",
  appName: "order-service",
  natsUrls: [
    "nats://nats1.prod.example.com:4222",
    "nats://nats2.prod.example.com:4222",
    "nats://nats3.prod.example.com:4222",
  ],
  concurrency: 20,
  maxDeliver: 5,
  ackWait: 60000,
  backoff: [1000, 5000, 15000, 30000, 60000],
  useDlq: true,
  useOutbox: true,
  useInbox: true,
  subscriberTimeoutMs: 300000,
  logger,
  metrics: {
    recordDlqMessage(subject, reason) {
      // Prometheus metrics
      dlqCounter.inc({ subject, reason });
    },
  },
});

await NatsPubsub.setup();
```

#### Ruby

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.env = 'production'
  config.app_name = 'order-service'
  config.nats_urls = [
    'nats://nats1.prod.example.com:4222',
    'nats://nats2.prod.example.com:4222',
    'nats://nats3.prod.example.com:4222'
  ]
  config.concurrency = 20
  config.max_deliver = 5
  config.ack_wait = '60s'
  config.backoff = ['1s', '5s', '15s', '30s', '60s']
  config.use_dlq = true
  config.use_outbox = true
  config.use_inbox = true
  config.connection_pool_size = 20
  config.connection_pool_timeout = 10
  config.logger = Rails.logger

  # Middleware configuration
  config.server_middleware do |chain|
    chain.add Middleware::StructuredLogging.new
    chain.add Middleware::ActiveRecord.new
  end
end

NatsPubsub.ensure_topology!
```

### Testing Configuration

#### JavaScript/TypeScript

```typescript
import { NatsPubsub, config } from "nats-pubsub";

// In test setup
beforeAll(async () => {
  config.configureWithPreset("testing", {
    appName: "test-app",
  });

  await NatsPubsub.setup();
});

// In test teardown
afterAll(async () => {
  await NatsPubsub.disconnect();
});
```

#### Ruby

```ruby
# spec/spec_helper.rb or test/test_helper.rb
require 'nats_pubsub/testing'

RSpec.configure do |config|
  config.before(:suite) do
    NatsPubsub.setup_with_preset!(:testing) do |cfg|
      cfg.app_name = 'test-app'
    end
  end

  config.before(:each) do
    NatsPubsub::Testing.enable_test_mode!
  end

  config.after(:each) do
    NatsPubsub::Testing.reset!
  end
end
```

### Kubernetes Configuration

#### JavaScript/TypeScript

```typescript
// In Kubernetes, use environment variables
import { NatsPubsub } from "nats-pubsub";

NatsPubsub.configure({
  env: process.env.NODE_ENV || "production",
  appName: process.env.APP_NAME || "my-service",
  natsUrls: process.env.NATS_URLS?.split(",") || ["nats://nats:4222"],
  concurrency: parseInt(process.env.CONCURRENCY || "10"),
  maxDeliver: parseInt(process.env.MAX_DELIVER || "5"),
  useDlq: process.env.USE_DLQ === "true",
  useOutbox: process.env.USE_OUTBOX === "true",
  useInbox: process.env.USE_INBOX === "true",
});

await NatsPubsub.setup();
```

#### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nats-pubsub-config
data:
  NATS_URLS: "nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222"
  NODE_ENV: "production"
  APP_NAME: "order-service"
  CONCURRENCY: "20"
  MAX_DELIVER: "5"
  USE_DLQ: "true"
  USE_OUTBOX: "true"
  USE_INBOX: "true"
```

---

## See Also

- [JavaScript API Reference](./javascript-api.md)
- [Ruby API Reference](./ruby-api.md)
- [CLI Reference](./cli.md)
- [Getting Started Guide](../getting-started/quickstart.md)
- [Deployment Guide](../guides/deployment.md)
