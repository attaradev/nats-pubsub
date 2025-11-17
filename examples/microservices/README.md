# NatsPubsub Microservices Example

This example demonstrates a complete microservices architecture using NatsPubsub for inter-service communication. It showcases real-world patterns including event-driven workflows, saga patterns, and polyglot microservices.

## Architecture

```
┌─────────────────┐
│   API Gateway   │
│   (Optional)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐  ┌▼──────────┐
│ Order  │  │ Inventory │
│Service │  │ Service   │
│(Node.js)◄──┤  (Ruby)   │
└───┬────┘  └───────────┘
    │
    │
┌───▼────┐
│ Email  │
│Service │
│(Node.js)
└────────┘

All services communicate via NATS JetStream
```

## Services

### 1. Order Service (Node.js/TypeScript)

Manages order lifecycle and orchestrates the order fulfillment saga.

**Responsibilities:**

- Create new orders
- Track order status
- Coordinate inventory reservation and payment
- Handle order cancellation

**Events Published:**

- `order.created` - When a new order is placed
- `order.inventory_reserved` - When inventory is successfully reserved
- `order.confirmed` - When payment is processed and order is confirmed
- `order.cancelled` - When order is cancelled

**Events Subscribed:**

- `inventory.reserved` - Notification of inventory reservation status
- `payment.processed` - Notification of payment processing status

**API Endpoints:**

- `POST /orders` - Create a new order
- `GET /orders/:orderId` - Get order details
- `GET /orders/user/:userId` - Get all orders for a user
- `GET /health` - Health check
- `GET /health/ready` - Readiness check

### 2. Inventory Service (Ruby)

Manages product inventory and reservations.

**Responsibilities:**

- Track product inventory levels
- Reserve inventory for orders
- Release reservations on order cancellation
- Manage product catalog

**Events Published:**

- `inventory.reserved` - Result of inventory reservation attempt

**Events Subscribed:**

- `order.created` - Trigger inventory reservation

**API Endpoints:**

- `POST /inventory` - Add a product
- `GET /inventory/:productId` - Get product inventory
- `GET /health` - Health check
- `GET /health/ready` - Readiness check

### 3. Email Service (Node.js/TypeScript)

Sends transactional emails for order notifications.

**Responsibilities:**

- Send order confirmation emails
- Send order status update emails
- Template management

**Events Published:**

- None

**Events Subscribed:**

- `order.confirmed` - Send order confirmation email

**API Endpoints:**

- `GET /health` - Health check
- `GET /health/ready` - Readiness check

## Event Flow: Order Placement

This example demonstrates a saga pattern for order processing:

```
1. Client → Order Service: POST /orders
   ↓
2. Order Service → NATS: order.created
   ↓
3. Inventory Service ← NATS: order.created
   ↓
4. Inventory Service → NATS: inventory.reserved (success/failure)
   ↓
5. Order Service ← NATS: inventory.reserved
   ↓
6. IF success:
     a. Order Service → Database: Update status to INVENTORY_RESERVED
     b. Order Service → NATS: order.inventory_reserved
     c. (Simulate payment processing)
     d. Order Service → Database: Update status to CONFIRMED
     e. Order Service → NATS: order.confirmed
     f. Email Service ← NATS: order.confirmed
     g. Email Service → SMTP: Send confirmation email
   ELSE:
     a. Order Service → Database: Update status to CANCELLED
     b. Order Service → NATS: order.cancelled
```

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Ruby 3.2+ (for local development)
- PostgreSQL 16+ (for local development)

## Getting Started

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository and navigate to this example:**

```bash
cd examples/microservices
```

2. **Start all services:**

```bash
docker-compose up -d
```

3. **Wait for services to be healthy:**

```bash
docker-compose ps
```

4. **Seed inventory with test products:**

```bash
curl -X POST http://localhost:3003/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod-001",
    "name": "Laptop",
    "quantity": 10,
    "price": 999.99
  }'

curl -X POST http://localhost:3003/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod-002",
    "name": "Mouse",
    "quantity": 50,
    "price": 29.99
  }'
```

5. **Create a test order:**

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "items": [
      {
        "productId": "prod-001",
        "productName": "Laptop",
        "quantity": 1,
        "price": 999.99
      },
      {
        "productId": "prod-002",
        "productName": "Mouse",
        "quantity": 2,
        "price": 29.99
      }
    ]
  }'
