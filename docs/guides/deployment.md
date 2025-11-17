# Deployment Guide

This comprehensive guide covers deploying NatsPubsub applications to production, including Docker, Kubernetes, environment configuration, monitoring, and operational best practices.

## Table of Contents

- [Overview](#overview)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [NATS Server Setup](#nats-server-setup)
- [Database Setup](#database-setup)
- [Monitoring and Observability](#monitoring-and-observability)
- [Health Checks](#health-checks)
- [Scaling Strategies](#scaling-strategies)
- [High Availability](#high-availability)
- [Security](#security)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)

---

## Overview

Deploying a NatsPubsub application involves several components:

```mermaid
graph TB
    subgraph "Application Layer"
        A1[Publisher Service]
        A2[Subscriber Service]
        A3[Web API]
    end

    subgraph "Messaging Layer"
        N1[NATS Server 1]
        N2[NATS Server 2]
        N3[NATS Server 3]
    end

    subgraph "Data Layer"
        D1[(PostgreSQL Primary)]
        D2[(PostgreSQL Replica)]
    end

    subgraph "Observability"
        M[Prometheus]
        G[Grafana]
        L[Loki/ELK]
    end

    A1 --> N1
    A1 --> N2
    A1 --> N3
    A2 --> N1
    A2 --> N2
    A2 --> N3
    A3 --> N1

    A1 --> D1
    A2 --> D1
    A3 --> D1
    D1 --> D2

    A1 --> M
    A2 --> M
    M --> G
    A1 --> L
    A2 --> L
```

---

## Environment Configuration

### Environment Variables

#### JavaScript/TypeScript

```bash
# .env.production
# NATS Configuration
NATS_URLS=nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
NATS_USER=nats_user
NATS_PASS=secure_password
NATS_TLS=true

# Application Configuration
NODE_ENV=production
APP_NAME=order-service
ENV=production
LOG_LEVEL=info

# Consumer Configuration
CONCURRENCY=20
MAX_DELIVER=5
ACK_WAIT=30000
BATCH_SIZE=25
USE_DLQ=true

# Database Configuration (for Outbox pattern)
DATABASE_URL=postgresql://user:password@postgres:5432/orders_production
DB_POOL_SIZE=20

# Monitoring
PROMETHEUS_PORT=9090
HEALTH_CHECK_PORT=8080

# Tracing (Optional)
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

#### Ruby

```bash
# .env.production
# NATS Configuration
NATS_URLS=nats://nats-1:4222,nats://nats-2:4222,nats://nats-3:4222
NATS_USER=nats_user
NATS_PASS=secure_password
NATS_TLS=true

# Application Configuration
RAILS_ENV=production
APP_NAME=order-service
ENV=production
LOG_LEVEL=info

# Consumer Configuration
CONCURRENCY=20
MAX_DELIVER=5
ACK_WAIT=30
BATCH_SIZE=25
USE_DLQ=true

# Database Configuration
DATABASE_URL=postgresql://user:password@postgres:5432/orders_production
RAILS_MAX_THREADS=20

# Redis (for caching/locks)
REDIS_URL=redis://redis:6379/0

# Monitoring
PROMETHEUS_PORT=9090
```

### Configuration Files

#### JavaScript/TypeScript

```typescript
// config/production.ts
export default {
  nats: {
    urls: process.env.NATS_URLS?.split(",") || [],
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
    tls: process.env.NATS_TLS === "true",
    maxReconnectAttempts: -1, // Infinite
    reconnectTimeWait: 2000,
    timeout: 10000,
  },

  app: {
    env: process.env.ENV || "production",
    appName: process.env.APP_NAME || "app",
    logLevel: process.env.LOG_LEVEL || "info",
  },

  consumer: {
    concurrency: parseInt(process.env.CONCURRENCY || "20"),
    maxDeliver: parseInt(process.env.MAX_DELIVER || "5"),
    ackWait: parseInt(process.env.ACK_WAIT || "30000"),
    batchSize: parseInt(process.env.BATCH_SIZE || "25"),
    useDlq: process.env.USE_DLQ === "true",
  },

  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE || "20"),
  },

  monitoring: {
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || "9090"),
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || "8080"),
  },
};
```

#### Ruby

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.servers = ENV['NATS_URLS']&.split(',') || ['nats://localhost:4222']
  config.user = ENV['NATS_USER']
  config.password = ENV['NATS_PASS']
  config.tls = ENV['NATS_TLS'] == 'true'

  config.env = ENV['ENV'] || Rails.env
  config.app_name = ENV['APP_NAME'] || 'app'

  config.concurrency = ENV['CONCURRENCY']&.to_i || 20
  config.max_deliver = ENV['MAX_DELIVER']&.to_i || 5
  config.ack_wait = ENV['ACK_WAIT']&.to_i || 30
  config.batch_size = ENV['BATCH_SIZE']&.to_i || 25
  config.use_dlq = ENV['USE_DLQ'] == 'true'

  config.use_outbox = true
  config.use_inbox = true

  # Structured logging
  config.logger = ActiveSupport::Logger.new(STDOUT)
  config.logger.level = ENV['LOG_LEVEL']&.to_sym || :info
end
```

---

## Docker Deployment

### Dockerfile for Node.js Application

```dockerfile
# Multi-stage build for Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node dist/health-check.js || exit 1

EXPOSE 3000 8080 9090

CMD ["node", "dist/index.js"]
```

### Dockerfile for Ruby Application

```dockerfile
# Multi-stage build for Ruby
FROM ruby:3.2-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache \
    build-base \
    postgresql-dev \
    nodejs \
    yarn

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install -j4

# Production stage
FROM ruby:3.2-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    tzdata

# Copy installed gems from builder
COPY --from=builder /usr/local/bundle /usr/local/bundle

# Copy application code
COPY . .

# Precompile assets (if using Rails)
RUN RAILS_ENV=production bundle exec rake assets:precompile

# Create non-root user
RUN addgroup -g 1001 -S rails && \
    adduser -S rails -u 1001 && \
    chown -R rails:rails /app

USER rails

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bundle exec bin/health_check || exit 1

EXPOSE 3000

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

### Docker Compose for Development

```yaml
version: "3.8"

services:
  nats:
    image: nats:latest
    command:
      - "--jetstream"
      - "--store_dir=/data"
      - "--max_memory_store=1GB"
      - "--max_file_store=10GB"
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - nats-data:/data
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8222/healthz"]
      interval: 10s
      timeout: 5s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: orders_development
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  app:
    build: .
    depends_on:
      nats:
        condition: service_healthy
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NATS_URLS: nats://nats:4222
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/orders_development
      REDIS_URL: redis://redis:6379/0
      NODE_ENV: development
      APP_NAME: order-service
    ports:
      - "3000:3000"
      - "8080:8080"
      - "9090:9090"
    volumes:
      - ./src:/app/src
    command: npm run dev

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  nats-data:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
```

---

## Kubernetes Deployment

### NATS Deployment

```yaml
# kubernetes/nats/nats-statefulset.yaml
apiVersion: v1
kind: Service
metadata:
  name: nats
  labels:
    app: nats
spec:
  ports:
    - port: 4222
      name: client
    - port: 8222
      name: monitoring
    - port: 7422
      name: leafnodes
  clusterIP: None
  selector:
    app: nats
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nats
spec:
  serviceName: nats
  replicas: 3
  selector:
    matchLabels:
      app: nats
  template:
    metadata:
      labels:
        app: nats
    spec:
      containers:
        - name: nats
          image: nats:latest
          ports:
            - containerPort: 4222
              name: client
            - containerPort: 8222
              name: monitoring
            - containerPort: 7422
              name: leafnodes
          command:
            - nats-server
            - --config
            - /etc/nats-config/nats.conf
            - --jetstream
            - --store_dir=/data
          volumeMounts:
            - name: config
              mountPath: /etc/nats-config
            - name: data
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8222
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8222
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
      volumes:
        - name: config
          configMap:
            name: nats-config
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

### Application Deployment

```yaml
# kubernetes/app/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  labels:
    app: order-service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: order-service
      containers:
        - name: order-service
          image: your-registry/order-service:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
              name: http
            - containerPort: 8080
              name: health
            - containerPort: 9090
              name: metrics
          env:
            - name: NATS_URLS
              value: "nats://nats-0.nats:4222,nats://nats-1.nats:4222,nats://nats-2.nats:4222"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-secret
                  key: url
            - name: NODE_ENV
              value: "production"
            - name: APP_NAME
              value: "order-service"
            - name: CONCURRENCY
              value: "20"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          securityContext:
            runAsNonRoot: true
            runAsUser: 1001
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
---
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
  ports:
    - name: http
      port: 80
      targetPort: 3000
    - name: metrics
      port: 9090
      targetPort: 9090
  type: ClusterIP
```

### Horizontal Pod Autoscaler

```yaml
# kubernetes/app/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: nats_messages_processing_rate
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
        - type: Pods
          value: 2
          periodSeconds: 60
      selectPolicy: Max
```

---

## NATS Server Setup

### NATS Configuration

```conf
# nats.conf
# Server configuration
server_name: nats-1
listen: 0.0.0.0:4222
http: 0.0.0.0:8222

# JetStream configuration
jetstream {
  store_dir: /data
  max_memory_store: 1GB
  max_file_store: 10GB
}

# Clustering configuration
cluster {
  name: nats-cluster
  listen: 0.0.0.0:6222

  routes: [
    nats://nats-0.nats:6222
    nats://nats-1.nats:6222
    nats://nats-2.nats:6222
  ]
}

# Authentication
authorization {
  users = [
    {
      user: "nats_user"
      password: "$2a$11$..."  # Bcrypt hash
      permissions {
        publish = ">"
        subscribe = ">"
      }
    }
  ]
}

# Limits
max_connections: 10000
max_payload: 1MB
max_pending: 64MB

# Logging
debug: false
trace: false
logtime: true
```

### NATS Helm Chart

```bash
# Install NATS with Helm
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update

helm install nats nats/nats \
  --namespace nats \
  --create-namespace \
  --set nats.jetstream.enabled=true \
  --set nats.jetstream.memStorage.enabled=true \
  --set nats.jetstream.memStorage.size=1Gi \
  --set nats.jetstream.fileStorage.enabled=true \
  --set nats.jetstream.fileStorage.size=10Gi \
  --set cluster.enabled=true \
  --set cluster.replicas=3
```

---

## Database Setup

### PostgreSQL for Outbox/Inbox

```sql
-- Schema for Outbox pattern
CREATE TABLE IF NOT EXISTS nats_pubsub_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  max_retries INTEGER DEFAULT 3 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  published_at TIMESTAMP,
  error TEXT,
  INDEX idx_outbox_status_created (status, created_at)
);

-- Schema for Inbox pattern
CREATE TABLE IF NOT EXISTS nats_pubsub_inbox (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  INDEX idx_inbox_event_id (event_id),
  INDEX idx_inbox_status (status)
);
```

### Database Migration (JavaScript)

```typescript
// migrations/001_create_nats_tables.ts
import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("nats_pubsub_outbox", (table) => {
    table.bigIncrements("id").primary();
    table.string("event_id", 255).unique().notNullable();
    table.string("subject", 255).notNullable();
    table.jsonb("payload").notNullable();
    table.jsonb("headers");
    table.string("status", 50).defaultTo("pending").notNullable();
    table.integer("retry_count").defaultTo(0).notNullable();
    table.integer("max_retries").defaultTo(3).notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
    table.timestamp("published_at");
    table.text("error");

    table.index(["status", "created_at"], "idx_outbox_status_created");
  });

  await knex.schema.createTable("nats_pubsub_inbox", (table) => {
    table.bigIncrements("id").primary();
    table.string("event_id", 255).unique().notNullable();
    table.string("subject", 255).notNullable();
    table.jsonb("payload").notNullable();
    table.string("status", 50).defaultTo("pending").notNullable();
    table.timestamp("processed_at");
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();

    table.index("event_id", "idx_inbox_event_id");
    table.index("status", "idx_inbox_status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("nats_pubsub_inbox");
  await knex.schema.dropTableIfExists("nats_pubsub_outbox");
}
```

---

## Monitoring and Observability

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # NATS monitoring
  - job_name: "nats"
    static_configs:
      - targets: ["nats-0.nats:8222", "nats-1.nats:8222", "nats-2.nats:8222"]

  # Application metrics
  - job_name: "order-service"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels:
          [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "NatsPubsub Monitoring",
    "panels": [
      {
        "title": "Message Processing Rate",
        "targets": [
          {
            "expr": "rate(nats_messages_processed_total[5m])"
          }
        ]
      },
      {
        "title": "Processing Duration (p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(nats_message_processing_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(nats_messages_processed_total{status=\"failure\"}[5m])"
          }
        ]
      },
      {
        "title": "DLQ Messages",
        "targets": [
          {
            "expr": "nats_dlq_messages_total"
          }
        ]
      }
    ]
  }
}
```

---

## Health Checks

### JavaScript/TypeScript

```typescript
// src/health-check.ts
import express from "express";
import NatsPubsub from "nats-pubsub";
import { Pool } from "pg";

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Liveness probe - is the app running?
app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness probe - is the app ready to serve traffic?
app.get("/health/ready", async (req, res) => {
  const checks = {
    nats: false,
    database: false,
  };

  try {
    // Check NATS connection
    checks.nats = await NatsPubsub.isConnected();

    // Check database connection
    const dbResult = await pool.query("SELECT 1");
    checks.database = dbResult.rowCount === 1;

    const allHealthy = Object.values(checks).every((status) => status);

    if (allHealthy) {
      res.status(200).json({ status: "ready", checks });
    } else {
      res.status(503).json({ status: "not_ready", checks });
    }
  } catch (error) {
    res.status(503).json({
      status: "error",
      checks,
      error: error.message,
    });
  }
});

