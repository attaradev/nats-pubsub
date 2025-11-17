# Debugging Guide

This comprehensive guide will help you debug issues with NatsPubsub, trace message flow, and diagnose problems in both development and production environments.

## Table of Contents

- [Enabling Debug Logging](#enabling-debug-logging)
- [Tracing Message Flow](#tracing-message-flow)
- [Using NATS CLI Tools](#using-nats-cli-tools)
- [Debugging Subscribers](#debugging-subscribers)
- [Debugging Publishers](#debugging-publishers)
- [Debugging Connection Issues](#debugging-connection-issues)
- [Debugging Performance Problems](#debugging-performance-problems)
- [Production Debugging Techniques](#production-debugging-techniques)
- [Debug Tools and Utilities](#debug-tools-and-utilities)
- [Common Debugging Scenarios](#common-debugging-scenarios)

---

## Enabling Debug Logging

### JavaScript/TypeScript

Enable detailed logging to see exactly what's happening:

```typescript
import NatsPubsub, { Subscriber, TopicMetadata } from "nats-pubsub";

// Configure with debug logging
NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
  logger: {
    debug: (msg, meta) => console.debug("[DEBUG]", msg, meta),
    info: (msg, meta) => console.info("[INFO]", msg, meta),
    warn: (msg, meta) => console.warn("[WARN]", msg, meta),
    error: (msg, meta) => console.error("[ERROR]", msg, meta),
  },
});

// Enable debug logging for Subscriber
class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created", {
      maxDeliver: 5,
      ackWait: 30000,
    });
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    console.log("[DEBUG] Processing message:", {
      event_id: metadata.event_id,
      topic: metadata.topic,
      occurred_at: metadata.occurred_at,
      payload: JSON.stringify(message),
    });

    await processOrder(message);
  }
}
```

### Custom Logger

Integrate with your logging system:

```typescript
import NatsPubsub, { Logger } from "nats-pubsub";
import winston from "winston";

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: "debug",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "nats-pubsub.log" }),
  ],
});

// Create custom logger adapter
const customLogger: Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.debug(message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.info(message, meta);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.warn(message, meta);
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    winstonLogger.error(message, meta);
  },
};

// Use custom logger
NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
  logger: customLogger,
});
```

### Ruby

Enable debug logging in Ruby:

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.nats_urls = 'nats://localhost:4222'
  config.log_level = :debug # Options: :error, :warn, :info, :debug
  config.logger = Rails.logger
end

# In subscriber
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    logger.debug "Processing message: #{context.message_id}"
    logger.debug "Payload: #{message.inspect}"

    process_order(message)
  end
end
```

### Environment-Based Logging

```typescript
// JavaScript - Conditional debug logging
NatsPubsub.configure({
  natsUrls: process.env.NATS_URL || "nats://localhost:4222",
  env: process.env.NODE_ENV || "development",
  appName: "my-app",
  logger:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          debug: (msg, meta) => console.debug("[DEBUG]", msg, meta),
          info: (msg, meta) => console.info("[INFO]", msg, meta),
          warn: (msg, meta) => console.warn("[WARN]", msg, meta),
          error: (msg, meta) => console.error("[ERROR]", msg, meta),
        },
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.log_level = Rails.env.production? ? :info : :debug
end
```

---

## Tracing Message Flow

### End-to-End Message Tracing

Track messages from publisher to subscriber:

```typescript
// JavaScript - Add correlation IDs
import NatsPubsub, { Subscriber, TopicMetadata } from "nats-pubsub";
import { v4 as uuidv4 } from "uuid";

// Publisher: Add correlation ID
const correlationId = uuidv4();

await NatsPubsub.publish("order.created", orderData, {
  trace_id: correlationId,
  message_type: "OrderCreated",
});

console.log(`[TRACE] Published message: ${correlationId}`);

// Subscriber: Track with same correlation ID
class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    const correlationId = metadata.trace_id;

    console.log(`[TRACE] Received message: ${correlationId}`, {
      topic: metadata.topic,
      receivedAt: Date.now(),
      publishedAt: new Date(metadata.occurred_at).getTime(),
      latency: Date.now() - new Date(metadata.occurred_at).getTime(),
    });

    try {
      await processOrder(message);
      console.log(`[TRACE] Processed successfully: ${correlationId}`);
    } catch (error) {
      console.error(`[TRACE] Processing failed: ${correlationId}`, error);
      throw error;
    }
  }
}
```

### Distributed Tracing

Integrate with OpenTelemetry:

```typescript
import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import { Subscriber, TopicMetadata } from "nats-pubsub";

class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    const tracer = trace.getTracer("nats-pubsub");

    // Create span for message processing
    const span = tracer.startSpan("process-order", {
      attributes: {
        "message.id": metadata.event_id,
        "message.topic": metadata.topic,
        "message.trace_id": metadata.trace_id || "",
      },
    });

    try {
      await context.with(trace.setSpan(context.active(), span), async () => {
        await processOrder(message);
      });

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### Logging Message Journey

Create comprehensive trace logs:

```typescript
interface MessageTrace {
  correlationId: string;
  topic: string;
  events: Array<{
    timestamp: number;
    event: string;
    details?: any;
  }>;
}

const traces = new Map<string, MessageTrace>();

// Publisher
async function publishWithTrace(topic: string, data: any) {
  const correlationId = uuidv4();
  const trace: MessageTrace = {
    correlationId,
    topic,
    events: [
      {
        timestamp: Date.now(),
        event: "published",
        details: { topic, payloadSize: JSON.stringify(data).length },
      },
    ],
  };

  traces.set(correlationId, trace);

  await NatsPubsub.publish(topic, data, {
    trace_id: correlationId,
  });

  return correlationId;
}

// Subscriber
class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    const correlationId = metadata.trace_id;

    if (correlationId && traces.has(correlationId)) {
      const trace = traces.get(correlationId)!;
      trace.events.push({
        timestamp: Date.now(),
        event: "received",
        details: { topic: metadata.topic },
      });

      try {
        await processOrder(message);

        trace.events.push({
          timestamp: Date.now(),
          event: "processed",
          details: { success: true },
        });
      } catch (error) {
        trace.events.push({
          timestamp: Date.now(),
          event: "failed",
          details: { error: (error as Error).message },
        });
        throw error;
      } finally {
        // Log complete trace
        console.log("[TRACE] Message journey:", JSON.stringify(trace, null, 2));
      }
    }
  }
}
```

---

## Using NATS CLI Tools

### Installation

```bash
# Install NATS CLI
brew install nats-io/nats-tools/nats

# Or download from https://github.com/nats-io/natscli/releases

# Verify installation
nats --version
```

### Server Information

```bash
# Check server status
nats server check

# View server info
nats server info

# Monitor server in real-time
nats server report

# View detailed server metrics
curl http://localhost:8222/varz | jq

# Check JetStream status
curl http://localhost:8222/jsz | jq
```

### Stream Management

```bash
# List all streams
nats stream list

# View stream details
nats stream info development.order-service

# Watch stream in real-time
nats stream report

# View stream configuration
nats stream info development.order-service -j | jq .config

# Check stream subjects
nats stream subjects development.order-service

# View stream messages
nats stream view development.order-service

# Get specific message
nats stream get development.order-service 1234
```

### Consumer Management

```bash
# List consumers for a stream
nats consumer list development.order-service

# View consumer details
nats consumer info development.order-service order-created

# Watch consumer lag
nats consumer report development.order-service

# Check consumer configuration
nats consumer info development.order-service order-created -j | jq .config

# View next message for consumer
nats consumer next development.order-service order-created
```

### Message Inspection

```bash
# Subscribe and view messages
nats subscribe "development.order-service.>"

# Subscribe with subject filter
nats subscribe "development.order-service.order.created"

# View raw message data
nats subscribe "development.order-service.>" --dump

# Count messages
nats subscribe "development.order-service.>" --count

# Publish test message
nats publish development.order-service.order.created '{"orderId": "test-123"}'

# Request/reply pattern
nats request development.order-service.get-order '{"orderId": "123"}'
```

### Benchmarking

```bash
# Benchmark publishing
nats bench test.subject --pub 1 --msgs 10000

# Benchmark subscribing
nats bench test.subject --sub 1 --msgs 10000

# Benchmark pub/sub
nats bench test.subject --pub 1 --sub 1 --msgs 10000

# With specific payload size
nats bench test.subject --pub 1 --msgs 10000 --size 1024
```

### Account Information

```bash
# View account info
nats account info

# List streams and consumers
nats account ls

# Check resource usage
nats account report
```

---

## Debugging Subscribers

### Check Subscriber Connection

```typescript
// JavaScript - Monitor subscriber status
class OrderSubscriber extends Subscriber {
  constructor() {
    super("order.created", {
      debug: true,
    });

    // Track connection state
    this.on("connect", () => {
      console.log("[DEBUG] Subscriber connected");
    });

    this.on("disconnect", () => {
      console.log("[DEBUG] Subscriber disconnected");
    });

    this.on("error", (error) => {
      console.error("[DEBUG] Subscriber error:", error);
    });

    this.on("subscribed", () => {
      console.log("[DEBUG] Subscriber subscribed to topic");
    });
  }

  async handle(message, metadata) {
    console.log("[DEBUG] Message received:", {
      messageId: metadata.messageId,
      subject: metadata.subject,
      attempt: metadata.deliveryAttempt,
      pending: metadata.pending,
    });

    await processOrder(message);
  }

  async onError(error, message, metadata) {
    console.error("[DEBUG] Handler error:", {
      error: error.message,
      stack: error.stack,
      messageId: metadata.messageId,
      attempt: metadata.deliveryAttempt,
    });
  }
}
```

### Verify Subscriber Configuration

```typescript
// Check subscriber settings
const subscriber = new OrderSubscriber();

console.log("[DEBUG] Subscriber config:", {
  topic: subscriber.topic,
  consumerName: subscriber.consumerName,
  queue: subscriber.queue,
  maxDeliver: subscriber.maxDeliver,
  ackWait: subscriber.ackWait,
  useInbox: subscriber.useInbox,
});

// Connect and verify
await subscriber.connect({
  servers: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
});

console.log("[DEBUG] Subscriber connected:", {
  isActive: subscriber.isActive(),
  subject: subscriber.getFullSubject(),
  consumerInfo: await subscriber.getConsumerInfo(),
});
```

### Test Subscriber Locally

```typescript
// Test subscriber with inline mode
import { Subscriber } from "nats-pubsub";

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    console.log("[DEBUG] Test mode - received:", message);
    await processOrder(message);
  }
}

const subscriber = new OrderSubscriber();
await subscriber.connect({
  servers: "nats://localhost:4222",
  mode: "inline", // Process synchronously for testing
  debug: true,
});

// Send test message
await publisher.publish("order.created", {
  orderId: "test-123",
  amount: 99.99,
});

// Wait and check
await new Promise((resolve) => setTimeout(resolve, 1000));
console.log("[DEBUG] Test complete");
```

### Monitor Subscriber Metrics

```typescript
// Track subscriber performance
class OrderSubscriber extends Subscriber {
  private metrics = {
    processed: 0,
    errors: 0,
    totalLatency: 0,
    lastProcessedAt: null as Date | null,
  };

  async handle(message, metadata) {
    const startTime = Date.now();

    try {
      await processOrder(message);

      this.metrics.processed++;
      this.metrics.totalLatency += Date.now() - startTime;
      this.metrics.lastProcessedAt = new Date();

      console.log("[DEBUG] Subscriber metrics:", {
        processed: this.metrics.processed,
        errors: this.metrics.errors,
        avgLatency: Math.round(
          this.metrics.totalLatency / this.metrics.processed,
        ),
        lastProcessed: this.metrics.lastProcessedAt,
      });
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

---

## Debugging Publishers

### Verify Message Publishing

```typescript
// JavaScript - Debug publishing
import NatsPubsub from "nats-pubsub";
import { Subject } from "nats-pubsub";

NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
  logger: {
    debug: (msg, meta) => console.debug("[DEBUG]", msg, meta),
    info: (msg, meta) => console.info("[INFO]", msg, meta),
    warn: (msg, meta) => console.warn("[WARN]", msg, meta),
    error: (msg, meta) => console.error("[ERROR]", msg, meta),
  },
});

// Publish with detailed logging
async function debugPublish(topic: string, data: any) {
  const config = NatsPubsub.getConfig();
  const fullSubject = Subject.build(config.env, config.appName, topic);

  console.log("[DEBUG] Publishing message:", {
    topic,
    fullSubject,
    payload: JSON.stringify(data),
    payloadSize: JSON.stringify(data).length,
  });

  try {
    await NatsPubsub.publish(topic, data);

    console.log("[DEBUG] Publish successful:", {
      topic,
      fullSubject,
    });
  } catch (error) {
    console.error("[DEBUG] Publish failed:", {
      topic,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}
```

### Test Publisher Connection

```typescript
// Verify publisher can connect and publish
import NatsPubsub from "nats-pubsub";

async function testPublisher() {
  try {
    // Configure
    NatsPubsub.configure({
      natsUrls: "nats://localhost:4222",
      env: "development",
      appName: "test-app",
    });

    console.log("[DEBUG] Configuration successful");

    // Test connection by publishing
    await NatsPubsub.publish("test.message", {
      test: true,
      timestamp: Date.now(),
    });

    console.log("[DEBUG] Test publish successful");

    return true;
  } catch (error) {
    console.error("[DEBUG] Test failed:", error);
    return false;
  }
}

await testPublisher();
```

### Debug Batch Publishing

```typescript
// Debug batch publishing
import NatsPubsub from "nats-pubsub";

NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
});

// Publish messages in batch
const startTime = Date.now();
const batch = NatsPubsub.batch();

for (let i = 0; i < 100; i++) {
  batch.add("order.created", {
    orderId: `order-${i}`,
    amount: 99.99,
  });
}

console.log("[DEBUG] Publishing batch of 100 messages...");

const result = await batch.publish();

const duration = Date.now() - startTime;
const throughput = Math.round(result.successCount / (duration / 1000));

console.log("[DEBUG] Batch published:", {
  successCount: result.successCount,
  failureCount: result.failureCount,
  duration: duration + "ms",
  throughput: throughput + " msg/s",
});

if (result.failureCount > 0) {
  console.error("[DEBUG] Some messages failed:", result.failures);
}
```

### Debug Outbox Publishing

```typescript
// Debug outbox pattern
import NatsPubsub from "nats-pubsub";

NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
  useOutbox: true, // Enable outbox pattern
});

// Publish with outbox - messages are stored in database first
await NatsPubsub.publish("order.created", orderData);

console.log("[DEBUG] Message stored in outbox, will be published by worker");

// Note: Check your outbox table directly in the database
// SELECT * FROM nats_pubsub_outbox WHERE status = 'pending';
```

---

## Debugging Connection Issues

### Connection Diagnostics

```typescript
// Comprehensive connection testing
async function diagnoseConnection(url: string) {
  console.log("[DEBUG] Testing connection to:", url);

  // Test basic connectivity
  try {
    const parsed = new URL(url);
    console.log("[DEBUG] URL parsed:", {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 4222,
    });
  } catch (error) {
    console.error("[DEBUG] Invalid URL:", error.message);
    return;
  }

  // Test NATS connection
  try {
    const nc = await connect({ servers: url, timeout: 5000 });
    console.log("[DEBUG] Connected successfully");

    // Test JetStream
    const js = nc.jetstream();
    console.log("[DEBUG] JetStream available");

    // Test publishing
    const ack = await js.publish(
      "test.subject",
      JSON.stringify({ test: true }),
    );
    console.log("[DEBUG] Test publish successful:", {
      stream: ack.stream,
      sequence: ack.seq,
    });

    await nc.close();
    console.log("[DEBUG] Connection closed cleanly");
  } catch (error) {
    console.error("[DEBUG] Connection test failed:", {
      error: error.message,
      code: error.code,
      stack: error.stack,
    });
  }
}

await diagnoseConnection("nats://localhost:4222");
```

### Network Testing

```bash
# Test basic connectivity
telnet localhost 4222

# Check if port is open
nc -zv localhost 4222

# Test with timeout
timeout 5 telnet localhost 4222

# Check DNS resolution
nslookup your-nats-server.com

# Trace route
traceroute your-nats-server.com

# Check firewall rules
sudo iptables -L -n | grep 4222
```

### Monitor Connection Events

```typescript
// Track all connection events
import { connect } from "nats";

const nc = await connect({
  servers: "nats://localhost:4222",
  reconnect: true,
  maxReconnectAttempts: 10,
  debug: true,
});

// Connection events
nc.status().forEach((status) => {
  console.log("[DEBUG] Connection status:", {
    type: status.type,
    data: status.data,
    timestamp: new Date().toISOString(),
  });
});

// Monitor for errors
(async () => {
  for await (const err of nc.status()) {
    console.error("[DEBUG] Connection event:", err);
  }
})();
```

---

## Debugging Performance Problems

### Profile Message Processing

```typescript
// Measure processing time
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    const timings: Record<string, number> = {};
    const startTime = Date.now();

    // Measure each step
    const mark = (name: string) => {
      timings[name] = Date.now() - startTime;
    };

    mark("start");

    const order = await fetchOrder(message.orderId);
    mark("fetch-order");

    const user = await fetchUser(order.userId);
    mark("fetch-user");

    const result = await calculateTotal(order, user);
    mark("calculate");

    await saveOrder(result);
    mark("save");

    const totalTime = Date.now() - startTime;

    console.log("[DEBUG] Processing timings:", {
      messageId: metadata.messageId,
      total: totalTime,
      breakdown: timings,
      percentages: Object.entries(timings).reduce(
        (acc, [key, value]) => {
          acc[key] = Math.round((value / totalTime) * 100) + "%";
          return acc;
        },
        {} as Record<string, string>,
      ),
    });
  }
}
```

### Memory Profiling

```typescript
// Track memory usage
function logMemoryUsage(label: string) {
  const usage = process.memoryUsage();
  console.log(`[DEBUG] Memory usage - ${label}:`, {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + "MB",
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + "MB",
    external: Math.round(usage.external / 1024 / 1024) + "MB",
    rss: Math.round(usage.rss / 1024 / 1024) + "MB",
  });
}

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    logMemoryUsage("before-processing");

    await processOrder(message);

    logMemoryUsage("after-processing");

    // Force GC if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
      logMemoryUsage("after-gc");
    }
  }
}
```

### Throughput Measurement

```typescript
// Measure message throughput
class PerformanceTracker {
  private processed = 0;
  private startTime = Date.now();
  private intervalId: NodeJS.Timeout;

  start() {
    this.intervalId = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const throughput = this.processed / elapsed;

      console.log("[DEBUG] Performance metrics:", {
        processed: this.processed,
        elapsed: Math.round(elapsed) + "s",
        throughput: Math.round(throughput) + " msg/s",
        avgLatency: Math.round(1000 / throughput) + "ms",
      });
    }, 5000);
  }

  record() {
    this.processed++;
  }

  stop() {
    clearInterval(this.intervalId);
  }
}

