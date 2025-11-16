# CI/CD Setup

This monorepo uses GitHub Actions for automated testing and publishing of packages.

## Overview

Each package has its own CI/CD workflow that:

- Runs tests on multiple versions
- Detects changes using conventional commits
- Automatically versions and publishes releases
- Creates GitHub releases with changelogs

## Workflows

### Ruby Package (`.github/workflows/ruby.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Changes in `packages/ruby/**`
- Pull requests

**Jobs:**

1. **Test**: Runs tests on Ruby 2.7, 3.0, 3.1, 3.2
   - Installs dependencies
   - Runs RuboCop linter
   - Runs RSpec tests

2. **Detect Version**: Analyzes commits for version bump
   - Scans commits since last tag for conventional commit types
   - Determines semantic version bump (major/minor/patch)
   - Only runs on `main` branch pushes

3. **Publish**: Builds and publishes to RubyGems
   - Updates version in `lib/nats_pubsub/version.rb`
   - Updates CHANGELOG.md
   - Commits and tags the release
   - Builds gem
   - Publishes to RubyGems
   - Creates GitHub release

### JavaScript Package (`.github/workflows/javascript.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Changes in `packages/javascript/**`
- Pull requests

**Jobs:**

1. **Test**: Runs tests on Node.js 18, 20, 24
   - Installs dependencies
   - Runs ESLint linter
   - Runs Jest tests
   - Builds TypeScript

2. **Detect Version**: Analyzes commits for version bump
   - Scans commits since last tag for conventional commit types
   - Determines semantic version bump (major/minor/patch)
   - Only runs on `main` branch pushes

3. **Publish**: Builds and publishes to npm
   - Updates version in `package.json`
   - Updates CHANGELOG.md
   - Commits and tags the release
   - Builds TypeScript
   - Publishes to npm
   - Creates GitHub release

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:

### Commit Types

- `feat:` - New feature (triggers **minor** version bump)
- `fix:` - Bug fix (triggers **patch** version bump)
- `perf:` - Performance improvement (triggers **patch** version bump)
- `BREAKING CHANGE:` - Breaking change (triggers **major** version bump)
- `docs:`, `style:`, `refactor:`, `test:`, `chore:` - No version bump

### Examples

```bash
# Patch version bump (0.1.0 -> 0.1.1)
git commit -m "fix(publisher): handle connection timeout gracefully"

# Minor version bump (0.1.0 -> 0.2.0)
git commit -m "feat(consumer): add batch processing support"

# Major version bump (0.1.0 -> 1.0.0)
git commit -m "feat(api)!: redesign subscriber API

BREAKING CHANGE: Subscriber base class constructor signature has changed"
```

### Scoping to Packages

To ensure changes only trigger the relevant package's workflow, scope your commits:

```bash
# Ruby package changes
git commit -m "feat(ruby): add custom middleware support"
git commit -m "fix(ruby/consumer): prevent duplicate message processing"

# JavaScript package changes
git commit -m "feat(javascript): add retry middleware configuration"
git commit -m "fix(javascript/publisher): handle NATS server reconnection"

# Both packages (rare)
git commit -m "docs: update README with new examples"
```

## Tagging Strategy

Each package uses its own tag namespace:

- Ruby: `ruby-v1.0.0`, `ruby-v1.1.0`, etc.
- JavaScript: `javascript-v1.0.0`, `javascript-v1.1.0`, etc.

This allows independent versioning and releases.

## Required Secrets

Configure these secrets in your GitHub repository settings:

### For Ruby Package

- `RUBYGEMS_API_KEY`: API key for publishing to RubyGems
  - Get from: <https://rubygems.org/profile/edit>
  - Requires gem ownership permissions

### For JavaScript Package

- `NPM_TOKEN`: Authentication token for npm
  - Generate at: <https://www.npmjs.com/settings/[username]/tokens>
  - Choose "Automation" token type

## Manual Release Process

If you need to release manually without conventional commits:

### Ruby

```bash
cd packages/ruby

# Update version
vim lib/nats_pubsub/version.rb

# Update CHANGELOG
vim CHANGELOG.md

# Build and publish
gem build nats_pubsub.gemspec
gem push nats_pubsub-*.gem

# Tag and push
git add .
git commit -m "chore(ruby): release v1.0.0"
git tag ruby-v1.0.0
git push origin main --tags
```

### JavaScript

```bash
cd packages/javascript

# Update version
npm version 1.0.0 --no-git-tag-version

# Update CHANGELOG
vim CHANGELOG.md

# Build and publish
npm run build
npm publish

# Tag and push
git add .
git commit -m "chore(javascript): release v1.0.0"
git tag javascript-v1.0.0
git push origin main --tags
```

## Monitoring Releases

- **GitHub Actions**: View workflow runs at `https://github.com/[owner]/[repo]/actions`
- **RubyGems**: Check versions at `https://rubygems.org/gems/nats_pubsub`
- **npm**: Check versions at `https://www.npmjs.com/package/nats-pubsub`
- **GitHub Releases**: View at `https://github.com/[owner]/[repo]/releases`

## Troubleshooting

### Workflow not triggering

- Ensure changes are in the correct package directory
- Check that files match the `paths` filter in the workflow
- Verify branch is `main` or `develop`

### Version not bumping

- Ensure commit messages follow conventional commit format
- Check that commits include `feat:`, `fix:`, or `BREAKING CHANGE:`
- Verify commits are scoped to the correct package directory

### Publishing fails

- Verify secrets are correctly configured
- Check API key/token permissions
- Ensure package name is not already taken
- For Ruby: Verify you're listed as a gem owner

### CHANGELOG not updating

- Ensure `## [Unreleased]` section exists in CHANGELOG.md
- Check sed command syntax in workflow file
- Review workflow logs for errors

## Best Practices

1. **One package per PR**: Keep changes focused on a single package when possible
2. **Use conventional commits**: Enables automatic versioning
3. **Update tests**: CI will catch test failures before release
4. **Review CHANGELOGs**: Ensure automated entries are clear and accurate
5. **Test locally**: Run `npm test` or `bundle exec rspec` before pushing
6. **Semantic versioning**: Follow [semver](https://semver.org/) guidelines

## Future Enhancements

Potential improvements to consider:

- Add code coverage reporting
- Implement automatic dependency updates (Dependabot)
- Add security scanning (e.g., Snyk, npm audit)
- Create release notes templates
- Add changelog validation
- Implement pre-release versions (alpha, beta, rc)
