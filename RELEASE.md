# Release Guide

This document describes the release process for nats-pubsub packages.

## Overview

The project uses [Changesets](https://github.com/changesets/changesets) for version management and publishes from version tags:

- Push a `javascript-vX.Y.Z` tag to trigger `.github/workflows/javascript.yml` and publish to npm
- Push a `ruby-vX.Y.Z` tag to trigger `.github/workflows/ruby.yml` and publish to RubyGems

Both npm and RubyGems publishing use OIDC (OpenID Connect) for secure, token-free authentication.

## OIDC Setup Requirements

### npm (JavaScript Package)

**No secrets required!** The workflow uses OIDC with provenance for secure publishing.

**Setup:**

1. Ensure you have publishing rights for the `nats-pubsub` package on npm
2. npm OIDC is configured automatically via `NPM_CONFIG_PROVENANCE: true`
3. The GitHub Actions workflow uses the `id-token: write` permission

**Benefits:**

- No long-lived tokens to manage
- Automatic provenance attestation
- Enhanced supply chain security
- Verifiable package origins

### RubyGems (Ruby Package)

**No secrets required!** The workflow uses the official RubyGems OIDC via `rubygems/release-gem@v1` action.

**Setup:**

Before publishing for the first time, you need to configure trusted publishing on RubyGems.org:

#### Option 1: For Existing Gems

1. Go to <https://rubygems.org/gems/nats_pubsub>
2. Navigate to "Settings" → "Trusted publishing"
3. Click "Add trusted publisher"
4. Fill in the details:
   - **Repository owner**: `attaradev`
   - **Repository name**: `nats-pubsub`
   - **Workflow filename**: `ruby.yml`
   - **Environment name**: (leave empty)

#### Option 2: For New Gems (Pending Publishers)

If the gem doesn't exist yet:

1. Go to <https://rubygems.org/settings/trusted_publishing>
2. Click "Add a new pending trusted publisher"
3. Fill in:
   - **Gem name**: `nats_pubsub`
   - **Repository owner**: `attaradev`
   - **Repository name**: `nats-pubsub`
   - **Workflow filename**: `ruby.yml`
   - **Environment name**: (leave empty)

**How it works:**

- The workflow uses `rubygems/configure-rubygems-credentials@v1` to request credentials via OIDC
- The gem is built and pushed directly with `gem build` / `gem push`
- OIDC tokens are automatically used for authentication via `id-token: write` permission

**Benefits:**

- No API keys to rotate
- Per-workflow authentication
- Auditable releases
- Enhanced security

## Release Workflow

### JavaScript (npm)

1. Make your changes under `packages/javascript/`
2. Create a changeset to record the bump:
   ```bash
   pnpm changeset add
   ```
3. When ready to ship, apply the changeset version bump (usually via a PR):
   ```bash
   pnpm changeset version
   pnpm install
   git commit -am "chore: version JavaScript packages"
   ```
4. Tag the release from the commit on `main`:
   ```bash
   VERSION=$(node -p "require('./packages/javascript/package.json').version")
   git tag -a "javascript-v${VERSION}" -m "Release JavaScript v${VERSION}"
   git push origin "javascript-v${VERSION}"
   ```
5. The `javascript.yml` workflow publishes to npm with provenance and creates the GitHub release.

### Ruby (RubyGems)

1. Update the version in `packages/ruby/lib/nats_pubsub/version.rb`
2. Commit the change on `main`
3. Tag the release:
   ```bash
   VERSION=$(sed -n "s/.*VERSION = '\\([^']*\\)'.*/\\1/p" packages/ruby/lib/nats_pubsub/version.rb)
   git tag -a "ruby-v${VERSION}" -m "Release Ruby v${VERSION}"
   git push origin "ruby-v${VERSION}"
   ```
4. The `ruby.yml` workflow publishes to RubyGems via OIDC and creates the GitHub release.

## Version Management

### JavaScript Package (nats-pubsub)

- Version managed by Changesets in `packages/javascript/package.json`
- Published to npm when `javascript-vX.Y.Z` tag is pushed

### Ruby Package (nats_pubsub)

- Version defined in `packages/ruby/lib/nats_pubsub/version.rb`
- Published to RubyGems when `ruby-vX.Y.Z` tag is pushed

## Changeset Types

- **patch**: Bug fixes, documentation updates (0.0.X)
- **minor**: New features, non-breaking changes (0.X.0)
- **major**: Breaking changes (X.0.0)

## Example Release Flow

```bash
# 1. Make changes to JavaScript package
cd packages/javascript
# ... make your changes ...

# 2. Create changeset
cd ../..
pnpm changeset add
# Select: major (for 1.0.0 release)
# Enter summary: "Release version 1.0.0 - Production ready"

# 3. Commit changeset
git add .changeset/
git commit -m "chore: add changeset for 1.0.0 release"

# 4. Push your version commit (ideally via PR), then tag:
git push origin main
git tag -a "javascript-v1.0.0" -m "Release JavaScript v1.0.0"
git push origin "javascript-v1.0.0"
```

## Verification

After release, verify publications:

### npm

```bash
npm view nats-pubsub@1.0.0
```

Check provenance:

```bash
npm view nats-pubsub@1.0.0 --json | jq .dist.attestations
```

### RubyGems

```bash
gem list -r nats_pubsub | grep "1.0.0"
```

## Troubleshooting

### npm OIDC Issues

- Ensure the workflow has `id-token: write` permission
- Verify you have npm publishing rights
- Check that `NPM_CONFIG_PROVENANCE: true` is set

### RubyGems OIDC Issues

- Verify trusted publisher is configured on RubyGems.org
- Ensure repository owner/name matches exactly
- Check workflow filename is `ruby.yml`
- Verify the workflow has `id-token: write` permission
- Make sure the Ruby package has `require 'bundler/gem_tasks'` in Rakefile
- Confirm the Gemfile includes `gemspec` and that commands run from `packages/ruby`

## Security Benefits of OIDC

1. **No Secret Management**: No tokens to rotate or leak
2. **Scoped Access**: Each workflow run gets a unique, short-lived token
3. **Audit Trail**: All releases are tied to specific GitHub Actions runs
4. **Provenance**: Packages include attestations proving their origin
5. **Supply Chain Security**: Verifiable build and publish process

## References

- [Changesets Documentation](https://github.com/changesets/changesets)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [RubyGems Trusted Publishing](https://guides.rubygems.org/trusted-publishing/)
- [rubygems/release-gem Action](https://github.com/rubygems/release-gem)
- [GitHub OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
