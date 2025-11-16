# GitHub Actions Workflows

This directory contains the CI/CD workflows for the NATS PubSub monorepo. The workflows have been organized to separate concerns for better maintainability.

## Workflow Structure

### Active Workflows

#### Testing Workflows

- **[test-rb.yml](test-rb.yml)** - Ruby package testing
  - Runs RuboCop linter
  - Executes RSpec tests
  - Tests against Ruby 3.2, 3.3, and 3.4
  - Triggered on push/PR to packages/ruby/**
  - Can be called as a reusable workflow

- **[test-js.yml](test-js.yml)** - JavaScript package testing
  - Runs ESLint
  - Executes tests
  - Builds TypeScript
  - Tests against Node.js 20, 22, and 24
  - Triggered on push/PR to packages/javascript/**
  - Can be called as a reusable workflow

#### Release Workflows

- **[release-rb.yml](release-rb.yml)** - Ruby package release and publishing
  - Detects version bump based on conventional commits
  - Updates version.rb and CHANGELOG.md
  - Publishes to RubyGems
  - Creates GitHub release
  - Supports manual version override via workflow_dispatch
  - Only runs on main branch

- **[release-js.yml](release-js.yml)** - JavaScript package release and publishing
  - Detects version bump based on conventional commits
  - Updates package.json and CHANGELOG.md
  - Publishes to npm
  - Creates GitHub release
  - Supports manual version override via workflow_dispatch
  - Only runs on main branch

#### Coordinating Workflows

- **[ci.yml](ci.yml)** - Main CI orchestration
  - Detects which packages changed using path filters
  - Calls appropriate test workflows based on changes
  - Runs on all branches (main, develop)

## Workflow Naming Convention

Workflows follow the pattern: `{action}-{js/rb}.yml`

- `test-rb.yml` - Test Ruby package
- `test-js.yml` - Test JavaScript package
- `release-rb.yml` - Release Ruby package
- `release-js.yml` - Release JavaScript package

## Versioning Strategy

Both packages use **conventional commits** for automatic version bumping:

- `feat:` commits → Minor version bump (0.x.0)
- `fix:` or `perf:` commits → Patch version bump (0.0.x)
- Commits with `BREAKING CHANGE` → Major version bump (x.0.0)
- `chore:` or `docs:` commits → No release

### Manual Release

You can manually trigger a release with a specific version:

1. Go to Actions → Select `Ruby Release` or `JavaScript Release`
2. Click "Run workflow"
3. Enter the version (e.g., `1.2.3`) or leave empty for auto-bump
4. Click "Run workflow"

## Release Process

### Automatic Release (Recommended)

1. Create a feature branch from `develop`
2. Make your changes with conventional commit messages
3. Create PR to `develop` (tests run automatically)
4. Merge PR to `develop` (tests run automatically)
5. Create PR from `develop` to `main`
6. Merge PR to `main` (tests + release run automatically)

### What Happens During Release

1. **Detect Version** job:
   - Checks for changes in the package since last release
   - Analyzes conventional commits to determine version bump
   - Skips release if only chore/docs commits

2. **Publish** job (only if version detected):
   - Updates version file (version.rb or package.json)
   - Updates CHANGELOG.md
   - Commits and tags the version
   - Builds the package
   - Publishes to registry (RubyGems or npm)
   - Creates GitHub release

## Testing Locally

### Ruby

```bash
cd packages/ruby
bundle install
bundle exec rubocop
bundle exec rspec
```

### JavaScript

```bash
pnpm install
pnpm --filter nats-pubsub lint
pnpm --filter nats-pubsub test
pnpm --filter nats-pubsub build
```

## Permissions

### For Testing Workflows

- `contents: read` - Read repository contents only

### For Release Workflows

- `contents: write` - Create commits, tags, and releases
- `id-token: write` - Trusted publishing to package registries

## Secrets Required

### For Ruby Releases

- Trusted publishing configured on RubyGems (recommended)
- Or `RUBYGEMS_API_KEY` secret (fallback)

### For JavaScript Releases

- `NPM_TOKEN` - npm access token for publishing

## Troubleshooting

### Release Not Triggered

- Ensure you're on the `main` branch
- Verify conventional commit format (feat:, fix:, etc.)
- Check that files in the package directory changed
- Avoid only chore/docs commits if you want a release

### Version Conflict

- The workflow checks current version before updating
- If version already matches, it skips the version update
- Tags must follow pattern: `ruby-v*` or `javascript-v*`

### Publish Failures

- Check that secrets are configured correctly
- Ensure package name is available on registry
- Verify registry permissions

## Future Improvements

Potential enhancements to consider:

- Add workflow for running integration tests
- Add workflow for generating release notes
- Add workflow for checking dependency updates
- Add workflow for security scanning