const tracker = new PerformanceTracker();
tracker.start();

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    await processOrder(message);
    tracker.record();
  }
}
```

---

## Production Debugging Techniques

### Safe Production Debugging

```typescript
// Enable debug logging without restart
import { setLogLevel } from "nats-pubsub";

// Add HTTP endpoint to change log level
app.post("/debug/loglevel", (req, res) => {
  const level = req.body.level;

  // Validate level
  if (!["error", "warn", "info", "debug"].includes(level)) {
    return res.status(400).json({ error: "Invalid log level" });
  }

  // Change log level at runtime
  setLogLevel(level);

  res.json({ success: true, level });
});

// Auto-reset after timeout
setTimeout(
  () => {
    setLogLevel("info");
    console.log("[DEBUG] Log level reset to info");
  },
  5 * 60 * 1000,
); // 5 minutes
```

### Sampling

```typescript
// Sample messages for debugging
class OrderSubscriber extends Subscriber {
  private sampleRate = parseFloat(process.env.DEBUG_SAMPLE_RATE || "0.01"); // 1%

  async handle(message, metadata) {
    const shouldLog = Math.random() < this.sampleRate;

    if (shouldLog) {
      console.log("[DEBUG] Sampled message:", {
        messageId: metadata.messageId,
        subject: metadata.subject,
        payload: message,
      });
    }

    await processOrder(message);
  }
}
```

### Feature Flags

```typescript
// Use feature flags for debug features
import { isFeatureEnabled } from "./feature-flags";

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    if (isFeatureEnabled("debug-message-processing")) {
      console.log("[DEBUG] Processing message:", {
        messageId: metadata.messageId,
        payload: message,
      });
    }

    await processOrder(message);

    if (isFeatureEnabled("debug-message-processing")) {
      console.log("[DEBUG] Message processed successfully");
    }
  }
}
```

### Remote Debugging

```typescript
// Enable remote debugging with inspector
// Run with: node --inspect=0.0.0.0:9229 app.js

