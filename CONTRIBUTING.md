# Contributing to NatsPubsub

Thank you for your interest in contributing to NatsPubsub! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Package-Specific Guidelines](#package-specific-guidelines)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up your development environment
4. Create a new branch for your changes
5. Make your changes
6. Test your changes
7. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 24+ (for JavaScript/TypeScript package)
- Ruby 2.7+ (for Ruby package)
- NATS Server with JetStream enabled
- Git
- Docker and Docker Compose (optional, for containerized development)

### Installation

#### Clone the Repository

```bash
git clone https://github.com/attaradev/nats_pubsub.git
cd nats-pubsub
```

#### Ruby Package

```bash
cd packages/ruby
bundle install
```

#### JavaScript/TypeScript Package

```bash
cd packages/javascript
npm install
```

### Using Docker Compose

For a complete local development environment with NATS:

```bash
docker-compose up -d
```

This starts:

- NATS Server with JetStream
- PostgreSQL (for Inbox/Outbox)
- NATS CLI tools

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/add-retry-logic` - New features
- `fix/connection-timeout` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/simplify-middleware` - Code refactoring
- `test/add-integration-tests` - Test additions

### Code Style

#### Ruby

Follow the Ruby Style Guide. Run RuboCop before committing:

```bash
cd packages/ruby
bundle exec rubocop
```

Fix auto-fixable issues:

```bash
bundle exec rubocop -a
```

#### JavaScript/TypeScript

Follow the Airbnb JavaScript Style Guide. Run ESLint:

```bash
cd packages/javascript
npm run lint
```

Format code with Prettier:

```bash
npm run format
```

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning and changelog generation.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature (triggers minor version bump)
- `fix`: Bug fix (triggers patch version bump)
- `perf`: Performance improvement (triggers patch version bump)
- `docs`: Documentation changes (no version bump)
- `style`: Code style changes (no version bump)
- `refactor`: Code refactoring (no version bump)
- `test`: Test additions or modifications (no version bump)
- `chore`: Build process or auxiliary tool changes (no version bump)

### Scopes

Use package-specific scopes:

- `ruby`: Ruby package changes
- `javascript`: JavaScript/TypeScript package changes
- `ci`: CI/CD changes
- `deps`: Dependency updates

### Examples

```bash
# Feature addition
git commit -m "feat(ruby): add custom middleware support"

# Bug fix
git commit -m "fix(javascript): handle NATS server reconnection"

# Breaking change
git commit -m "feat(api)!: redesign subscriber API

BREAKING CHANGE: Subscriber base class constructor signature has changed"

# Documentation
git commit -m "docs: update installation instructions"
```

## Testing

### Ruby Tests

```bash
cd packages/ruby
bundle exec rspec
```

Run specific tests:

```bash
bundle exec rspec spec/path/to/spec.rb
```

### JavaScript Tests

```bash
cd packages/javascript
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Integration Tests

Ensure NATS server is running:

```bash
# Start NATS with JetStream
nats-server -js

# Or use Docker
docker-compose up -d nats
```

Then run integration tests for both packages.

## Submitting a Pull Request

1. **Update your fork**: Sync with the main repository

   ```bash
   git remote add upstream https://github.com/attaradev/nats_pubsub.git
   git fetch upstream
   git checkout develop
   git merge upstream/develop
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes**: Follow coding standards and write tests

4. **Run tests**: Ensure all tests pass

   ```bash
   # Ruby
   cd packages/ruby && bundle exec rspec

   # JavaScript
   cd packages/javascript && npm test
   ```

5. **Commit your changes**: Use conventional commit format

   ```bash
   git add .
   git commit -m "feat(ruby): add awesome feature"
   ```

6. **Push to your fork**

   ```bash
   git push origin feat/your-feature-name
   ```

7. **Open a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template with:
     - Description of changes
     - Related issues
     - Testing performed
     - Breaking changes (if any)

### Pull Request Guidelines

- **One feature per PR**: Keep pull requests focused
- **Update tests**: Add or update tests for your changes
- **Update documentation**: Update README or docs if needed
- **Follow commit conventions**: Use conventional commits
- **Keep it small**: Smaller PRs are easier to review
- **Resolve conflicts**: Rebase on latest develop before submitting
- **CI must pass**: Ensure all GitHub Actions checks pass

## Package-Specific Guidelines

### Ruby Package

- Follow Rails conventions where applicable
- Use RSpec for testing with descriptive test names
- Add RSpec matchers for new features
- Update generators if adding new features
- Test with multiple Ruby versions (2.7, 3.0, 3.1, 3.2)

### JavaScript/TypeScript Package

- Write TypeScript with full type safety
- Export types for public APIs
- Use Jest for testing
- Test with multiple Node.js versions (18, 20, 24)
- Update type definitions in index.d.ts if needed

## Documentation

- Update README files when adding features
- Add JSDoc/YARD comments for public APIs
- Include examples for new features
- Update CHANGELOG.md (handled automatically by CI for conventional commits)

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Contact maintainers at <mpyebattara@gmail.com>

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to NatsPubsub!
