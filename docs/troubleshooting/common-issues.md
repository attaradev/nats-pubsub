# Common Issues and Solutions

This guide covers the most common issues you may encounter when using NatsPubsub, along with their symptoms, causes, solutions, and prevention strategies.

## Table of Contents

- [Connection Issues](#connection-issues)
- [Message Delivery Issues](#message-delivery-issues)
- [Performance Issues](#performance-issues)
- [Configuration Issues](#configuration-issues)
- [Database Issues](#database-issues)
- [Inbox/Outbox Issues](#inboxoutbox-issues)
- [JetStream Issues](#jetstream-issues)
- [Authentication Issues](#authentication-issues)
- [Topology Issues](#topology-issues)

---

## Connection Issues

### Unable to Connect to NATS Server

**Symptoms:**

```
Error: connect ECONNREFUSED 127.0.0.1:4222
NATS::IO::SocketTimeoutError: nats: timeout
Error: Could not connect to server: Connection refused
```

**Causes:**

- NATS server is not running
- Incorrect connection URL
- Firewall blocking connection
- Network connectivity issues
- Wrong port configuration

**Solutions:**

1. **Verify NATS Server is Running:**

```bash
# Check NATS server status
nats server check

# Check if port is listening
netstat -an | grep 4222
# Or on macOS/Linux
lsof -i :4222

# Check NATS monitoring endpoint
curl http://localhost:8222/varz
```

2. **Verify Connection Configuration:**

```typescript
// JavaScript/TypeScript
import { Publisher } from "nats-pubsub";

const publisher = new Publisher({
  servers: "nats://localhost:4222", // Check this URL
  env: "development",
  appName: "my-app",
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.env = 'development'
  config.app_name = 'my-app'
end
```

3. **Test Network Connectivity:**

```bash
# Test TCP connection
telnet localhost 4222
# Or
nc -zv localhost 4222

# Check DNS resolution
nslookup your-nats-server.com
```

4. **Start NATS Server:**

```bash
# Start NATS server with JetStream
nats-server -js

# Or with Docker
docker run -p 4222:4222 -p 8222:8222 nats:latest -js

# Or with Docker Compose (recommended)
docker-compose up nats
```

**Prevention:**

- Use health checks to monitor NATS availability
- Implement proper error handling and retry logic
- Use environment-specific configuration
- Document connection requirements clearly

---

### Connection Drops Intermittently

**Symptoms:**

```
Connection closed
Client disconnected
Reconnecting to NATS server...
Random connection timeouts
```

**Causes:**

- Network instability
- Server resource exhaustion
- Connection timeout too aggressive
- Load balancer issues
- Firewall idle timeout

**Solutions:**

1. **Enable Connection Monitoring:**

```typescript
// JavaScript/TypeScript
import { Publisher } from "nats-pubsub";

const publisher = new Publisher({
  servers: "nats://localhost:4222",
  reconnect: true,
  maxReconnectAttempts: 10,
  reconnectTimeWait: 2000,
  pingInterval: 20000,
  maxPingOut: 2,
});

// Listen for connection events
publisher.on("connect", () => {
  console.log("Connected to NATS");
});

publisher.on("disconnect", () => {
  console.log("Disconnected from NATS");
});

publisher.on("reconnect", () => {
  console.log("Reconnected to NATS");
});

publisher.on("error", (err) => {
  console.error("NATS error:", err);
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.reconnect = true
  config.max_reconnect_attempts = 10
  config.reconnect_time_wait = 2
  config.ping_interval = 20
  config.max_ping_out = 2
end

# Add connection event handlers
NatsPubsub::Connection.on_connect do
  Rails.logger.info "Connected to NATS"
end

NatsPubsub::Connection.on_disconnect do
  Rails.logger.warn "Disconnected from NATS"
end
```

2. **Configure Keepalive:**

```typescript
// JavaScript - Add keepalive options
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  pingInterval: 20000, // Send ping every 20s
  maxPingOut: 2, // Max unanswered pings
  timeout: 5000, // Connection timeout
});
```

3. **Use Connection Pool:**

```ruby
# Ruby - Configure connection pool
NatsPubsub.configure do |config|
  config.connection_pool_size = 5
  config.connection_pool_timeout = 10
end
```

**Prevention:**

- Monitor connection health with metrics
- Set appropriate timeout values
- Use multiple NATS servers for redundancy
- Configure load balancers for long-lived connections

---

### JetStream Not Available

**Symptoms:**

```
Error: JetStream not enabled
JetStream not enabled for account
stream not found
```

**Causes:**

- NATS server not started with JetStream flag
- JetStream disabled on account
- Insufficient resources allocated
- Configuration error

**Solutions:**

1. **Enable JetStream on Server:**

```bash
# Start NATS with JetStream enabled
nats-server -js

# Or with config file
nats-server -c nats-server.conf
```

Create `nats-server.conf`:

```conf
# JetStream configuration
jetstream {
  store_dir: "./data/jetstream"
  max_memory_store: 1GB
  max_file_store: 10GB
}

# Server settings
port: 4222
monitor_port: 8222
```

2. **Verify JetStream Status:**

```bash
# Check JetStream status
nats account info

# List streams
nats stream list

# Check server info
curl http://localhost:8222/jsz
```

3. **Docker Configuration:**

```yaml
# docker-compose.yml
version: "3"
services:
  nats:
    image: nats:latest
    command: "-js -m 8222"
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - nats-data:/data/jetstream

volumes:
  nats-data:
```

**Prevention:**

- Always start NATS with `-js` flag
- Include JetStream checks in health monitoring
- Document deployment requirements
- Use infrastructure as code for consistency

---

## Message Delivery Issues

### Messages Not Being Received

**Symptoms:**

- Publisher confirms send but subscriber doesn't receive
- No errors reported
- Message count increases but handlers not called

**Causes:**

- Subject mismatch
- Consumer not created
- Consumer not subscribed
- Stream not configured
- Message filtered by consumer

**Solutions:**

1. **Verify Subject Matching:**

```typescript
// JavaScript - Check exact subject
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  env: "development", // Must match
  appName: "order-service", // Must match
});

await publisher.publish("order.created", data);
// Publishes to: development.order-service.order.created

// Subscriber must use same topic
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created"); // Topic only, prefix auto-added
  }
}
```

2. **Check Stream and Consumer:**

```bash
# List streams
nats stream list

# Check stream subjects
nats stream info development.order-service

# List consumers
nats consumer list development.order-service

# Check consumer info
nats consumer info development.order-service order.created
```

3. **Enable Debug Logging:**

```typescript
// JavaScript
import { Publisher, Subscriber } from "nats-pubsub";

const publisher = new Publisher({
  servers: "nats://localhost:4222",
  debug: true,
  logLevel: "debug",
});

class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      debug: true,
      logLevel: "debug",
    });
  }
}
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.log_level = :debug
end
```

4. **Verify Consumer is Running:**

```typescript
// JavaScript - Check subscription status
const subscriber = new OrderSubscriber();
await subscriber.connect({
  servers: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
});

console.log("Subscriber active:", subscriber.isActive());
```

**Prevention:**

- Use consistent env and appName across services
- Monitor consumer lag metrics
- Implement health checks for subscribers
- Log all message operations with correlation IDs

---

### Duplicate Messages Received

**Symptoms:**

- Same message processed multiple times
- Duplicate database records
- Idempotency violations

**Causes:**

- Inbox pattern not enabled
- Consumer redelivery
- Multiple subscriber instances
- Network issues causing redelivery
- No deduplication logic

**Solutions:**

1. **Enable Inbox Pattern:**

```typescript
// JavaScript
import { Subscriber } from "nats-pubsub";

class OrderSubscriber extends Subscriber {
  useInbox = true; // Enable deduplication

  constructor() {
    super("order.created");
  }

  async handle(message, metadata) {
    // This will only be called once per unique message
    await processOrder(message);
  }
}
```

```ruby
# Ruby
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'
  use_inbox true

  def handle(message, context)
    # Deduplicated automatically
    process_order(message)
  end
end
```

2. **Manual Deduplication:**

```typescript
// If inbox pattern unavailable, implement manually
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    const messageId = metadata.messageId;

    // Check if already processed
    const exists = await db.query(
      "SELECT 1 FROM processed_messages WHERE message_id = $1",
      [messageId],
    );

    if (exists.rows.length > 0) {
      console.log("Message already processed:", messageId);
      return; // Skip processing
    }

    // Process and record
    await db.transaction(async (tx) => {
      await processOrder(message, tx);
      await tx.query(
        "INSERT INTO processed_messages (message_id, processed_at) VALUES ($1, NOW())",
        [messageId],
      );
    });
  }
}
```

3. **Configure Consumer Acknowledgment:**

```typescript
// Ensure proper acknowledgment
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      ackWait: 30000, // Wait 30s for ack
      maxDeliver: 3, // Maximum redelivery attempts
      ackPolicy: "explicit", // Explicit acknowledgment
    });
  }

  async handle(message, metadata) {
    try {
      await processOrder(message);
      await metadata.ack(); // Explicit ack
    } catch (error) {
      console.error("Processing failed:", error);
      await metadata.nak(); // Negative ack - will redeliver
    }
  }
}
```

**Prevention:**

- Always enable inbox pattern for critical operations
- Use database transactions with deduplication
- Monitor duplicate rate metrics
- Implement idempotent handlers

---

### Messages Lost or Missing

**Symptoms:**

- Expected messages never arrive
- Message count discrepancies
- Gaps in sequence numbers

**Causes:**

- No stream persistence
- Consumer acknowledgment issues
- Message expiration
- Stream limits exceeded
- Network failures without retry

**Solutions:**

1. **Enable Outbox Pattern:**

```typescript
// JavaScript - Guaranteed delivery
import { Publisher } from "nats-pubsub";

const publisher = new Publisher({
  servers: "nats://localhost:4222",
  useOutbox: true,
  database: {
    host: "localhost",
    port: 5432,
    database: "myapp",
    user: "postgres",
    password: "password",
  },
});

// Message saved to database first, then relayed
await publisher.publish("order.created", orderData);
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.use_outbox = true
end

# Uses ActiveRecord connection by default
NatsPubsub.publish('order.created', order_data)
```

2. **Configure Stream Persistence:**

```bash
# Check stream configuration
nats stream info development.order-service

# Update retention policy
nats stream edit development.order-service \
  --subjects "development.order-service.>" \
  --retention limits \
  --max-msgs=-1 \
  --max-bytes=-1 \
  --max-age=7d \
  --storage file
```

3. **Monitor Message Flow:**

```typescript
// JavaScript - Add comprehensive logging
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    console.log("Message received:", {
      messageId: metadata.messageId,
      subject: metadata.subject,
      timestamp: metadata.timestamp,
      sequence: metadata.sequence,
    });

    await processOrder(message);

    console.log("Message processed:", metadata.messageId);
  }
}
```

4. **Check Stream Limits:**

```bash
# View stream stats
nats stream report

# Check consumer lag
nats consumer report development.order-service
```

**Prevention:**

- Always use outbox pattern for critical messages
- Configure appropriate stream retention
- Monitor stream and consumer metrics
- Implement end-to-end message tracking
- Set up alerts for message loss

---

## Performance Issues

### Slow Message Processing

**Symptoms:**

- High latency between publish and process
- Consumer lag increasing
- Slow throughput
- Timeouts

**Causes:**

- Inefficient handler logic
- Database bottlenecks
- Network latency
- Single-threaded processing
- Blocking operations

**Solutions:**

1. **Enable Batch Processing:**

```typescript
// JavaScript - Process messages in batches
import { BatchPublisher } from "nats-pubsub";

const publisher = new BatchPublisher({
  servers: "nats://localhost:4222",
  batchSize: 100,
  batchWindow: 1000, // 1 second
});

// Messages are automatically batched
for (let i = 0; i < 1000; i++) {
  await publisher.publish("order.created", { orderId: i });
}

await publisher.flush(); // Send remaining
```

```ruby
# Ruby - Batch publishing
NatsPubsub::Publisher.batch do |batch|
  1000.times do |i|
    batch.publish('order.created', { order_id: i })
  end
end
```

2. **Increase Concurrency:**

```typescript
// JavaScript - Process multiple messages concurrently
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxConcurrent: 10, // Process 10 messages at once
    });
  }

  async handle(message, metadata) {
    await processOrder(message);
  }
}
```

```ruby
# Ruby - Configure worker threads
NatsPubsub.configure do |config|
  config.worker_threads = 10
end
```

3. **Optimize Database Queries:**

```typescript
// Use connection pooling
import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  database: "myapp",
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    // Use pooled connection
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO orders (id, data) VALUES ($1, $2)", [
        message.orderId,
        JSON.stringify(message),
      ]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  }
}
```

4. **Add Caching:**

```typescript
// Cache frequently accessed data
import { LRUCache } from "lru-cache";

const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    let user = cache.get(message.userId);

    if (!user) {
      user = await fetchUser(message.userId);
      cache.set(message.userId, user);
    }

    await processOrder(message, user);
  }
}
```

**Prevention:**

- Profile handler performance regularly
- Use database indexes appropriately
- Implement connection pooling
- Monitor processing latency metrics
- Set performance budgets

---

### High Memory Usage

**Symptoms:**

```
Out of memory errors
Increasing memory usage over time
Process crashes
Slow garbage collection
```

**Causes:**

- Memory leaks in handlers
- Large message payloads
- Unbounded caching
- Connection leaks
- Too many concurrent operations

**Solutions:**

1. **Monitor Memory Usage:**

```typescript
// JavaScript - Track memory
import { Subscriber } from "nats-pubsub";

class OrderSubscriber extends Subscriber {
  private processedCount = 0;

  async handle(message, metadata) {
    await processOrder(message);

    this.processedCount++;

    if (this.processedCount % 100 === 0) {
      const usage = process.memoryUsage();
      console.log("Memory usage:", {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + "MB",
        external: Math.round(usage.external / 1024 / 1024) + "MB",
        rss: Math.round(usage.rss / 1024 / 1024) + "MB",
      });
    }
  }
}
```

2. **Limit Concurrency:**

```typescript
// Prevent too many concurrent operations
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      maxConcurrent: 5, // Limit concurrent processing
      prefetch: 10, // Limit prefetched messages
    });
  }
}
```

3. **Stream Large Payloads:**

```typescript
// For large messages, use streaming
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    if (message.fileUrl) {
      // Stream instead of loading into memory
      const response = await fetch(message.fileUrl);
      const destination = createWriteStream(`/tmp/${message.orderId}`);
      await pipeline(response.body, destination);

      // Process streamed file
      await processFile(`/tmp/${message.orderId}`);
    }
  }
}
```

4. **Implement Proper Cleanup:**

```typescript
// Clean up resources
class OrderSubscriber extends Subscriber {
  private connections = new Map();

  async handle(message, metadata) {
    const conn = await this.getConnection();
    try {
      await processOrder(message, conn);
    } finally {
      // Always release resources
      await this.releaseConnection(conn);
    }
  }

  async onShutdown() {
    // Clean up on shutdown
    for (const [key, conn] of this.connections) {
      await conn.close();
    }
    this.connections.clear();
  }
}
```

**Prevention:**

- Set memory limits and alerts
- Use streaming for large data
- Implement proper resource cleanup
- Regular memory profiling
- Limit message payload sizes

---

### High CPU Usage

**Symptoms:**

- CPU at or near 100%
- Slow response times
- Process throttling
- Server overload

**Causes:**

- Inefficient algorithms
- Too many concurrent operations
- Blocking operations
- Tight loops
- JSON parsing overhead

**Solutions:**

1. **Optimize Handler Logic:**

```typescript
// Before - Inefficient
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    // O(n²) operation
    for (const item of message.items) {
      for (const price of priceList) {
        if (item.sku === price.sku) {
          item.price = price.amount;
        }
      }
    }
  }
}

// After - Efficient
class OrderSubscriber extends Subscriber {
  private priceCache = new Map();

  async init() {
    // Load once
    const prices = await loadPrices();
    prices.forEach((p) => this.priceCache.set(p.sku, p.amount));
  }

  async handle(message, metadata) {
    // O(n) operation
    for (const item of message.items) {
      item.price = this.priceCache.get(item.sku) || 0;
    }
  }
}
```

2. **Use Worker Threads:**

```typescript
// JavaScript - Offload CPU-intensive work
import { Worker } from "worker_threads";

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    // Offload to worker thread
    const result = await this.runWorker("./process-order-worker.js", message);
    await this.saveResult(result);
  }

  private runWorker(scriptPath: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(scriptPath, { workerData: data });
      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}
```

3. **Rate Limit Processing:**

```typescript
// Add rate limiting
import { RateLimiter } from "limiter";

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: "second",
});

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    await limiter.removeTokens(1);
    await processOrder(message);
  }
}
```

**Prevention:**

- Profile CPU usage regularly
- Optimize hot code paths
- Use appropriate data structures
- Monitor CPU metrics
- Load test before production

---

## Configuration Issues

### Invalid Configuration

**Symptoms:**

```
Configuration error
Invalid option
Type error in config
Cannot start subscriber
```

**Causes:**

- Missing required fields
- Wrong data types
- Invalid values
- Conflicting options

**Solutions:**

1. **Validate Configuration:**

```typescript
// JavaScript - Use validation
import { Publisher, validateConfig } from "nats-pubsub";

const config = {
  servers: "nats://localhost:4222",
  env: "production",
  appName: "order-service",
  reconnect: true,
};

// Validate before use
try {
  validateConfig(config);
  const publisher = new Publisher(config);
} catch (error) {
  console.error("Invalid configuration:", error.message);
  process.exit(1);
}
```

```ruby
# Ruby - Validate configuration
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.env = 'production'
  config.app_name = 'order-service'

  # Validate
  config.validate!
end
```

2. **Use Configuration Schema:**

```typescript
// TypeScript - Leverage type safety
import { PublisherConfig } from "nats-pubsub";

const config: PublisherConfig = {
  servers: "nats://localhost:4222",
  env: "production",
  appName: "order-service",
  // TypeScript will catch invalid options
};
```

3. **Environment-Based Configuration:**

```typescript
// JavaScript - Use environment variables
import { Publisher } from "nats-pubsub";

const config = {
  servers: process.env.NATS_URL || "nats://localhost:4222",
  env: process.env.NODE_ENV || "development",
  appName: process.env.APP_NAME || "default-app",
  reconnect: process.env.NATS_RECONNECT !== "false",
  maxReconnectAttempts: parseInt(process.env.NATS_MAX_RECONNECT || "10"),
};

const publisher = new Publisher(config);
```

```ruby
# Ruby - Use Rails configuration
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.servers = ENV.fetch('NATS_URL', 'nats://localhost:4222')
  config.env = Rails.env
  config.app_name = ENV.fetch('APP_NAME', 'rails-app')
end
```

**Prevention:**

- Use TypeScript for type safety
- Validate configuration on startup
- Document all configuration options
- Use environment variables
- Provide sensible defaults

---

### Configuration Mismatch Between Services

**Symptoms:**

- Messages published but not received
- Wrong stream/consumer names
- Topology conflicts

**Causes:**

- Different env values
- Different appName values
- Inconsistent configuration

**Solutions:**

1. **Centralize Configuration:**

```typescript
// shared-config.ts - Shared across services
export const natsConfig = {
  servers: process.env.NATS_URL || "nats://localhost:4222",
  env: process.env.ENV || "development",
  appName: "order-platform", // Shared app name
};
```

2. **Use Configuration Service:**

```typescript
// Load from central config service
import { loadConfig } from "./config-service";

const config = await loadConfig("nats");
const publisher = new Publisher(config);
```

3. **Verify Configuration:**

```typescript
// Add startup checks
async function verifyConfiguration() {
  const publisher = new Publisher(natsConfig);
  const subscriber = new OrderSubscriber();

  // Verify they use same subjects
  console.log("Publisher subject prefix:", publisher.getSubjectPrefix());
  console.log("Subscriber subject prefix:", subscriber.getSubjectPrefix());

  if (publisher.getSubjectPrefix() !== subscriber.getSubjectPrefix()) {
    throw new Error("Configuration mismatch detected!");
  }
}

await verifyConfiguration();
```

**Prevention:**

- Use shared configuration libraries
- Document configuration requirements
- Implement configuration validation
- Use infrastructure as code
- Automate configuration deployment

---

## Database Issues

### Connection Pool Exhausted

**Symptoms:**

```
TimeoutError: Timeout acquiring connection
Pool is full
Cannot get connection from pool
```

**Causes:**

- Too many concurrent operations
- Connections not released
- Pool size too small
- Long-running transactions
- Connection leaks

**Solutions:**

1. **Increase Pool Size:**

```typescript
// JavaScript
import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  database: "myapp",
  max: 20, // Increase pool size
  min: 5, // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

```ruby
# Ruby - config/database.yml
production:
  pool: 20  # Increase from default 5
  timeout: 5000
  checkout_timeout: 5
```

2. **Ensure Proper Connection Release:**

```typescript
// Always use try/finally
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await processOrder(message, client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release(); // Always release
    }
  }
}
```

3. **Monitor Pool Usage:**

```typescript
// Add pool monitoring
setInterval(() => {
  console.log("Pool stats:", {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 10000);
```

**Prevention:**

- Use connection pooling correctly
- Monitor pool metrics
- Set appropriate pool sizes
- Implement connection leak detection
- Use ORM connection management

---

### Database Deadlocks

**Symptoms:**

```
Deadlock detected
Transaction deadlock
Could not serialize access
```

**Causes:**

- Concurrent updates to same records
- Lock ordering issues
- Long-running transactions
- High contention

**Solutions:**

1. **Implement Retry Logic:**

```typescript
// Retry on deadlock
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === "40P01" && i < maxRetries - 1) {
        // Deadlock detected, retry with backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, i) * 100),
        );
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    await withRetry(async () => {
      await processOrder(message);
    });
  }
}
```

2. **Use Advisory Locks:**

```typescript
// PostgreSQL advisory locks
async function withAdvisoryLock(
  client: any,
  lockId: number,
  fn: () => Promise<void>,
) {
  await client.query("SELECT pg_advisory_lock($1)", [lockId]);
  try {
    await fn();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
  }
}

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    const client = await pool.connect();
    try {
      await withAdvisoryLock(client, message.orderId, async () => {
        await processOrder(message, client);
      });
    } finally {
      client.release();
    }
  }
}
```

3. **Reduce Transaction Scope:**

```typescript
// Keep transactions short
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    // Read outside transaction
    const order = await fetchOrder(message.orderId);
    const user = await fetchUser(order.userId);

    // Process business logic
    const result = calculateOrderTotal(order, user);

    // Short transaction for write
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE orders SET total = $1 WHERE id = $2", [
        result.total,
        message.orderId,
      ]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  }
}
```

**Prevention:**

- Keep transactions short
- Access tables in consistent order
- Use appropriate isolation levels
- Monitor deadlock rates
- Implement proper locking strategies

---

## Inbox/Outbox Issues

### Outbox Messages Not Being Relayed

**Symptoms:**

- Messages stuck in outbox table
- Outbox relay not processing
- Growing outbox backlog

**Causes:**

- Outbox relay not started
- NATS connection issues
- Relay worker crashed
- Configuration issues

**Solutions:**

1. **Verify Outbox Relay is Running:**

```typescript
// JavaScript - Start outbox relay
import { OutboxRelay } from "nats-pubsub";

const relay = new OutboxRelay({
  servers: "nats://localhost:4222",
  database: {
    host: "localhost",
    database: "myapp",
  },
  batchSize: 100,
  pollingInterval: 1000,
});

await relay.start();

// Monitor relay status
setInterval(() => {
  console.log("Relay stats:", relay.getStats());
}, 10000);
```

```ruby
# Ruby - Start outbox publisher
# In background job or separate process
NatsPubsub::Publisher::OutboxPublisher.start

# Or in Rails
# config/initializers/nats_pubsub.rb
Rails.application.config.after_initialize do
  NatsPubsub::Publisher::OutboxPublisher.start
end
```

2. **Check Outbox Table:**

```sql
-- Check outbox messages
SELECT id, topic, status, created_at, relayed_at, error
FROM nats_pubsub_outbox
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Check for errors
SELECT topic, error, COUNT(*)
FROM nats_pubsub_outbox
WHERE status = 'failed'
GROUP BY topic, error;
```

3. **Manual Relay:**

```typescript
// Force relay of pending messages
import { OutboxRepository } from "nats-pubsub";

const repo = new OutboxRepository(pool);
const pending = await repo.getPending(100);

for (const message of pending) {
  try {
    await publisher.publish(message.topic, message.payload);
    await repo.markRelayed(message.id);
  } catch (error) {
    console.error("Failed to relay:", message.id, error);
    await repo.markFailed(message.id, error.message);
  }
}
```

**Prevention:**

- Monitor outbox table size
- Set up alerts for relay failures
- Implement outbox cleanup jobs
- Use health checks for relay process
- Log relay operations

---

### Inbox Deduplication Not Working

**Symptoms:**

- Duplicate processing still occurs
- Inbox table not being checked
- Same message processed multiple times

**Causes:**

- Inbox check disabled
- Different message IDs
- Inbox table cleanup too aggressive
- Clock skew issues

**Solutions:**

1. **Verify Inbox Configuration:**

```typescript
// JavaScript - Ensure inbox enabled
class OrderSubscriber extends Subscriber {
  useInbox = true; // Must be true

  constructor() {
    super("order.created", {
      inboxRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
```

2. **Check Message IDs:**

```typescript
// Verify consistent message IDs
class OrderSubscriber extends Subscriber {
  useInbox = true;

  async handle(message, metadata) {
    console.log("Processing message:", {
      messageId: metadata.messageId,
      subject: metadata.subject,
      timestamp: metadata.timestamp,
    });

    await processOrder(message);
  }
}
```

3. **Query Inbox Table:**

```sql
-- Check inbox entries
SELECT message_id, topic, processed_at, created_at
FROM nats_pubsub_inbox
ORDER BY created_at DESC
LIMIT 10;

-- Check for duplicate processing
SELECT message_id, COUNT(*)
FROM nats_pubsub_inbox
GROUP BY message_id
HAVING COUNT(*) > 1;
```

4. **Manual Inbox Check:**

```typescript
// Manually verify inbox
import { InboxRepository } from "nats-pubsub";

const inbox = new InboxRepository(pool);

async function checkDuplicate(messageId: string): Promise<boolean> {
  return await inbox.exists(messageId);
}
```

**Prevention:**

- Always enable inbox for critical operations
- Use consistent message ID generation
- Monitor inbox table size
- Implement inbox cleanup with appropriate retention
- Test deduplication in staging

---

## JetStream Issues

### Stream Creation Failures

**Symptoms:**

```
Error: stream name already in use
Error: insufficient resources
Error: invalid stream configuration
```

**Causes:**

- Stream name conflicts
- Insufficient storage
- Invalid configuration
- Permission issues

**Solutions:**

1. **Check Existing Streams:**

```bash
# List all streams
nats stream list

# Check specific stream
nats stream info development.order-service

# Delete if needed
nats stream delete development.order-service
```

2. **Configure Stream Properly:**

```typescript
// JavaScript - Manual stream creation
import { connect, StreamConfig } from "nats";

const nc = await connect({ servers: "nats://localhost:4222" });
const jsm = await nc.jetstreamManager();

const streamConfig: StreamConfig = {
  name: "development.order-service",
  subjects: ["development.order-service.>"],
  retention: "limits",
  max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
  max_bytes: 1024 * 1024 * 1024, // 1GB
  storage: "file",
};

try {
  await jsm.streams.add(streamConfig);
} catch (error) {
  if (error.code === "10058") {
    console.log("Stream already exists");
  } else {
    throw error;
  }
}
```

3. **Check Resource Limits:**

```bash
# Check JetStream account info
nats account info

# View resource usage
curl http://localhost:8222/jsz?acc=1
```

**Prevention:**

- Use unique stream names per environment
- Monitor JetStream resources
- Implement proper error handling
- Document stream configurations
- Use infrastructure as code

---

## Authentication Issues

### Authentication Failures

**Symptoms:**

```
Error: authorization violation
Error: authentication timeout
Error: invalid credentials
```

**Causes:**

- Wrong username/password
- Token expired
- Missing credentials
- Account not authorized

**Solutions:**

1. **Configure Authentication:**

```typescript
// JavaScript - Username/password
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  user: "myuser",
  pass: "mypassword",
});

// Token authentication
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  token: "my-secret-token",
});

// NKey authentication
const publisher = new Publisher({
  servers: "nats://localhost:4222",
  nkey: "UA...",
  nkeySeed: "SU...",
});
```

```ruby
# Ruby - Authentication
NatsPubsub.configure do |config|
  config.servers = 'nats://localhost:4222'
  config.user = 'myuser'
  config.pass = 'mypassword'

  # Or token
  config.token = 'my-secret-token'
end
```

2. **Use Environment Variables:**

```bash
# Set in environment
export NATS_USER=myuser
export NATS_PASS=mypassword
export NATS_URL=nats://myuser:mypassword@localhost:4222
```

3. **Verify Server Configuration:**

```conf
# nats-server.conf
authorization {
  user: myuser
  password: mypassword

  # Or use accounts
  accounts {
    APP: {
      users = [
        {user: myuser, password: mypassword}
      ]
    }
  }
}
```

**Prevention:**

- Use secure credential storage (vault, secrets manager)
- Rotate credentials regularly
- Use principle of least privilege
- Monitor authentication failures
- Document authentication requirements

---

## Topology Issues

### Consumer Group Conflicts

**Symptoms:**

- Multiple consumers processing same message
- Unexpected load distribution
- Consumer creation failures

**Causes:**

- Same consumer name in different applications
- Conflicting delivery policies
- Shared consumer misconfiguration

**Solutions:**

1. **Use Unique Consumer Names:**

```typescript
// JavaScript - Ensure unique names
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      consumerName: "order-service.order-created", // Unique per service
      queue: "order-processors", // Queue group for load balancing
    });
  }
}
```

2. **Check Consumer Configuration:**

```bash
# List consumers for stream
nats consumer list development.order-service

