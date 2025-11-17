# Contributing to nats-pubsub

First off, thank you for considering contributing to nats-pubsub! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues. When creating a bug report, please include as many details as possible.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Provide detailed information about your proposed changes.

### Your First Code Contribution

Look for `good-first-issue` and `help-wanted` labels to get started.

## Development Setup

### Prerequisites

- Node.js 20+ (JavaScript package)
- Ruby 3.2+ (Ruby package)
- NATS Server with JetStream
- pnpm 10+ (JavaScript) or Bundler (Ruby)

### JavaScript Package

\`\`\`bash
cd packages/javascript
pnpm install
pnpm test
pnpm lint
pnpm build
\`\`\`

### Ruby Package

\`\`\`bash
cd packages/ruby
bundle install
bundle exec rspec
bundle exec rubocop
\`\`\`

### Start NATS Server

\`\`\`bash
docker run -d --name nats-js -p 4222:4222 nats:latest -js
\`\`\`

## Making Changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

\`\`\`
feat: add new feature
fix: bug fix
docs: documentation
refactor: code refactoring
test: testing
\`\`\`

## Testing

Run tests before submitting:

```bash

# JavaScript

pnpm test

# Ruby

bundle exec rspec
```

## Submitting Changes

1. Fork the repo and create your branch from \`develop\`
2. Add tests for your changes
3. Update documentation
4. Ensure tests pass
5. Run linter
6. Submit pull request!

## Style Guidelines

- Follow existing code style
- Add JSDoc/YARD comments for public APIs
- Write descriptive commit messages
- Keep PRs focused and atomic

## Need Help?

- 💬 [GitHub Discussions](https://github.com/attaradev/nats_pubsub/discussions)
- 🐛 [GitHub Issues](https://github.com/attaradev/nats_pubsub/issues)

Thank you for contributing! 🙏