// Or programmatically
import inspector from "inspector";

if (process.env.ENABLE_INSPECTOR === "true") {
  inspector.open(9229, "0.0.0.0");
  console.log("[DEBUG] Inspector enabled on port 9229");
}
```

### Structured Logging

```typescript
// Production-safe structured logging
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
});

class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    logger.info(
      {
        messageId: metadata.messageId,
        topic: "order.created",
        orderId: message.orderId,
      },
      "Processing order",
    );

    try {
      await processOrder(message);

      logger.info(
        {
          messageId: metadata.messageId,
          orderId: message.orderId,
        },
        "Order processed successfully",
      );
    } catch (error) {
      logger.error(
        {
          messageId: metadata.messageId,
          orderId: message.orderId,
          error,
        },
        "Order processing failed",
      );
      throw error;
    }
  }
}
```

---

## Debug Tools and Utilities

### Health Check Endpoint

```typescript
// Create health check endpoint
import { Publisher, Subscriber } from "nats-pubsub";
import express from "express";

const app = express();

app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {
      nats: { status: "unknown" },
      jetstream: { status: "unknown" },
      publisher: { status: "unknown" },
      subscribers: { status: "unknown" },
    },
  };

  try {
    // Check NATS connection
    const nc = await connect({
      servers: "nats://localhost:4222",
      timeout: 5000,
    });
    health.checks.nats = { status: "ok" };

    // Check JetStream
    const js = nc.jetstream();
    await js.streams.info("development.order-service");
    health.checks.jetstream = { status: "ok" };

    await nc.close();
  } catch (error) {
    health.status = "error";
    health.checks.nats = {
      status: "error",
      error: error.message,
    };
  }

  res.status(health.status === "ok" ? 200 : 503).json(health);
});