const PORT = process.env.HEALTH_CHECK_PORT || 8080;
app.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});
```

### Ruby

```ruby
# lib/health_check.rb
class HealthCheck
  def self.live
    { status: 'ok', timestamp: Time.now.iso8601 }
  end

  def self.ready
    checks = {
      nats: check_nats,
      database: check_database,
      redis: check_redis
    }

    all_healthy = checks.values.all?

    {
      status: all_healthy ? 'ready' : 'not_ready',
      checks: checks,
      timestamp: Time.now.iso8601
    }
  end

  private

  def self.check_nats
    NatsPubsub::Connection.connected?
  rescue StandardError
    false
  end

  def self.check_database
    ActiveRecord::Base.connection.active?
  rescue StandardError
    false
  end

  def self.check_redis
    Redis.current.ping == 'PONG'
  rescue StandardError
    false
  end
end

# config/routes.rb
Rails.application.routes.draw do
  get '/health/live', to: ->(env) {
    [200, { 'Content-Type' => 'application/json' }, [HealthCheck.live.to_json]]
  }

  get '/health/ready', to: ->(env) {
    result = HealthCheck.ready
    status = result[:status] == 'ready' ? 200 : 503
    [status, { 'Content-Type' => 'application/json' }, [result.to_json]]
  }
