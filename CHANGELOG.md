# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-15

### Added

#### JavaScript/TypeScript

- Initial release of `nats-pubsub` package
- Declarative subscriber API with class-based patterns
- Publisher with batch publishing support
- Inbox/Outbox pattern implementation
- Dead Letter Queue (DLQ) handling
- Middleware system for cross-cutting concerns
- Schema validation with Zod integration
- Prometheus metrics support
- Health check endpoints
- Circuit breaker pattern
- In-memory repositories for testing
- SQL schemas for PostgreSQL, MySQL, SQLite
- Comprehensive testing utilities
- TypeScript type definitions with full generics support
- CLI tool for management operations

#### Ruby

- Initial release of `nats_pubsub` gem
- Declarative subscriber API with ActiveRecord integration
- Publisher with batch publishing support
- Inbox/Outbox pattern with database backing
- Dead Letter Queue (DLQ) handling
- Middleware system
- Rails integration with Railtie
- Rails generators (install, subscriber, config, migrations)
- Web UI for Inbox/Outbox monitoring (Sinatra-based)
- RSpec testing matchers and helpers
- Fake and inline testing modes
- ActiveSupport instrumentation
- CLI tool for management

#### Documentation

- Comprehensive documentation site (31 markdown files)
- Getting started guides for both languages
- Complete API reference for JavaScript and Ruby
- Pattern guides (Inbox/Outbox, DLQ, Schema Validation, Event Sourcing)
- Integration guides (Rails, Express, NestJS, Databases)
- Deployment guide (Docker, Kubernetes)
- Performance tuning guide
- Troubleshooting guide with FAQ
- 40+ working code examples
- Microservices example application

#### Infrastructure

- Docker Compose setup with NATS, PostgreSQL, Prometheus, Grafana
- GitHub Actions CI/CD workflows
- Automated testing for both packages
- Security audit workflows
- Monorepo structure with pnpm workspaces
- Conventional Commits enforcement
- Husky git hooks

### Documentation

- Added comprehensive 41,000+ line documentation
- Added microservices example with Node.js and Ruby services
- Added Docusaurus website setup
- Added blog and changelog

### Developer Experience

- Added testing utilities for both languages
- Added fake modes for testing
- Added comprehensive error messages
- Added debug logging support
- Added health check endpoints

## [Unreleased]

### Added

#### Security & Authentication

- **NATS Authentication support** (JavaScript & Ruby) — token, user/password, NKey, and credentials file authentication methods via `auth` config option (JS) and `auth_token`, `auth_user`, `auth_password`, `nkeys_seed`, `user_credentials` config attributes (Ruby)
- **NATS TLS/mTLS support** (JavaScript & Ruby) — CA certificate, client certificate, and client key configuration via `tls` config option (JS) and `tls_ca_file`, `tls_cert_file`, `tls_key_file` config attributes (Ruby)
- **Payload size validation** — Publisher validates message size against NATS max payload (1MB) before publishing, providing clear errors for oversized messages
- **TLS URL scheme support** — `tls://` URLs are now accepted alongside `nats://` in URL validation

#### Reliability & Robustness

- **Connection retry with exponential backoff** (JavaScript) — Initial connection retries up to 5 times with exponential backoff (1s, 2s, 4s, 8s) before failing, preventing transient startup failures
- **Unlimited reconnect attempts** (Ruby) — Changed `max_reconnect_attempts` from 10 to -1 (unlimited) for production resilience
- **Topic-based message routing** — Stream topology now includes `{env}.{appName}.>` subject pattern alongside event-based pattern, fixing silent message loss for topic-based messages

### Fixed

- **GracefulShutdown calling nonexistent Consumer methods** — Removed `as any` casts to phantom `pause()`, `getInFlightCount()`, `forceStop()`, and `close()` methods; now correctly uses `consumer.stop()` with timeout, leveraging NATS's built-in `drain()` for graceful message completion
- **Publisher singleton capturing stale config** — Publisher now lazily resolves `EnvelopeBuilder`, `SubjectBuilder`, and `Logger` from config at call time instead of import time; default export uses Proxy for deferred instantiation
- **DlqConsumer unbounded in-memory Map** — Added 10,000 message cap with oldest-first eviction to prevent memory leaks in long-running processes
- **TopologyManager fragile error detection** — Replaced brittle `err.code === '404'` check with `isStreamNotFoundError()` helper that handles string codes, numeric codes, and JetStream API error codes
- **Unhandled async errors in connection status monitor** — Added try/catch around async status monitoring IIFE to prevent unhandled rejections
- **Consumer subscribe() not awaited** — Fixed fire-and-forget `this.subscribe(subject)` to properly `await` the async call
- **Hardcoded credentials in docker-compose.yml** — Replaced hardcoded Postgres and Grafana passwords with environment variable references using `${VAR:?error}` syntax

### Improved

- **Singleton testability** — Added `config.reset()`, `connection.reset()`, and `resetPublisher()` methods for clean test isolation without module reloading

### Planned Features

- OpenTelemetry integration
- GraphQL subscriptions support
- Python implementation
- Go implementation
- Cloud deployment templates
- Enhanced Web UI with React
- Message replay functionality
- Stream compaction support
- Key-value store integration

---

## Release Types

### Major Release (X.0.0)

- Breaking API changes
- Major new features
- Architectural changes

### Minor Release (0.X.0)

- New features
- Non-breaking API additions
- Performance improvements

### Patch Release (0.0.X)

- Bug fixes
- Documentation updates
- Security patches

## Support

- [GitHub Issues](https://github.com/anthropics/nats-pubsub/issues)
- [GitHub Discussions](https://github.com/anthropics/nats-pubsub/discussions)
- [Documentation](./docs/index.md)

## Links

- [NPM Package](https://www.npmjs.com/package/nats-pubsub)
- [RubyGems Package](https://rubygems.org/gems/nats_pubsub)
- [GitHub Repository](https://github.com/anthropics/nats-pubsub)