app.listen(3000);
```

### Message Inspector

```typescript
// Tool to inspect messages
class MessageInspector {
  async inspect(stream: string, sequence: number) {
    const nc = await connect({ servers: "nats://localhost:4222" });
    const jsm = await nc.jetstreamManager();

    try {
      const msg = await jsm.streams.getMessage(stream, { seq: sequence });

      console.log("[INSPECT] Message details:", {
        stream: msg.stream,
        sequence: msg.seq,
        subject: msg.subject,
        time: new Date(msg.time),
        data: JSON.parse(new TextDecoder().decode(msg.data)),
        headers: msg.headers,
      });

      return msg;
    } catch (error) {
      console.error("[INSPECT] Failed to get message:", error);
      throw error;
    } finally {
      await nc.close();
    }
  }

  async inspectLatest(stream: string, count = 10) {
    const nc = await connect({ servers: "nats://localhost:4222" });
    const jsm = await nc.jetstreamManager();

    try {
      const info = await jsm.streams.info(stream);
      const latestSeq = info.state.last_seq;

      console.log(`[INSPECT] Inspecting last ${count} messages from ${stream}`);

      for (let i = 0; i < count; i++) {
        const seq = latestSeq - i;
        if (seq < 1) break;

        try {
          await this.inspect(stream, seq);
        } catch (error) {
          console.error(
            `[INSPECT] Failed to get message ${seq}:`,
            error.message,
          );
        }
      }
    } finally {
      await nc.close();
    }
  }
}

