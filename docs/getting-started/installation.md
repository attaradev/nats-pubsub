# Installation

This guide covers installing NatsPubsub in JavaScript/TypeScript and Ruby projects.

## Prerequisites

### NATS Server

NatsPubsub requires a running NATS server with JetStream enabled.

#### Quick Start with Docker

```bash
# Run NATS with JetStream enabled
docker run -d \
  --name nats \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:latest \
  -js
```

#### Install Locally

**macOS:**

```bash
brew install nats-server
nats-server -js
```

**Linux:**

```bash
# Download and install
curl -sf https://binaries.nats.dev/nats-io/nats-server/v2@latest | sh
./nats-server -js
```

**Windows:**

```powershell
# Using Chocolatey
choco install nats-server
nats-server -js
```

#### Verify Installation

```bash
# Check NATS is running
curl http://localhost:8222/healthz

# Should return: ok
```

### System Requirements

**JavaScript/TypeScript:**

- Node.js >= 16.x
- npm >= 7.x or pnpm >= 8.x or yarn >= 1.22

**Ruby:**

- Ruby >= 2.7
- Bundler >= 2.0

**Optional (for Inbox/Outbox patterns):**

- PostgreSQL >= 12
- MySQL >= 8.0
- SQLite >= 3.35

## JavaScript/TypeScript Installation

### Using npm

```bash
npm install nats-pubsub
```

### Using pnpm

```bash
pnpm add nats-pubsub
```

### Using yarn

```bash
yarn add nats-pubsub
```

### Verify Installation

Create a test file:

```typescript
// test.ts
import NatsPubsub from "nats-pubsub";

NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "test-app",
});

await NatsPubsub.publish("test.message", { hello: "world" });
console.log("✓ NatsPubsub connected successfully");
```

Run it:

```bash
# TypeScript
npx tsx test.ts

# Or compile first
npx tsc test.ts
node test.js
```

### TypeScript Configuration

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2020"]
  }
}
```

### Framework-Specific Setup

#### Express.js

```bash
npm install express nats-pubsub
```

```typescript
import express from "express";
import NatsPubsub from "nats-pubsub";

const app = express();
app.use(express.json());

// Configure NatsPubsub
NatsPubsub.configure({
  natsUrls: "nats://localhost:4222",
  env: "development",
  appName: "my-app",
});

// Publish endpoint
app.post("/orders", async (req, res) => {
  await NatsPubsub.publish("order.created", req.body);
  res.json({ success: true });
});

app.listen(3000, async () => {
  await NatsPubsub.start(); // Start subscribers if any registered
  console.log("Server running on port 3000");
});
```

#### NestJS

```bash
npm install @nestjs/core nats-pubsub
```

See [NestJS Integration Guide](../integrations/nestjs.md) for details.

#### Next.js

```bash
npm install next nats-pubsub
```

Add to `next.config.js`:

```javascript
module.exports = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("nats-pubsub");
    }
    return config;
  },
};
```

## Ruby Installation

### Using Bundler (Recommended)

Add to your `Gemfile`:

```ruby
gem 'nats_pubsub'
```

Install:

```bash
bundle install
```

### Using gem

```bash
gem install nats_pubsub
```

### Verify Installation

Create a test file:

```ruby
# test.rb
require 'nats_pubsub'

NatsPubsub.configure do |config|
  config.nats_urls = 'nats://localhost:4222'
  config.env = 'development'
  config.app_name = 'test-app'
end

NatsPubsub.publish(
  topic: 'test.message',
  message: { hello: 'world' }
)
puts '✓ NatsPubsub connected successfully'
```

Run it:

```bash
ruby test.rb
```

### Rails Installation

#### 1. Add to Gemfile

```ruby
# Gemfile
gem 'nats_pubsub'

# Optional: For Inbox/Outbox patterns
gem 'pg'  # or 'mysql2' or 'sqlite3'
```

#### 2. Install

```bash
bundle install
```

#### 3. Run Generator

```bash
# Generate configuration and migrations
rails generate nats_pubsub:install

# This creates:
# - config/initializers/nats_pubsub.rb
# - db/migrate/..._create_nats_pubsub_outbox.rb
# - db/migrate/..._create_nats_pubsub_inbox.rb
```

#### 4. Configure

Edit `config/initializers/nats_pubsub.rb`:

```ruby
NatsPubsub.configure do |config|
  config.nats_urls = ENV.fetch('NATS_URL', 'nats://localhost:4222')
  config.env = Rails.env
  config.app_name = 'my-rails-app'

  # Enable auto-start in server processes
  config.auto_start = true

  # Enable Inbox/Outbox patterns
  config.use_inbox = true
  config.use_outbox = true
end
```

#### 5. Run Migrations

```bash
rails db:migrate
```

#### 6. Verify

```bash
# Start Rails console
rails console

# Test connection
NatsPubsub.publish('test.message', { hello: 'world' })
# => true
```

See [Rails Integration Guide](../integrations/rails.md) for more details.

### Sinatra Installation

```ruby
# Gemfile
gem 'sinatra'
gem 'nats_pubsub'
```

```ruby
# app.rb
require 'sinatra'
require 'nats_pubsub'

configure do
  NatsPubsub.configure do |config|
    config.nats_urls = 'nats://localhost:4222'
    config.env = ENV['RACK_ENV']
    config.app_name = 'my-sinatra-app'
  end

  NatsPubsub.start
