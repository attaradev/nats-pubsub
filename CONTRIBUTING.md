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
- pnpm 10+ (package manager for JavaScript/TypeScript)
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

#### JavaScript Package Setup

```bash
# From monorepo root
pnpm install

# Or from package directory
cd packages/javascript
pnpm install
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
pnpm lint
```

Format code with Prettier:

```bash
pnpm format
```

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages and [Changesets](https://github.com/changesets/changesets) for version management.

### Commit Message Format

```md
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

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

# Documentation change
git commit -m "docs: update installation instructions"
```

### Creating Changesets

For changes that affect package functionality (features, fixes, breaking changes), create a changeset:

```bash
pnpm changeset
```

The CLI will guide you through:

1. Selecting which package(s) changed
2. Choosing the bump type (major/minor/patch)
3. Writing a user-facing summary

**When to create a changeset:**

- ✅ New features
- ✅ Bug fixes
- ✅ Breaking changes
- ✅ Performance improvements
- ❌ Documentation-only updates
- ❌ Internal refactoring (unless API changes)
- ❌ Test-only changes

See [RELEASING.md](./RELEASING.md) for detailed release process documentation.

## Testing

All contributions must include appropriate tests. We strive for high test coverage to ensure reliability.

### Ruby Tests

```bash
cd packages/ruby
bundle exec rspec
```

Run specific tests:

```bash
bundle exec rspec spec/path/to/spec.rb
```

Run with coverage report:

```bash
bundle exec rspec --format documentation
```

### JavaScript Tests

```bash
cd packages/javascript
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Run with coverage report:

```bash
pnpm test -- --coverage
```

### Test Coverage Guidelines

- **Minimum coverage**: Aim for at least 80% code coverage
- **Critical paths**: 100% coverage for core functionality (publishers, consumers, middleware)
- **New features**: Must include comprehensive tests
- **Bug fixes**: Must include regression tests

### Integration Tests

Ensure NATS server is running:

```bash
# Start NATS with JetStream
nats-server -js

# Or use Docker
docker-compose up -d nats
```

Then run integration tests for both packages.

### Pre-Push Hook

The pre-push Git hook automatically runs all tests before pushing. This ensures that:

- All tests pass before code is pushed
- Test coverage requirements are met
- Code quality is maintained

If tests fail, the push will be blocked. Fix the failing tests before pushing again.

## Submitting a Pull Request

1. **Update your fork**: Sync with the main repository

   ```bash
   git remote add upstream https://github.com/attaradev/nats_pubsub.git
   git fetch upstream
   git checkout main
   git merge upstream/main
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
   cd packages/javascript && pnpm test
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
- **Resolve conflicts**: Rebase on latest main before submitting
- **CI must pass**: Ensure all GitHub Actions checks pass
- **Add changeset**: Include a changeset for package changes

## Package-Specific Guidelines

### Ruby Gem

- Follow Rails conventions where applicable
- Use RSpec for testing with descriptive test names
- Add RSpec matchers for new features
- Update generators if adding new features
- Test with multiple Ruby versions (2.7, 3.0, 3.1, 3.2)

### JavaScript/TypeScript Guidelines

- Write TypeScript with full type safety
- Export types for public APIs
- Use Jest for testing
- Test with multiple Node.js versions (18, 20, 24)
- Update type definitions in index.d.ts if needed

## Documentation

- Update README files when adding features
- Add JSDoc/YARD comments for public APIs
- Include examples for new features
- Changesets will automatically update CHANGELOG.md during releases

## Release Process

For information about releasing packages, see [RELEASING.md](./RELEASING.md). This includes:

- Creating changesets for your changes
- Understanding the automated release workflow
- Manual release procedures
- Emergency hotfix processes
- Version policy guidelines

## Emergency Releases & Rollback

### Hotfix Process

For critical production issues:

1. **Create hotfix branch from main**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue-description
   ```

2. **Make the fix and test thoroughly**

3. **Add changeset (for JS) or update version (for Ruby)**

   ```bash
   pnpm changeset:add  # For JavaScript fixes
   ```

4. **Create PR with `[HOTFIX]` prefix**

   ```bash
   gh pr create --title "fix: [HOTFIX] critical bug description"
   ```

5. **Request immediate review and merge**

6. **Monitor release pipeline closely**

### Rollback Procedures

#### NPM Package Rollback

```bash
# Deprecate the bad version
npm deprecate nats-pubsub@X.Y.Z "Critical bug. Use X.Y.Z-1 instead"

# Publish fixed version
pnpm changeset:add  # Select patch
# ... follow normal release
```

#### RubyGems Rollback

```bash
# Yank the version (use with extreme caution)
gem yank nats_pubsub -v X.Y.Z

# Or publish new fixed version
# ... follow normal Ruby release
```

#### Git Tag Rollback

```bash
# Delete tag locally and remotely
git tag -d javascript-vX.Y.Z
git push origin :refs/tags/javascript-vX.Y.Z

# Delete GitHub release
gh release delete javascript-vX.Y.Z --yes
```

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Review documentation: [RELEASING.md](./RELEASING.md)
- Check CI logs: <https://github.com/attaradev/nats-pubsub/actions>

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to NatsPubsub!