const inspector = new MessageInspector();
await inspector.inspectLatest("development.order-service", 5);
```

### Consumer Lag Monitor

```bash
#!/bin/bash
# monitor-lag.sh - Monitor consumer lag

STREAM="development.order-service"

while true; do
  echo "=== Consumer Lag Report $(date) ==="
  nats consumer report "$STREAM"
  echo ""
  sleep 5
done
```

### Debug Dashboard

```typescript
// Simple debug dashboard
import express from "express";
import { Subscriber } from "nats-pubsub";

const app = express();
const metrics = {
  processed: 0,
  errors: 0,
  lastError: null,
  lastProcessed: null,
};

// Update metrics from subscriber
class OrderSubscriber extends Subscriber {
  async handle(message, metadata) {
    try {
      await processOrder(message);
      metrics.processed++;
      metrics.lastProcessed = new Date();
    } catch (error) {
      metrics.errors++;
      metrics.lastError = {
        message: error.message,
        timestamp: new Date(),
      };
      throw error;
    }
  }
}

// Serve metrics dashboard
app.get("/debug/metrics", (req, res) => {
  res.json(metrics);
});

app.get("/debug/dashboard", (req, res) => {
  res.send(`
    <html>
      <head><title>NatsPubsub Debug Dashboard</title></head>
      <body>
        <h1>NatsPubsub Debug Dashboard</h1>
        <div id="metrics"></div>
        <script>
          setInterval(async () => {
            const response = await fetch('/debug/metrics');
            const data = await response.json();
            document.getElementById('metrics').innerHTML =
              '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

app.listen(3000);
```

---

## Common Debugging Scenarios

### Scenario 1: Messages Not Being Received

**Step 1: Verify Publisher**

```bash
# Check if messages are being published
nats subscribe "development.order-service.>"
```

```typescript
// Enable debug logging on publisher
import NatsPubsub from "nats-pubsub";

NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
  logger: {
    debug: (msg, meta) => console.debug("[DEBUG]", msg, meta),
    info: (msg, meta) => console.info("[INFO]", msg, meta),
    warn: (msg, meta) => console.warn("[WARN]", msg, meta),
    error: (msg, meta) => console.error("[ERROR]", msg, meta),
  },
});
```

**Step 2: Check Stream**

```bash
# Verify stream exists and has messages
nats stream info development.order-service

# View messages in stream
nats stream view development.order-service
```

**Step 3: Check Consumer**

```bash
# Verify consumer exists
nats consumer list development.order-service

# Check consumer info
nats consumer info development.order-service order-created

# Try to get next message
nats consumer next development.order-service order-created
```

**Step 4: Check Subscriber**

```typescript
// Verify subscriber is registered and running
import NatsPubsub, { Subscriber, TopicMetadata } from "nats-pubsub";

class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    console.log("[DEBUG] Message received:", metadata.event_id);
    // Process message
  }
}

// Register and start
NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "order-service",
});

NatsPubsub.registerSubscriber(new OrderSubscriber());
await NatsPubsub.start();

console.log("[DEBUG] Subscriber started and listening");
```

### Scenario 2: High Latency

**Step 1: Measure End-to-End Latency**

```typescript
// Add timestamps
import NatsPubsub, { Subscriber, TopicMetadata } from "nats-pubsub";

await NatsPubsub.publish("order.created", data, {
  trace_id: "trace-123",
  // occurred_at is automatically added by NatsPubsub
});

class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    const publishedAt = new Date(metadata.occurred_at).getTime();
    const latency = Date.now() - publishedAt;
    console.log("[DEBUG] Latency:", latency, "ms");
  }
}
```

**Step 2: Check Network Latency**

```bash
# Ping NATS server
ping your-nats-server.com

# Check network path
traceroute your-nats-server.com
```

**Step 3: Profile Handler**

```typescript
// Measure processing time
import { Subscriber, TopicMetadata } from "nats-pubsub";

class OrderSubscriber extends Subscriber<
  Record<string, unknown>,
  TopicMetadata
> {
  constructor() {
    super("development.order-service.order.created");
  }

  async handle(
    message: Record<string, unknown>,
    metadata: TopicMetadata,
  ): Promise<void> {
    const start = Date.now();
    await processOrder(message);
    const duration = Date.now() - start;
    console.log("[DEBUG] Processing time:", duration, "ms");
  }
}
```

### Scenario 3: Memory Leak

**Step 1: Monitor Memory**

```typescript
// Track memory over time
setInterval(() => {
  const usage = process.memoryUsage();
  console.log("[DEBUG] Memory:", {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + "MB",
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + "MB",
  });
}, 10000);
```

**Step 2: Take Heap Snapshot**

```typescript
// Take heap snapshot
import v8 from "v8";
import fs from "fs";

function takeHeapSnapshot(filename: string) {
  const snapshot = v8.writeHeapSnapshot(filename);
  console.log("[DEBUG] Heap snapshot written to:", snapshot);
}

// Take snapshots periodically
setInterval(() => {
  takeHeapSnapshot(`heap-${Date.now()}.heapsnapshot`);
}, 60000);
```

**Step 3: Analyze with Chrome DevTools**

1. Take heap snapshot
2. Load in Chrome DevTools (Memory tab)
3. Compare snapshots to find leaks
4. Look for growing arrays, maps, or retained objects

---

## Next Steps

- Review [Common Issues](./common-issues.md) for solutions to specific problems
- Check [FAQ](./faq.md) for quick answers
- Read [Performance Guide](../guides/performance.md) for optimization tips
- Join [GitHub Discussions](https://github.com/anthropics/nats-pubsub/discussions) for community support

---

**Last Updated**: November 2025 | **Version**: 1.0.0