end

post '/publish' do
  NatsPubsub.publish(
    topic: 'message.sent',
    message: params
  )
  { status: 'published' }.to_json
end
```

## Database Setup (for Inbox/Outbox)

### PostgreSQL

#### JavaScript

```bash
npm install pg
```

```typescript
import { PostgresOutboxRepository } from "nats-pubsub";

const repository = new PostgresOutboxRepository({
  host: "localhost",
  port: 5432,
  database: "myapp",
  user: "postgres",
  password: "password",
});

// Run migrations
await repository.migrate();
```

#### Ruby

```ruby
# Gemfile
gem 'pg'
```

```ruby
# config/database.yml (Rails)
default: &default
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>

development:
  <<: *default
  database: myapp_development
```

### MySQL

#### JavaScript

```bash
npm install mysql2
```

```typescript
import { MySQLOutboxRepository } from "nats-pubsub";

const repository = new MySQLOutboxRepository({
  host: "localhost",
  port: 3306,
  database: "myapp",
  user: "root",
  password: "password",
});
```

#### Ruby

```ruby
# Gemfile
gem 'mysql2'
```

### SQLite

#### JavaScript

```bash
npm install better-sqlite3
```

```typescript
import { SQLiteOutboxRepository } from "nats-pubsub";

const repository = new SQLiteOutboxRepository({
  filename: "./myapp.db",
});
```

#### Ruby

```ruby
# Gemfile
gem 'sqlite3'
```

### Run Migrations

#### JavaScript

```bash
# Using CLI
npx nats-pubsub migrate

# Or programmatically
import { migrate } from 'nats-pubsub/migrations';
await migrate(repository);
```

#### Ruby

```bash
# Rails
rails db:migrate

# Non-Rails
bundle exec rake nats_pubsub:migrate
```

## Optional Dependencies

### Schema Validation (JavaScript)

```bash
npm install zod
```

### Monitoring (JavaScript)

```bash
# Prometheus metrics
npm install prom-client
```

### Web UI (Ruby)

```ruby
# Gemfile
gem 'sinatra'
gem 'sinatra-contrib'
```

Mount in Rails:

```ruby
# config/routes.rb
require 'nats_pubsub/web'

Rails.application.routes.draw do
  mount NatsPubsub::Web => '/nats_pubsub'
end
```

Access at: `http://localhost:3000/nats_pubsub`

## Development Tools

### NATS CLI

```bash
# macOS
brew install nats-io/nats-tools/nats

# Linux/Windows
curl -sf https://binaries.nats.dev/nats-io/natscli/nats@latest | sh
```

Useful commands:

```bash
# Check JetStream status
nats server check jetstream

# List streams
nats stream list

# Publish test message
nats pub "production.myapp.test" "hello world"

# Subscribe to messages
nats sub "production.myapp.>"
```

### Docker Compose (Development)

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  nats:
    image: nats:latest
    command: -js
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - nats-data:/data

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp_development
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  nats-data:
  postgres-data:
```

Start services:

```bash
docker-compose up -d
```

## Environment Variables

Create `.env` file:

```bash
# NATS Configuration
NATS_URL=nats://localhost:4222
NATS_ENV=development
NATS_APP_NAME=my-app

# Database (for Inbox/Outbox)
DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp_development

# Optional
NATS_TOKEN=secret-token
NATS_MAX_RECONNECT_ATTEMPTS=10
NATS_RECONNECT_TIME_WAIT=2000
```

Load in your app:

**JavaScript:**

```typescript
import { config } from "dotenv";
import NatsPubsub from "nats-pubsub";
config();

NatsPubsub.configure({
  natsUrls: process.env.NATS_URL,
  env: process.env.NATS_ENV,
  appName: process.env.NATS_APP_NAME,
});
```

**Ruby:**

```ruby
require 'dotenv/load'

NatsPubsub.configure do |config|
  config.nats_urls = ENV['NATS_URL']
  config.env = ENV['NATS_ENV']
  config.app_name = ENV['NATS_APP_NAME']
end
```

## Troubleshooting

### Connection Refused

```bash
# Check NATS is running
docker ps | grep nats

# Check port is accessible
nc -zv localhost 4222
```

### JetStream Not Enabled

```bash
# Error: JetStream not enabled
# Solution: Start NATS with -js flag
docker run -p 4222:4222 nats:latest -js
```

### Module Not Found (JavaScript)

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Gem Load Error (Ruby)

```bash
# Rebuild native extensions
bundle pristine
```

### Permission Denied

```bash
# Fix file permissions
chmod +x node_modules/.bin/nats-pubsub

# Or run with bundle exec
bundle exec nats_pubsub
```

## Next Steps

- **JavaScript**: Continue to [JavaScript Quick Start](./quick-start-js.md)
- **Ruby**: Continue to [Ruby Quick Start](./quick-start-ruby.md)
- Learn about [Core Concepts](./concepts.md)

## Additional Resources

- [NATS Documentation](https://docs.nats.io/)
- [NATS Docker Images](https://hub.docker.com/_/nats)
- [NatsPubsub GitHub](https://github.com/anthropics/nats-pubsub)

---

[← Introduction](./introduction.md) | [Back to Home](../index.md) | [Quick Start →](./quick-start-js.md)