end
```

---

## Scaling Strategies

### Horizontal Scaling

```yaml
# Scale based on CPU and custom metrics
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: nats_consumer_lag
        target:
          type: AverageValue
          averageValue: "100"
```

### Vertical Scaling

```bash
# Update resource limits
kubectl set resources deployment order-service \
  --limits=cpu=2,memory=2Gi \
  --requests=cpu=1,memory=1Gi
```

---

## High Availability

### Multi-Region Deployment

```mermaid
graph TB
    subgraph "Region 1"
        R1A[App Instance 1]
        R1B[App Instance 2]
        R1N[NATS Cluster 1]
        R1D[(Database 1)]
    end

    subgraph "Region 2"
        R2A[App Instance 1]
        R2B[App Instance 2]
        R2N[NATS Cluster 2]
        R2D[(Database 2)]
    end

    R1A --> R1N
    R1B --> R1N
    R2A --> R2N
    R2B --> R2N

    R1N -.Leaf Node Connection.-> R2N
    R1D -.Replication.-> R2D

    LB[Load Balancer] --> R1A
    LB --> R1B
    LB --> R2A
    LB --> R2B
```

---

## Security

### TLS Configuration

```typescript
// Enable TLS for NATS connections
NatsPubsub.configure({
  natsUrls: ["nats://nats-1:4222", "nats://nats-2:4222"],
  tls: {
    caFile: "/etc/ssl/certs/ca.pem",
    certFile: "/etc/ssl/certs/client-cert.pem",
    keyFile: "/etc/ssl/private/client-key.pem",
  },
});
```

### Network Policies (Kubernetes)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-network-policy
spec:
  podSelector:
    matchLabels:
      app: order-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: nats
      ports:
        - protocol: TCP
          port: 4222
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
```

