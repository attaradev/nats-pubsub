# Practical Monitoring Guide

Practical guide to monitoring NatsPubsub applications in production, covering essential metrics, alerts, dashboards, and health checks for both JavaScript and Ruby.

## Table of Contents

- [Overview](#overview)
- [Key Metrics](#key-metrics)
- [Setting Up Monitoring](#setting-up-monitoring)
  - [JavaScript Setup](#javascript-setup)
  - [Ruby Setup](#ruby-setup)
- [Health Checks](#health-checks)
- [Dashboard Examples](#dashboard-examples)
- [Setting Up Alerts](#setting-up-alerts)
- [Monitoring Consumer Lag](#monitoring-consumer-lag)
- [Performance Metrics](#performance-metrics)
- [Troubleshooting with Metrics](#troubleshooting-with-metrics)
- [Best Practices](#best-practices)
- [Related Resources](#related-resources)

---

## Overview

Effective monitoring is essential for maintaining healthy NatsPubsub applications. This guide focuses on practical, actionable monitoring that helps you:

- **Detect issues early** before they impact users
- **Understand system behavior** through metrics and trends
- **Respond quickly** to incidents with proper alerts
- **Optimize performance** based on data

### Monitoring Strategy

```mermaid
graph LR
    A[Collect Metrics] --> B[Visualize in Dashboards]
    B --> C[Set Up Alerts]
    C --> D[Respond to Issues]
    D --> A
```

---

## Key Metrics

### Critical Metrics (Monitor Always)

| Metric                        | Type      | Description                      | Alert Threshold |
| ----------------------------- | --------- | -------------------------------- | --------------- |
| **Consumer Lag**              | Gauge     | Messages waiting to be processed | > 1000          |
| **Error Rate**                | Counter   | Failed message processing        | > 5%            |
| **Processing Duration (p99)** | Histogram | 99th percentile processing time  | > 5s            |
| **Message Throughput**        | Counter   | Messages per second              | < 10 (too low)  |

### Important Metrics (Monitor Regularly)

| Metric                | Type    | Description                   |
| --------------------- | ------- | ----------------------------- |
| **Retry Count**       | Counter | Number of message retries     |
| **DLQ Size**          | Gauge   | Messages in Dead Letter Queue |
| **Connection Status** | Gauge   | NATS connection health        |
| **Active Consumers**  | Gauge   | Number of running consumers   |

### Nice-to-Have Metrics

- Message size distribution
- Processing duration by topic
- Success rate by consumer
- Memory and CPU usage

---

## Setting Up Monitoring

### JavaScript Setup

#### 1. Install Dependencies

```bash
npm install prom-client express
```

#### 2. Create Metrics Module

```typescript
// src/monitoring/metrics.ts
import { Registry, Counter, Histogram, Gauge } from "prom-client";

export class Metrics {
  public readonly registry: Registry;

  // Message metrics
  public readonly messagesPublished: Counter;
  public readonly messagesConsumed: Counter;
  public readonly messagesFailed: Counter;

  // Performance metrics
  public readonly processingDuration: Histogram;
  public readonly consumerLag: Gauge;

  constructor() {
    this.registry = new Registry();

    // Messages published
    this.messagesPublished = new Counter({
      name: "nats_messages_published_total",
      help: "Total messages published",
      labelNames: ["topic", "status"],
      registers: [this.registry],
    });

    // Messages consumed
    this.messagesConsumed = new Counter({
      name: "nats_messages_consumed_total",
      help: "Total messages consumed",
      labelNames: ["topic", "consumer"],
      registers: [this.registry],
    });

    // Failed messages
    this.messagesFailed = new Counter({
      name: "nats_messages_failed_total",
      help: "Total failed messages",
      labelNames: ["topic", "consumer", "error_type"],
      registers: [this.registry],
    });

    // Processing duration
    this.processingDuration = new Histogram({
      name: "nats_message_processing_seconds",
      help: "Message processing duration",
      labelNames: ["topic", "consumer"],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });

    // Consumer lag
    this.consumerLag = new Gauge({
      name: "nats_consumer_lag_messages",
      help: "Messages waiting to be processed",
      labelNames: ["consumer", "stream"],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metrics = new Metrics();
```

#### 3. Add Metrics Middleware

```typescript
// src/middleware/metrics-middleware.ts
import { Middleware, TopicMetadata } from "nats-pubsub";
import { metrics } from "../monitoring/metrics";

export class MetricsMiddleware implements Middleware {
  async call(
    message: any,
    metadata: TopicMetadata,
    next: () => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();

    metrics.messagesConsumed.inc({
      topic: metadata.topic,
      consumer: metadata.consumer || "unknown",
    });

    try {
      await next();

      const duration = (Date.now() - startTime) / 1000;
      metrics.processingDuration.observe(
        { topic: metadata.topic, consumer: metadata.consumer },
        duration,
      );
    } catch (error) {
      metrics.messagesFailed.inc({
        topic: metadata.topic,
        consumer: metadata.consumer,
        error_type: error.constructor.name,
      });
      throw error;
    }
  }
}

// Register middleware
NatsPubsub.use(new MetricsMiddleware());
```

#### 4. Expose Metrics Endpoint

```typescript
// src/server.ts
import express from "express";
import { metrics } from "./monitoring/metrics";

const app = express();

// Metrics endpoint for Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metrics.registry.contentType);
  res.end(await metrics.getMetrics());
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.listen(9090, () => {
  console.log("Metrics server listening on port 9090");
});
```

### Ruby Setup

#### 1. Add Gems

```ruby
# Gemfile
gem 'prometheus-client'
gem 'rack'
```

#### 2. Create Metrics Module

```ruby
# lib/monitoring/metrics.rb
require 'prometheus/client'

module Monitoring
  class Metrics
    attr_reader :registry, :messages_published, :messages_consumed,
                :messages_failed, :processing_duration, :consumer_lag

    def initialize
      @registry = Prometheus::Client::Registry.new

      @messages_published = Prometheus::Client::Counter.new(
        :nats_messages_published_total,
        docstring: 'Total messages published',
        labels: [:topic, :status]
      )
      @registry.register(@messages_published)

      @messages_consumed = Prometheus::Client::Counter.new(
        :nats_messages_consumed_total,
        docstring: 'Total messages consumed',
        labels: [:topic, :consumer]
      )
      @registry.register(@messages_consumed)

      @messages_failed = Prometheus::Client::Counter.new(
        :nats_messages_failed_total,
        docstring: 'Total failed messages',
        labels: [:topic, :consumer, :error_type]
      )
      @registry.register(@messages_failed)

      @processing_duration = Prometheus::Client::Histogram.new(
        :nats_message_processing_seconds,
        docstring: 'Message processing duration',
        labels: [:topic, :consumer],
        buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10]
      )
      @registry.register(@processing_duration)

      @consumer_lag = Prometheus::Client::Gauge.new(
        :nats_consumer_lag_messages,
        docstring: 'Messages waiting to be processed',
        labels: [:consumer, :stream]
      )
      @registry.register(@consumer_lag)
    end
  end
end

# Singleton
$metrics = Monitoring::Metrics.new
```

#### 3. Add Metrics Middleware

```ruby
# lib/middleware/metrics_middleware.rb
class MetricsMiddleware
  def call(message, context)
    start_time = Time.now

    $metrics.messages_consumed.increment(
      labels: {
        topic: context.topic,
        consumer: context.consumer || 'unknown'
      }
    )

    begin
      yield

      duration = Time.now - start_time
      $metrics.processing_duration.observe(
        duration,
        labels: {
          topic: context.topic,
          consumer: context.consumer
        }
      )
    rescue StandardError => e
      $metrics.messages_failed.increment(
        labels: {
          topic: context.topic,
          consumer: context.consumer,
          error_type: e.class.name
        }
      )
      raise
    end
  end
end

# Register middleware
NatsPubsub.configure do |config|
  config.middleware << MetricsMiddleware.new
end
```

#### 4. Expose Metrics Endpoint

```ruby
# config.ru or lib/metrics_server.rb
require 'prometheus/middleware/exporter'
require 'rack'

app = Rack::Builder.new do
  use Prometheus::Middleware::Exporter, registry: $metrics.registry

  map '/health' do
    run ->(env) {
      [200, { 'Content-Type' => 'application/json' },
       [{ status: 'healthy', timestamp: Time.now.iso8601 }.to_json]]
    }
  end
end

Rack::Handler::WEBrick.run app, Port: 9090
```

---

## Health Checks

### Basic Health Check

```typescript
// JavaScript
app.get("/health", async (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      nats: await checkNatsConnection(),
      database: await checkDatabaseConnection(),
      memory: checkMemoryUsage(),
    },
  };

  const isHealthy = Object.values(health.checks).every(
    (check) => check.healthy,
  );
  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkNatsConnection(): Promise<{ healthy: boolean }> {
  try {
    // Implement NATS connection check
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

```ruby
# Ruby
get '/health' do
  health = {
    status: 'healthy',
    timestamp: Time.now.iso8601,
    checks: {
      nats: check_nats_connection,
      database: check_database_connection,
      memory: check_memory_usage
    }
  }

  is_healthy = health[:checks].values.all? { |check| check[:healthy] }
  status is_healthy ? 200 : 503
  json health
end

def check_nats_connection
  { healthy: true }
rescue StandardError => e
  { healthy: false, error: e.message }
end
```

---

## Dashboard Examples

### Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "NatsPubsub Monitoring",
    "panels": [
      {
        "title": "Message Throughput",
        "targets": [
          {
            "expr": "rate(nats_messages_consumed_total[5m])",
            "legendFormat": "{{consumer}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Consumer Lag",
        "targets": [
          {
            "expr": "nats_consumer_lag_messages",
            "legendFormat": "{{consumer}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(nats_messages_failed_total[5m])",
            "legendFormat": "{{consumer}} - {{error_type}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Processing Duration (p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(nats_message_processing_seconds_bucket[5m]))",
            "legendFormat": "{{consumer}}"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## Setting Up Alerts

### Prometheus Alert Rules

```yaml
# alerts/natspubsub.yml
groups:
  - name: natspubsub_alerts
    interval: 30s
    rules:
      # High consumer lag
      - alert: HighConsumerLag
        expr: nats_consumer_lag_messages > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High consumer lag detected"
          description: "Consumer {{ $labels.consumer }} has {{ $value }} pending messages"

      # High error rate
      - alert: HighErrorRate
        expr: rate(nats_messages_failed_total[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate"
          description: "{{ $labels.consumer }} has {{ $value }} errors/sec"

      # Slow processing
      - alert: SlowProcessing
        expr: histogram_quantile(0.99, rate(nats_message_processing_seconds_bucket[5m])) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow message processing"
          description: "99th percentile is {{ $value }}s for {{ $labels.consumer }}"
```

---

## Monitoring Consumer Lag

### JavaScript Lag Monitor

```typescript
import { JetStreamManager } from "nats";

export class LagMonitor {
  constructor(private jsm: JetStreamManager) {}

  async monitorLag(intervalMs: number = 30000) {
    setInterval(async () => {
      await this.checkLag();
    }, intervalMs);
  }

  private async checkLag() {
    const streams = await this.jsm.streams.list().next();

    for (const stream of streams) {
      const consumers = await this.jsm.consumers
        .list(stream.config.name)
        .next();

      for (const consumer of consumers) {
        const info = await this.jsm.consumers.info(
          stream.config.name,
          consumer.name,
        );

        const lag = info.num_pending;

        metrics.consumerLag.set(
          { consumer: consumer.name, stream: stream.config.name },
          lag,
        );

        if (lag > 1000) {
          console.warn(`High lag: ${consumer.name} (${lag} messages)`);
        }
      }
    }
  }
}
```

---

## Performance Metrics

### Track Performance in Middleware

```typescript
class PerformanceMiddleware implements Middleware {
  async call(message: any, metadata: TopicMetadata, next: () => Promise<void>) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      await next();

      const duration = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      // Log slow operations
      if (duration > 1000) {
        console.warn("Slow processing", {
          consumer: metadata.consumer,
          duration,
          memoryUsed,
        });
      }
    } finally {
      // Always record metrics
      metrics.processingDuration.observe(
        { topic: metadata.topic, consumer: metadata.consumer },
        (Date.now() - startTime) / 1000,
      );
    }
  }
}
```

---

## Troubleshooting with Metrics

### Debugging High Lag

**Query**:

```promql
nats_consumer_lag_messages > 100
```

**Possible Causes**:

1. Consumer processing too slow
2. Message rate too high
3. Consumer crashed or stopped

**Solutions**:

- Increase concurrency
- Scale horizontally
- Optimize processing logic

### Debugging High Error Rate

**Query**:

```promql
rate(nats_messages_failed_total[5m]) > 5
```

**Investigate**:

1. Check error types: `nats_messages_failed_total{error_type="ValidationError"}`
2. Review DLQ messages
3. Check logs for stack traces

---

## Best Practices

### 1. Monitor the Right Metrics

Focus on metrics that indicate problems:

- Consumer lag (capacity issue)
- Error rate (code/data issue)
- Processing duration (performance issue)

### 2. Set Appropriate Thresholds

```typescript
// Good: Context-aware thresholds
if (lag > 1000 && lagGrowthRate > 100 / min) {
  alert("Consumer falling behind");
}

// Bad: Static thresholds without context
if (lag > 0) {
  alert("Consumer has lag"); // Too noisy
}
```

### 3. Use Dashboards Effectively

- **Overview dashboard**: System health at a glance
- **Detailed dashboards**: Deep dives per service
- **On-call dashboard**: Critical metrics only

### 4. Alert on Trends, Not Spikes

```promql
# Good: Alert on sustained issues
rate(nats_messages_failed_total[5m]) > 10

# Bad: Alert on single failures
nats_messages_failed_total > 0
```

---

## Related Resources

- [Advanced Monitoring](../advanced/monitoring.md) - Deep dive into Prometheus/Grafana
- [Observability Guide](../advanced/observability.md) - Logs, metrics, traces
- [Performance Guide](./performance.md) - Performance optimization

---

**Navigation:**

- [Previous: Middleware System](./middleware.md)
- [Next: Performance Tuning](./performance.md)
- [Documentation Home](../index.md)
