# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-16

### Added

- Initial release of Ruby implementation
- Core configuration system with Rails integration
- NATS JetStream connection management with auto-reconnect
- Publisher with idempotent publish support via Outbox pattern
- Consumer with pull-based subscriptions
- Declarative subscriber system with auto-discovery
- Middleware chain for extensible message processing
- Built-in middleware: Logging, RetryLogger, ActiveRecord
- DLQ (Dead-Letter Queue) support
- Inbox pattern for idempotent message processing
- Outbox pattern for reliable message sending
- Web UI for monitoring Inbox/Outbox events
- Rails generators for initializer and migrations
- Rake tasks for setup
- RSpec testing helpers and matchers
- ActiveRecord integration for auto-publishing model events
- CLI executable for running subscribers
- Comprehensive documentation

### Features

- Subject pattern: `{env}.events.{domain}.{resource}.{action}`
- Automatic stream topology provisioning with overlap prevention
- Configurable concurrency and backoff strategies
- Event envelope format for structured messaging
- Graceful shutdown support
- Comprehensive error handling and logging
- Fake and inline testing modes
- Model utilities for event codec setup

### Infrastructure

- Rails Railtie for automatic integration
- ActiveRecord model support for Inbox/Outbox
- Sinatra-based Web UI
- RuboCop configuration for code quality
- RSpec test suite with comprehensive coverage

[unreleased]: https://github.com/attaradev/nats-pubsub/compare/ruby-v0.1.0...HEAD
[0.1.0]: https://github.com/attaradev/nats-pubsub/releases/tag/ruby-v0.1.0
