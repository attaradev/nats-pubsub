# Release Guide

This document describes the release process for nats-pubsub packages.

## Overview

The project uses [Changesets](https://github.com/changesets/changesets) for version management and automated releases from the `develop` branch. Both npm and RubyGems publishing use OIDC (OpenID Connect) for secure, token-free authentication.

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
   - **Workflow filename**: `release.yml`
   - **Environment name**: (leave empty)

#### Option 2: For New Gems (Pending Publishers)

If the gem doesn't exist yet:

1. Go to <https://rubygems.org/settings/trusted_publishing>
2. Click "Add a new pending trusted publisher"
3. Fill in:
   - **Gem name**: `nats_pubsub`
   - **Repository owner**: `attaradev`
   - **Repository name**: `nats-pubsub`
   - **Workflow filename**: `release.yml`
   - **Environment name**: (leave empty)

**How it works:**

- The workflow uses `rubygems/release-gem@v1` which runs `rake release`
- Bundler's gem tasks handle building and publishing
- OIDC tokens are automatically used for authentication via `id-token: write` permission

**Benefits:**

- No API keys to rotate
- Per-workflow authentication
- Auditable releases
- Enhanced security

## Release Workflow

### 1. Making Changes

When making changes that should be released:

```bash
# After making your changes
pnpm changeset add
```

This creates a changeset file that describes your changes and the version bump type (patch/minor/major).

### 2. Automatic Release Process

The release workflow runs automatically on pushes to the `develop` branch:

1. **Detects Changesets**: Checks if any changesets are pending
2. **Creates Version PR**: If changesets exist, creates a "Version Packages" PR that:
   - Updates package versions
   - Updates CHANGELOG.md files
   - Removes consumed changeset files
3. **Publish on Merge**: When the Version PR is merged:
   - **JavaScript**: Publishes to npm with OIDC provenance
   - **Ruby**: Publishes to RubyGems with OIDC
   - Creates GitHub releases with tags (`javascript-v1.0.0`, `ruby-v1.0.0`)

### 3. Manual Release Trigger

You can also trigger releases manually:

```bash
gh workflow run release.yml
```

## Version Management

### JavaScript Package (nats-pubsub)

- Version managed by Changesets in `packages/javascript/package.json`
- Automatically published to npm
- Tagged as `javascript-vX.Y.Z`

### Ruby Package (nats_pubsub)

- Version defined in `packages/ruby/lib/nats_pubsub/version.rb`
- Manually update version when needed (not managed by Changesets)
- Published to RubyGems when version changes
- Tagged as `ruby-vX.Y.Z`

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

# 4. Push to develop
git push origin develop

# 5. Wait for Version PR to be created
# 6. Review and merge the Version PR
# 7. Packages are automatically published with OIDC!
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
- Check workflow filename is `release.yml`
- Verify the workflow has `id-token: write` permission
- Make sure the Ruby package has `require 'bundler/gem_tasks'` in Rakefile
- The `rubygems/release-gem@v1` action requires:
  - A Gemfile with `gemspec`
  - A Rakefile with `require 'bundler/gem_tasks'`
  - The workflow to run from the package directory

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
