# Express.js Integration Guide

This comprehensive guide covers integrating NatsPubsub into your Express.js application, from basic setup through production deployment with TypeScript support.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Configuration](#configuration)
- [Middleware Integration](#middleware-integration)
  - [Request Context](#request-context)
  - [Trace ID Propagation](#trace-id-propagation)
  - [Error Handling](#error-handling)
- [Publishing from Routes](#publishing-from-routes)
  - [REST Endpoints](#rest-endpoints)
  - [API Routes](#api-routes)
  - [Error Responses](#error-responses)
- [Subscriber Management](#subscriber-management)
  - [Creating Subscribers](#creating-subscribers)
  - [Auto-Loading Subscribers](#auto-loading-subscribers)
  - [Lifecycle Management](#lifecycle-management)
- [Database Integration](#database-integration)
  - [With Knex.js](#with-knexjs)
  - [With TypeORM](#with-typeorm)
  - [With Prisma](#with-prisma)
- [Authentication & Authorization](#authentication--authorization)
  - [JWT Integration](#jwt-integration)
  - [Session-Based Auth](#session-based-auth)
  - [API Key Auth](#api-key-auth)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [Integration Tests](#integration-tests)
  - [E2E Tests](#e2e-tests)
- [Production Setup](#production-setup)
  - [Environment Configuration](#environment-configuration)
  - [Process Management](#process-management)
  - [Health Checks](#health-checks)
  - [Monitoring](#monitoring)
- [Complete Example Application](#complete-example-application)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

NatsPubsub integrates seamlessly with Express.js to provide:

- **Event-Driven Architecture**: Decouple services with pub/sub messaging
- **Middleware Support**: Integrate with Express middleware chain
- **TypeScript First**: Full type safety and IntelliSense
- **RESTful Integration**: Publish events from API endpoints
- **Background Processing**: Handle events asynchronously
- **Health Monitoring**: Built-in health check endpoints

### Architecture

```mermaid
graph TB
    subgraph "Express Application"
        Client[HTTP Client]
        Middleware[Express Middleware]
        Routes[API Routes]
        Services[Business Services]

        Client --> Middleware
        Middleware --> Routes
        Routes --> Services
        Services --> Publisher[NatsPubsub Publisher]
    end

    subgraph "Message Bus"
        Publisher --> NATS[NATS JetStream]
    end

    subgraph "Subscriber Process"
        NATS --> Subscribers[NatsPubsub Subscribers]
        Subscribers --> Handlers[Event Handlers]
        Handlers --> DB[Database]
        Handlers --> External[External APIs]
    end
```

---

## Prerequisites

Before integrating NatsPubsub with Express:

- **Node.js**: 20 or higher
- **TypeScript**: 5.0+ (recommended)
- **Express**: 4.18+
- **NATS Server**: With JetStream enabled
- **Database** (optional): PostgreSQL/MySQL for Inbox/Outbox

---

## Installation

### Step 1: Install Dependencies

```bash
npm install nats-pubsub express
# or
pnpm add nats-pubsub express
# or
yarn add nats-pubsub express
```

### Step 2: Install Dev Dependencies (TypeScript)

```bash
npm install -D typescript @types/node @types/express ts-node nodemon
```

### Step 3: Initialize TypeScript

```bash
npx tsc --init
```

Configure `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 4: Project Structure

```
my-express-app/
├── src/
│   ├── index.ts              # Application entry point
│   ├── app.ts                # Express app setup
│   ├── config/
│   │   ├── nats.ts           # NatsPubsub configuration
│   │   └── database.ts       # Database configuration
│   ├── routes/
│   │   ├── users.ts
│   │   ├── orders.ts
│   │   └── health.ts
│   ├── subscribers/
│   │   ├── user.subscriber.ts
│   │   └── order.subscriber.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   └── order.service.ts
│   ├── middleware/
│   │   ├── trace-id.ts
│   │   └── error-handler.ts
│   └── types/
│       └── index.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## Basic Setup

### Application Entry Point

```typescript
// src/index.ts
import app from "./app";
import NatsPubsub from "nats-pubsub";
import { loadSubscribers } from "./subscribers";

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Configure NatsPubsub
    NatsPubsub.configure({
      natsUrls: process.env.NATS_URLS || "nats://localhost:4222",
      env: process.env.NODE_ENV || "development",
      appName: process.env.APP_NAME || "express-app",
      concurrency: 10,
      maxDeliver: 5,
      useDlq: true,
    });

    // Load subscribers
    await loadSubscribers();

    // Start subscriber process (in separate process in production)
    if (process.env.SUBSCRIBER_PROCESS === "true") {
      await NatsPubsub.start();
      console.log("Subscriber process started");
    } else {
      // Start HTTP server
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await NatsPubsub.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await NatsPubsub.stop();
  process.exit(0);
});

start();
```

### Express App Setup

```typescript
// src/app.ts
import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { traceIdMiddleware } from "./middleware/trace-id";
import { errorHandler } from "./middleware/error-handler";
import userRoutes from "./routes/users";
import orderRoutes from "./routes/orders";
import healthRoutes from "./routes/health";

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Trace ID middleware
app.use(traceIdMiddleware);

// Routes
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/health", healthRoutes);

// Error handling (must be last)
app.use(errorHandler);

export default app;
```

---

## Configuration

### Environment Variables

```bash
# .env
NODE_ENV=development
PORT=3000
APP_NAME=express-app

# NATS Configuration
NATS_URLS=nats://localhost:4222
NATS_USER=
NATS_PASSWORD=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# Features
CONCURRENCY=10
USE_INBOX=false
USE_OUTBOX=false
USE_DLQ=true

# Logging
LOG_LEVEL=info
```

### NatsPubsub Configuration

```typescript
// src/config/nats.ts
import NatsPubsub from "nats-pubsub";

export function configureNatsPubsub() {
  NatsPubsub.configure({
    natsUrls: process.env.NATS_URLS || "nats://localhost:4222",
    env: process.env.NODE_ENV || "development",
    appName: process.env.APP_NAME || "express-app",

    // Consumer settings
    concurrency: parseInt(process.env.CONCURRENCY || "10"),
    maxDeliver: 5,
    ackWait: 30000, // 30 seconds
    backoff: [1000, 5000, 15000, 30000, 60000],

    // Features
    useDlq: process.env.USE_DLQ === "true",
    useInbox: process.env.USE_INBOX === "true",
    useOutbox: process.env.USE_OUTBOX === "true",

    // Logging
    logger: {
      debug: (msg: string) => console.debug(`[NATS] ${msg}`),
      info: (msg: string) => console.info(`[NATS] ${msg}`),
      warn: (msg: string) => console.warn(`[NATS] ${msg}`),
      error: (msg: string) => console.error(`[NATS] ${msg}`),
    },
  });
}
```

### Advanced Configuration

```typescript
// src/config/nats.ts
import NatsPubsub from "nats-pubsub";
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/nats.log" }),
  ],
});

export function configureNatsPubsub() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  NatsPubsub.configure({
    natsUrls: process.env.NATS_URLS || "nats://localhost:4222",
    env: process.env.NODE_ENV || "development",
    appName: process.env.APP_NAME || "express-app",

    // Authentication (if NATS has auth enabled)
    ...(process.env.NATS_USER && {
      user: process.env.NATS_USER,
      password: process.env.NATS_PASSWORD,
    }),

    // TLS Configuration for production
    ...(isProduction && {
      tls: {
        caFile: "./certs/ca.pem",
        certFile: "./certs/client-cert.pem",
        keyFile: "./certs/client-key.pem",
      },
    }),

    // Consumer settings
    concurrency: isProduction ? 20 : isDevelopment ? 2 : 10,
    maxDeliver: 5,
    ackWait: 30000,
    backoff: [1000, 5000, 15000, 30000, 60000],

    // Features
    useDlq: true,
    useInbox: isProduction,
    useOutbox: isProduction,

    // Stream configuration
    streamConfig: {
      maxMsgs: 1_000_000,
      maxBytes: 10 * 1024 * 1024 * 1024, // 10GB
      maxAge: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days
      storage: "file",
      replicas: isProduction ? 3 : 1,
    },

    // Custom logger
    logger: {
      debug: (msg) => logger.debug(msg),
      info: (msg) => logger.info(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg),
    },
  });
}
```

---

## Middleware Integration

### Request Context

```typescript
// src/middleware/trace-id.ts
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export function traceIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Get trace ID from header or generate new one
  req.traceId = (req.headers["x-trace-id"] as string) || uuidv4();

  // Add to response headers
  res.setHeader("X-Trace-ID", req.traceId);

  next();
}
```

### Trace ID Propagation

```typescript
// src/routes/users.ts
import { Router } from "express";
import NatsPubsub from "nats-pubsub";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { email, name } = req.body;

    // Create user
    const user = await createUser({ email, name });

    // Publish event with trace ID
    await NatsPubsub.publish(
      "user.created",
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      {
        trace_id: req.traceId, // Propagate trace ID
        occurred_at: new Date(),
      },
    );

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Error Handling

```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error with trace ID
  console.error({
    traceId: req.traceId,
    error: message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      traceId: req.traceId,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}
```

---

## Publishing from Routes

### REST Endpoints

```typescript
// src/routes/orders.ts
import { Router } from "express";
import NatsPubsub from "nats-pubsub";
import { OrderService } from "../services/order.service";

const router = Router();
const orderService = new OrderService();

// Create order
router.post("/", async (req, res, next) => {
  try {
    const orderData = req.body;

    // Create order
    const order = await orderService.create(orderData);

    // Publish event
    await NatsPubsub.publish(
      "order.created",
      {
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        items: order.items,
      },
      {
        trace_id: req.traceId,
        event_id: `order-${order.id}-created`,
      },
    );

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

// Update order
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const order = await orderService.update(id, updates);

    // Publish update event
    await NatsPubsub.publish(
      "order.updated",
      {
        orderId: order.id,
        changes: updates,
        status: order.status,
      },
      {
        trace_id: req.traceId,
      },
    );

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Cancel order
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    await orderService.cancel(id);

    // Publish cancellation event
    await NatsPubsub.publish(
      "order.cancelled",
      {
        orderId: id,
        cancelledAt: new Date(),
      },
      {
        trace_id: req.traceId,
      },
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
```

### API Routes

```typescript
// src/routes/users.ts
import { Router, Request, Response, NextFunction } from "express";
import NatsPubsub from "nats-pubsub";
import { UserService } from "../services/user.service";
import { body, validationResult } from "express-validator";

const router = Router();
const userService = new UserService();

// Validation middleware
const createUserValidation = [
  body("email").isEmail().normalizeEmail(),
  body("name").trim().notEmpty(),
  body("password").isLength({ min: 8 }),
];

// Create user
router.post(
  "/",
  createUserValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, name, password } = req.body;

      // Create user
      const user = await userService.create({ email, name, password });

      // Publish user.created event
      await NatsPubsub.publish(
        "user.created",
        {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        {
          trace_id: req.traceId,
          event_id: `user-${user.id}-created`,
          occurred_at: new Date(),
        },
      );

      // Publish to multiple topics (fan-out)
      await NatsPubsub.publish({
        topics: ["user.created", "notification.email", "analytics.user_signup"],
        message: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
        metadata: {
          trace_id: req.traceId,
        },
      });

      res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update user
router.patch(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const user = await userService.update(id, updates);

      // Publish update event
      await NatsPubsub.publish(
        "user.updated",
        {
          id: user.id,
          changes: updates,
        },
        {
          trace_id: req.traceId,
        },
      );

      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);

// Login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const { user, token } = await userService.login(email, password);

      // Publish login event
      await NatsPubsub.publish(
        "user.logged_in",
        {
          userId: user.id,
          email: user.email,
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
        {
          trace_id: req.traceId,
        },
      );

      res.json({ token, user });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
```

### Error Responses

```typescript
// src/services/order.service.ts
import NatsPubsub from "nats-pubsub";

export class OrderService {
  async create(orderData: CreateOrderDto): Promise<Order> {
    try {
      // Validate order
      if (!orderData.items || orderData.items.length === 0) {
        throw new ValidationError("Order must have at least one item");
      }

      // Create order in database
      const order = await db.orders.create(orderData);

      // Publish success event
      await NatsPubsub.publish("order.created", {
        orderId: order.id,
        userId: order.userId,
        total: order.total,
      });

      return order;
    } catch (error) {
      // Publish failure event
      await NatsPubsub.publish("order.creation_failed", {
        userId: orderData.userId,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  async processPayment(
    orderId: string,
    paymentData: PaymentDto,
  ): Promise<void> {
    try {
      const order = await this.findById(orderId);

      // Process payment
      const result = await paymentGateway.charge(paymentData);

      if (result.success) {
        await db.orders.update(orderId, { status: "paid" });

        // Publish success event
        await NatsPubsub.publish("order.payment_completed", {
          orderId,
          transactionId: result.transactionId,
          amount: paymentData.amount,
        });
      } else {
        // Publish failure event
        await NatsPubsub.publish("order.payment_failed", {
          orderId,
          reason: result.errorMessage,
        });

        throw new PaymentError(result.errorMessage);
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      throw error;
    }
  }
}
```

---

## Subscriber Management

### Creating Subscribers

```typescript
// src/subscribers/user.subscriber.ts
import { Subscriber, EventMetadata } from "nats-pubsub";
import { UserService } from "../services/user.service";

interface UserCreatedMessage {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export class UserCreatedSubscriber extends Subscriber {
  constructor() {
    super("development.express-app.user.created");
  }

  async call(
    message: Record<string, unknown>,
    metadata: EventMetadata,
  ): Promise<void> {
    const data = message as UserCreatedMessage;

    console.log(`Processing user.created: ${data.id}`);

    try {
      // Send welcome email
      await this.sendWelcomeEmail(data.email, data.name);

      // Update analytics
      await this.trackUserSignup(data.id);

      console.log(`Processed user.created: ${data.id}`);
    } catch (error) {
      console.error("Error processing user.created:", error);
      throw error; // Will retry with backoff
    }
  }

  private async sendWelcomeEmail(email: string, name: string): Promise<void> {
    // Send welcome email via email service
    await emailService.send({
      to: email,
      subject: "Welcome!",
      template: "welcome",
      data: { name },
    });
  }

  private async trackUserSignup(userId: string): Promise<void> {
    // Track signup in analytics
    await analytics.track({
      userId,
      event: "User Signed Up",
      timestamp: new Date(),
    });
  }
}
```

### Auto-Loading Subscribers

```typescript
// src/subscribers/index.ts
import path from "path";
import { readdirSync } from "fs";
import NatsPubsub from "nats-pubsub";

export async function loadSubscribers() {
  const subscribersDir = path.join(__dirname);
  const files = readdirSync(subscribersDir).filter(
    (file) =>
      file.endsWith(".subscriber.ts") || file.endsWith(".subscriber.js"),
  );

  console.log(`Loading ${files.length} subscribers...`);

  for (const file of files) {
    const modulePath = path.join(subscribersDir, file);
    const module = await import(modulePath);

    // Get the default export or first class export
    const SubscriberClass =
      module.default ||
      Object.values(module).find((exp) => typeof exp === "function");

    if (SubscriberClass && typeof SubscriberClass === "function") {
      const instance = new (SubscriberClass as any)();
      NatsPubsub.registerSubscriber(instance);
      console.log(`Registered subscriber: ${SubscriberClass.name}`);
    }
  }

  console.log("All subscribers loaded");
}
```

### Lifecycle Management

```typescript
// src/subscribers/lifecycle.ts
import NatsPubsub from "nats-pubsub";
import { loadSubscribers } from "./index";

export class SubscriberManager {
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Subscribers already running");
    }

    console.log("Starting subscribers...");

    // Load all subscribers
    await loadSubscribers();

    // Start processing
    await NatsPubsub.start();

    this.isRunning = true;
    console.log("Subscribers started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log("Stopping subscribers...");

    await NatsPubsub.stop();

    this.isRunning = false;
    console.log("Subscribers stopped successfully");
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  isHealthy(): boolean {
    return this.isRunning && NatsPubsub.isConnected();
  }
}

// Singleton instance
export const subscriberManager = new SubscriberManager();
```

---

## Database Integration

### With Knex.js

```typescript
// src/config/database.ts
import knex, { Knex } from "knex";

const config: Knex.Config = {
  client: "postgresql",
  connection: process.env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: "./migrations",
  },
};

export const db = knex(config);

// src/services/order.service.ts
import { db } from "../config/database";
import NatsPubsub from "nats-pubsub";

export class OrderService {
  async create(orderData: CreateOrderDto): Promise<Order> {
    // Use transaction for atomicity
    return await db.transaction(async (trx) => {
      // Create order
      const [order] = await trx("orders")
        .insert({
          user_id: orderData.userId,
          total: orderData.total,
          status: "pending",
        })
        .returning("*");

      // Insert order items
      await trx("order_items").insert(
        orderData.items.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      );

      // Publish event (with outbox, this is transactional)
      await NatsPubsub.publish(
        "order.created",
        {
          orderId: order.id,
          userId: order.user_id,
          total: order.total,
        },
        {
          event_id: `order-${order.id}-created`,
        },
      );

      return order;
    });
  }
}
```

### With TypeORM

```typescript
// src/config/database.ts
import { DataSource } from "typeorm";
import { Order } from "../entities/Order";
import { User } from "../entities/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === "development",
  logging: process.env.NODE_ENV === "development",
  entities: [Order, User],
  migrations: ["src/migrations/*.ts"],
});

// src/entities/Order.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column("decimal")
  total: number;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}

// src/services/order.service.ts
import { AppDataSource } from "../config/database";
import { Order } from "../entities/Order";
import NatsPubsub from "nats-pubsub";

export class OrderService {
  private orderRepository = AppDataSource.getRepository(Order);

  async create(orderData: CreateOrderDto): Promise<Order> {
    return await AppDataSource.transaction(async (manager) => {
      // Create order
      const order = manager.create(Order, {
        userId: orderData.userId,
        total: orderData.total,
        status: "pending",
      });

      await manager.save(order);

      // Publish event
      await NatsPubsub.publish(
        "order.created",
        {
          orderId: order.id,
          userId: order.userId,
          total: order.total,
        },
        {
          event_id: `order-${order.id}-created`,
        },
      );

      return order;
    });
  }
}
```

### With Prisma

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Order {
  id        String   @id @default(uuid())
  userId    String
  total     Decimal
  status    String
  createdAt DateTime @default(now())
  items     OrderItem[]

  @@map("orders")
}

model OrderItem {
  id        String @id @default(uuid())
  orderId   String
  productId String
  quantity  Int
  price     Decimal
  order     Order  @relation(fields: [orderId], references: [id])

  @@map("order_items")
}

// src/config/database.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// src/services/order.service.ts
import { prisma } from '../config/database';
import NatsPubsub from 'nats-pubsub';

export class OrderService {
  async create(orderData: CreateOrderDto): Promise<Order> {
    return await prisma.$transaction(async (tx) => {
      // Create order with items
      const order = await tx.order.create({
        data: {
          userId: orderData.userId,
          total: orderData.total,
          status: 'pending',
          items: {
            create: orderData.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Publish event
      await NatsPubsub.publish(
        'order.created',
        {
          orderId: order.id,
          userId: order.userId,
          total: order.total.toNumber(),
        },
        {
          event_id: `order-${order.id}-created`,
        }
      );

      return order;
    });
  }
}
```

---

## Authentication & Authorization

### JWT Integration

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// src/routes/orders.ts
import { authenticateJWT } from "../middleware/auth";

router.post("/", authenticateJWT, async (req, res, next) => {
  try {
    const order = await orderService.create({
      ...req.body,
      userId: req.user!.userId, // Use authenticated user ID
    });

    await NatsPubsub.publish(
      "order.created",
      {
        orderId: order.id,
        userId: req.user!.userId,
        userEmail: req.user!.email,
        total: order.total,
      },
      {
        trace_id: req.traceId,
      },
    );

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});
```

### Session-Based Auth

```typescript
// src/middleware/session.ts
import session from "express-session";
import connectRedis from "connect-redis";
import Redis from "ioredis";

const RedisStore = connectRedis(session);
const redisClient = new Redis(process.env.REDIS_URL);

export const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  },
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}
```

### API Key Auth

```typescript
// src/middleware/api-key.ts
import { Request, Response, NextFunction } from "express";

export function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  // Validate API key (check against database)
  const isValid = validateApiKey(apiKey);

  if (!isValid) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  // Check against database
  const key = await db("api_keys").where({ key: apiKey, active: true }).first();
  return !!key;
}
```

---

## Testing

### Unit Tests

```typescript
// src/services/__tests__/order.service.spec.ts
import { OrderService } from "../order.service";
import NatsPubsub from "nats-pubsub";

// Mock NatsPubsub
jest.mock("nats-pubsub");

describe("OrderService", () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create order and publish event", async () => {
      const orderData = {
        userId: "user-123",
        total: 99.99,
        items: [{ productId: "prod-1", quantity: 2, price: 49.99 }],
      };

      const order = await orderService.create(orderData);

      expect(order).toMatchObject({
        userId: "user-123",
        total: 99.99,
        status: "pending",
      });

      expect(NatsPubsub.publish).toHaveBeenCalledWith(
        "order.created",
        expect.objectContaining({
          orderId: order.id,
          userId: "user-123",
          total: 99.99,
        }),
        expect.objectContaining({
          event_id: `order-${order.id}-created`,
        }),
      );
    });
  });
});
```

### Integration Tests

```typescript
// src/routes/__tests__/orders.integration.spec.ts
import request from "supertest";
import app from "../../app";
import NatsPubsub from "nats-pubsub";
import { db } from "../../config/database";

describe("POST /api/orders", () => {
  beforeEach(async () => {
    await db("orders").truncate();
    jest.clearAllMocks();
  });

  it("should create order and publish event", async () => {
    const orderData = {
      userId: "user-123",
      items: [{ productId: "prod-1", quantity: 2, price: 49.99 }],
    };

    const response = await request(app)
      .post("/api/orders")
      .send(orderData)
      .expect(201);

    expect(response.body).toMatchObject({
      userId: "user-123",
      status: "pending",
    });

    expect(NatsPubsub.publish).toHaveBeenCalledWith(
      "order.created",
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("should return 400 for invalid data", async () => {
    const invalidData = {
      userId: "user-123",
      items: [], // Empty items
    };

    const response = await request(app)
      .post("/api/orders")
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(NatsPubsub.publish).not.toHaveBeenCalled();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/order-workflow.spec.ts
import request from "supertest";
import app from "../../src/app";
import NatsPubsub from "nats-pubsub";

describe("Order Workflow E2E", () => {
  beforeAll(async () => {
    // Start subscriber process
    await NatsPubsub.start();
  });

  afterAll(async () => {
    await NatsPubsub.stop();
  });

  it("should complete full order workflow", async () => {
    // 1. Create user
    const userResponse = await request(app)
      .post("/api/users")
      .send({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      })
      .expect(201);

    const userId = userResponse.body.id;

    // 2. Create order
    const orderResponse = await request(app)
      .post("/api/orders")
      .send({
        userId,
        items: [{ productId: "prod-1", quantity: 2, price: 49.99 }],
      })
      .expect(201);

    const orderId = orderResponse.body.id;

    // 3. Wait for event processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Verify order was processed
    const order = await db("orders").where({ id: orderId }).first();
    expect(order.status).toBe("processing");

    // 5. Process payment
    await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .send({
        amount: 99.98,
        cardNumber: "4242424242424242",
      })
      .expect(200);

    // 6. Verify final state
    const finalOrder = await db("orders").where({ id: orderId }).first();
    expect(finalOrder.status).toBe("paid");
  });
});
```

---

## Production Setup

### Environment Configuration

```bash
# .env.production
NODE_ENV=production
PORT=3000
APP_NAME=express-app

# NATS Configuration
NATS_URLS=nats://nats1.example.com:4222,nats://nats2.example.com:4222,nats://nats3.example.com:4222
NATS_USER=app_user
NATS_PASSWORD=secure_password

# Database
DATABASE_URL=postgresql://user:password@db.example.com:5432/myapp?ssl=true

# Features
CONCURRENCY=20
USE_INBOX=true
USE_OUTBOX=true
USE_DLQ=true

# Security
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://...
```

### Process Management

#### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "express-api",
      script: "./dist/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        SUBSCRIBER_PROCESS: "false",
      },
    },
    {
      name: "nats-subscribers",
      script: "./dist/index.js",
      instances: 2,
      env: {
        NODE_ENV: "production",
        SUBSCRIBER_PROCESS: "true",
      },
    },
  ],
};
```

Start with PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SUBSCRIBER_PROCESS=false
      - NATS_URLS=nats://nats:4222
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
    depends_on:
      - nats
      - db

  subscribers:
    build: .
    environment:
      - NODE_ENV=production
      - SUBSCRIBER_PROCESS=true
      - NATS_URLS=nats://nats:4222
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
    depends_on:
      - nats
      - db
    deploy:
      replicas: 2

  nats:
    image: nats:latest
    command: -js
    ports:
      - "4222:4222"

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Health Checks

```typescript
// src/routes/health.ts
import { Router } from "express";
import NatsPubsub from "nats-pubsub";
import { db } from "../config/database";

const router = Router();

router.get("/", async (req, res) => {
  const checks = {
    nats: await checkNats(),
    database: await checkDatabase(),
  };

  const isHealthy = Object.values(checks).every(
    (check) => check.status === "ok",
  );

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks,
  });
});

async function checkNats() {
  try {
    const connected = NatsPubsub.isConnected();
    return {
      status: connected ? "ok" : "error",
      message: connected ? "Connected" : "Disconnected",
    };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

async function checkDatabase() {
  try {
    await db.raw("SELECT 1");
    return { status: "ok", message: "Connected" };
  } catch (error) {
    return { status: "error", message: error.message };
  }
}

export default router;
```

### Monitoring

```typescript
// src/middleware/metrics.ts
import { Request, Response, NextFunction } from "express";
import prometheus from "prom-client";

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestTotal = new prometheus.Counter({
  name: "http_request_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;

    httpRequestDuration
      .labels(
        req.method,
        req.route?.path || req.path,
        res.statusCode.toString(),
      )
      .observe(duration);
    httpRequestTotal
      .labels(
        req.method,
        req.route?.path || req.path,
        res.statusCode.toString(),
      )
      .inc();
  });

  next();
}

// Metrics endpoint
export function metricsEndpoint(req: Request, res: Response) {
  res.set("Content-Type", prometheus.register.contentType);
  res.end(prometheus.register.metrics());
}
```

---

## Complete Example Application

```typescript
// src/index.ts - Full Example
import express, { Application } from "express";
import NatsPubsub from "nats-pubsub";
import { loadSubscribers } from "./subscribers";

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.post("/api/orders", async (req, res) => {
  try {
    const { userId, items } = req.body;

    // Create order
    const order = await db("orders")
      .insert({
        user_id: userId,
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        status: "pending",
      })
      .returning("*");

    // Publish event
    await NatsPubsub.publish("order.created", {
      orderId: order[0].id,
      userId,
      items,
    });

    res.status(201).json(order[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start
async function start() {
  // Configure NatsPubsub
  NatsPubsub.configure({
    natsUrls: "nats://localhost:4222",
    env: "development",
    appName: "express-app",
  });

  // Load subscribers
  await loadSubscribers();

  if (process.env.SUBSCRIBER_PROCESS === "true") {
    // Start subscriber process
    await NatsPubsub.start();
    console.log("Subscribers started");
  } else {
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

start();
```

---

## Best Practices

1. **Separate API and Subscriber Processes**: Run web server and subscribers separately
2. **Use Trace IDs**: Propagate trace IDs for distributed tracing
3. **Implement Health Checks**: Monitor NATS and database connectivity
4. **Handle Errors Gracefully**: Distinguish retryable vs non-retryable errors
5. **Use Transactions**: Ensure atomicity when publishing with database changes
6. **Monitor Metrics**: Track request duration, error rates, and event processing
7. **Test Thoroughly**: Unit, integration, and E2E tests
8. **Scale Horizontally**: Run multiple subscriber instances for high throughput

---

## Troubleshooting

### Common Issues

**Issue**: Events not publishing

- **Solution**: Check NATS connection, verify subject pattern

**Issue**: Subscribers not processing

- **Solution**: Ensure subscriber process is running, check logs

**Issue**: Duplicate processing

- **Solution**: Enable Inbox pattern, use unique event IDs

**Issue**: High latency

- **Solution**: Increase concurrency, optimize subscriber logic

---

## Navigation

- **Previous**: [Rails Integration](./rails.md)
- **Next**: [NestJS Integration](./nestjs.md)
- **Related**:
  - [Publishing Guide](../guides/publishing.md)
  - [Subscribing Guide](../guides/subscribing.md)
  - [Testing Guide](../guides/testing.md)