---

## Production Checklist

### Pre-Deployment

- [ ] Configure environment variables
- [ ] Set up TLS for NATS connections
- [ ] Enable authentication on NATS server
- [ ] Set up database with Outbox/Inbox tables
- [ ] Configure monitoring and alerting
- [ ] Set up log aggregation
- [ ] Configure health checks
- [ ] Review and tune concurrency settings
- [ ] Set up backup and disaster recovery
- [ ] Configure security policies

### Deployment

- [ ] Deploy NATS cluster
- [ ] Deploy database
- [ ] Run database migrations
- [ ] Deploy application
- [ ] Verify health checks passing
- [ ] Smoke test critical flows
- [ ] Monitor error rates and latency
- [ ] Verify metrics collection
- [ ] Test failover scenarios

### Post-Deployment

- [ ] Monitor application metrics
- [ ] Monitor NATS server metrics
- [ ] Monitor database performance
- [ ] Set up alerts for anomalies
- [ ] Document runbooks
- [ ] Schedule regular backups
- [ ] Plan capacity scaling

---

## Troubleshooting

### Connection Issues

```bash
# Check NATS server status
kubectl get pods -l app=nats
kubectl logs nats-0

# Test NATS connection
nats-cli server check --server=nats://nats:4222
```

### Performance Issues

```bash
# Check consumer lag
kubectl exec -it order-service-pod -- \
  node -e "console.log(await NatsPubsub.getConsumerLag())"

# Check resource usage
kubectl top pods -l app=order-service
```

### Debugging

```bash
# View logs
kubectl logs -f deployment/order-service

# Access pod
kubectl exec -it order-service-pod -- /bin/sh

# Check environment variables
kubectl exec -it order-service-pod -- env | grep NATS
```

---

## Navigation

- **Previous**: [Testing Strategies](./testing.md)
- **Next**: [Performance Guide](./performance.md)
- **Related**:
  - [Configuration Reference](../reference/configuration.md)
  - [Monitoring Guide](../advanced/monitoring.md)
  - [Security Best Practices](../advanced/security.md)