# Check consumer details
nats consumer info development.order-service order-created

# Delete conflicting consumer
nats consumer delete development.order-service order-created
```

3. **Configure Delivery Policy:**

```typescript
// Set explicit delivery policy
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      deliverPolicy: "new", // Only new messages
      ackPolicy: "explicit", // Explicit ack required
      maxDeliver: 3, // Max redelivery
    });
  }
}
```

**Prevention:**

- Use consistent naming conventions
- Document consumer configurations
- Implement topology validation
- Use separate environments for testing
- Monitor consumer metrics

---

## Getting Help

If you're still experiencing issues after trying these solutions:

1. **Enable Debug Logging**: Set `logLevel: 'debug'` to see detailed operation logs
2. **Check the FAQ**: See [FAQ](./faq.md) for more questions and answers
3. **Use the Debugging Guide**: Follow [Debugging Guide](./debugging.md) for step-by-step troubleshooting
4. **Search GitHub Issues**: Check [existing issues](https://github.com/anthropics/nats-pubsub/issues)
5. **Ask the Community**: Post in [GitHub Discussions](https://github.com/anthropics/nats-pubsub/discussions)
6. **Report a Bug**: Create a [new issue](https://github.com/anthropics/nats-pubsub/issues/new) with details

---

## Related Documentation

- [Debugging Guide](./debugging.md) - Step-by-step debugging procedures
- [FAQ](./faq.md) - Frequently asked questions
- [Performance Guide](../guides/performance.md) - Optimization strategies
- [Configuration Reference](../reference/configuration.md) - All configuration options
- [Deployment Guide](../guides/deployment.md) - Production deployment best practices

---

**Last Updated**: November 2025 | **Version**: 1.0.0