```

6. **Check the order status:**

```bash
# Use the orderId from the previous response
curl http://localhost:3001/orders/<orderId>
```

7. **View sent emails:**

Open http://localhost:8025 in your browser to see emails sent via Mailhog.

8. **View NATS monitoring:**

Open http://localhost:8222 in your browser to see NATS server statistics.

### Option 2: Local Development

Each service can be run independently for development:

#### Order Service

```bash
cd order-service
npm install
cp .env.example .env
# Edit .env with your local configuration
npm run dev
```

#### Email Service

```bash
cd email-service
npm install
cp .env.example .env
# Edit .env with your local configuration
npm run dev
```

#### Inventory Service

```bash
cd inventory-service
bundle install
cp .env.example .env
# Edit .env with your local configuration
bundle exec ruby app.rb
```

## Testing the Example

### 1. Test Successful Order Flow

```bash
# Create an order with available products
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "items": [
      {
        "productId": "prod-001",
        "productName": "Laptop",
        "quantity": 1,
        "price": 999.99
      }
    ]
  }'

# Expected: Order status should progress from PENDING → INVENTORY_RESERVED → CONFIRMED
# Check Mailhog at http://localhost:8025 for confirmation email
```

### 2. Test Insufficient Inventory

```bash
# Try to order more than available
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-789",
    "items": [
      {
        "productId": "prod-001",
        "productName": "Laptop",
        "quantity": 100,
        "price": 999.99
      }
    ]
  }'

# Expected: Order status should be CANCELLED
```

### 3. View Service Health

```bash
# Check all services
curl http://localhost:3001/health  # Order Service
curl http://localhost:3002/health  # Email Service
curl http://localhost:3003/health  # Inventory Service
```

### 4. View Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f order-service
docker-compose logs -f email-service
docker-compose logs -f inventory-service
```

## Key Features Demonstrated

### 1. Event-Driven Architecture

All services communicate asynchronously via NATS JetStream, enabling:

- Loose coupling between services
- Independent scaling
- Resilience to service failures

### 2. Saga Pattern

The order fulfillment process demonstrates a choreography-based saga:

- Each service reacts to events
- Compensating transactions on failure
- Eventual consistency

### 3. Polyglot Microservices

Services written in different languages communicate seamlessly:

- Order Service: Node.js/TypeScript
- Email Service: Node.js/TypeScript
- Inventory Service: Ruby

### 4. Reliability Patterns

- **At-least-once delivery** with JetStream
- **Automatic retries** with exponential backoff
- **Dead Letter Queue** for failed messages
- **Idempotency** via event IDs
- **Circuit breakers** for external dependencies

### 5. Observability

- Health check endpoints
- Structured logging
- Distributed tracing via trace_id
- NATS monitoring dashboard

## Production Considerations

### 1. Database Per Service

Each service has its own database, enforcing proper boundaries:

- `orders` database for Order Service
- `inventory` database for Inventory Service
- Email Service is stateless

### 2. Outbox Pattern (Optional)

For guaranteed event publishing, enable the outbox pattern:

```javascript
// In order-service/src/index.ts
NatsPubsub.configure({
  // ...existing config
  useOutbox: true, // Enable outbox pattern
});
```

### 3. Inbox Pattern (Optional)

For guaranteed idempotency, enable the inbox pattern:

```javascript
// In inventory-service
NatsPubsub.configure({
  // ...existing config
  useInbox: true, // Enable inbox pattern
});
```

### 4. API Gateway

In production, add an API Gateway (e.g., Kong, NGINX) to:

- Route external requests
- Handle authentication
- Rate limiting
- SSL termination

### 5. Service Discovery

For dynamic environments, integrate with service discovery:

- Consul
- Kubernetes DNS
- NATS Super Cluster

## Troubleshooting

### Services not starting

```bash
# Check service status
docker-compose ps

# Check logs for specific service
docker-compose logs <service-name>

# Restart a service
docker-compose restart <service-name>
```

### Database connection issues

```bash
# Ensure PostgreSQL is healthy
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Manually connect to database
docker-compose exec postgres psql -U postgres
```

### NATS connection issues

```bash
# Check NATS status
curl http://localhost:8222/healthz

# View NATS logs
docker-compose logs nats
```

### Messages not being processed

```bash
# Check NATS streams
docker-compose exec nats nats stream list

# Check consumers
docker-compose exec nats nats consumer list <stream-name>
```

## Clean Up

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: destroys data)
docker-compose down -v
```

## Next Steps

1. **Add Payment Service**: Implement a payment processing service
2. **Add Shipping Service**: Track order shipment and delivery
3. **Implement Compensation**: Handle rollback scenarios
4. **Add Monitoring**: Integrate Prometheus and Grafana
5. **Load Testing**: Use tools like k6 or Artillery
6. **Deploy to Kubernetes**: Create K8s manifests

## Related Examples

- [Full-Stack Example](../full-stack) - React + Express + Workers
- [JavaScript Examples](../javascript) - More JavaScript patterns
- [Ruby Examples](../ruby) - More Ruby patterns

## Learn More

- [NatsPubsub Documentation](../../README.md)
- [NATS JetStream Docs](https://docs.nats.io/nats-concepts/jetstream)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
