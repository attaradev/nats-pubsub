# NatsPubsub Full-Stack Example

A complete full-stack application demonstrating real-time features with NatsPubsub, featuring a React frontend, Express backend, and background workers.

## Architecture

```
┌─────────────────┐
│  React Frontend │
│  (Port 3000)    │
│  WebSocket/SSE  │
└────────┬────────┘
         │ HTTP API
    ┌────▼────┐
    │ Express │
    │ Backend │
    │(Port 4000)
    └────┬────┘
         │
    ┌────▼────┐         ┌──────────┐
    │  NATS   │◄────────┤ Workers  │
    │JetStream│         │ Pool     │
    └─────────┘         └──────────┘
         │
    ┌────▼────┐
    │   DB    │
    │PostgreSQL
    └─────────┘
```

## Project Structure

```
full-stack/
├── backend/           # Express API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── services/
│   │   └── subscribers/
│   ├── Dockerfile
│   └── package.json
│
├── worker/            # Background workers
│   ├── src/
│   │   ├── index.ts
│   │   └── jobs/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/          # React application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

## Features

This example demonstrates:

1. **Real-time Updates**: WebSocket/SSE for live data
2. **Background Jobs**: Async processing with workers
3. **Event Sourcing**: Track all state changes
4. **CQRS Pattern**: Separate read/write models
5. **Reliable Messaging**: At-least-once delivery
6. **Scalability**: Horizontal scaling of workers

## Coming Soon

The full implementation is being prepared. For now, check out:

- **Microservices Example**: Complete multi-service architecture at `/examples/microservices`
- **JavaScript Examples**: Basic patterns at `/examples/javascript`
- **Ruby Examples**: Ruby-specific patterns at `/examples/ruby`

## Quick Start

```bash
# Full-stack example is under development
# Try the microservices example instead:
cd ../microservices
docker-compose up -d
```

## Related Examples

- [Microservices Example](../microservices) - Multi-service architecture
- [JavaScript Examples](../javascript) - JavaScript-specific patterns
- [Ruby Examples](../ruby) - Ruby-specific patterns
