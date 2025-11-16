# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-16

### Added
- Initial release of Node.js/TypeScript implementation
- Core configuration system
- NATS JetStream connection management with auto-reconnect
- Publisher with idempotent publish support
- Consumer with pull-based subscriptions
- Declarative subscriber system with class-based and decorator approaches
- Middleware chain for extensible message processing
- Built-in logging and retry logging middleware
- DLQ (Dead-Letter Queue) support
- TypeScript type definitions
- Jest testing setup
- Full documentation and examples

### Features
- Subject pattern: `{env}.events.{domain}.{resource}.{action}`
- Automatic stream topology provisioning
- Configurable concurrency and backoff strategies
- Event envelope format compatible with Ruby implementation
- Graceful shutdown support
- Comprehensive error handling and logging
