# Release Process

This document describes the enhanced automated release process for the NATS PubSub monorepo.

## Overview

The release process is automated using GitHub Actions and uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation for JavaScript packages, while Ruby packages use manual version management.

## Release Workflow Features

### 0. Manual Approval Gate

All publish jobs pause on a protected `release` environment. A human must approve the run in the Actions UI before npm/RubyGems publication continues. This applies to automatic runs from `main` and manual dispatches.

### 1. Pre-Release Validation

Before any release, the workflow automatically:

- **Security Audit**: Scans for vulnerabilities in dependencies
  - JavaScript: Uses `pnpm audit` with detailed reporting
  - Ruby: Uses `bundler-audit` to check for known vulnerabilities
  - Reports critical, high, moderate, and low severity issues

- **Build Validation**: Ensures packages build correctly
  - Verifies all build artifacts exist (JS, CJS, type definitions)
  - Checks artifact sizes
  - Validates package.json exports configuration

- **Changeset Detection**: Identifies pending releases
  - Checks for changeset files in `.changeset/` directory
  - Validates changeset JSON output
  - Determines if JavaScript or Ruby releases are needed

### 2. Release Notes Automation

Enhanced release notes are automatically generated with:

- Installation instructions for multiple package managers
- Package size and dependency information
- Links to full changelog
- Provenance verification instructions
- TypeScript support details

### 3. Package Provenance Verification

For JavaScript packages:

- NPM provenance attestations enabled (`NPM_CONFIG_PROVENANCE: true`)
- Automatic verification of published package metadata
- Validation of:
  - Version correctness
  - Package integrity (main, module, types fields)
  - File contents
  - Dependencies
  - Provenance attestations

### 4. Comprehensive Testing

After publication:

- **Installation Testing**: Installs the package in a clean environment
- **Metadata Verification**: Validates package registry information
- **Size Checks**: Reports package size
- **Dependency Validation**: Verifies dependency tree

### 5. Release Notifications

Automatic notifications after successful releases:

- Console logs with package URLs
- Optional GitHub Discussions (if configured)
- Can be extended for:
  - Discord/Slack webhooks
  - Email notifications
  - Documentation updates

### 6. Rollback Mechanism

Manual rollback workflow available via `workflow_dispatch`:

```yaml
# Trigger manually from GitHub Actions UI
inputs:
  rollback_version: "0.2.0" # Version to rollback
  rollback_package: "javascript" # or "ruby"
```

**Rollback features:**

- Validates tag existence
- Creates tracking issue with checklist
- Provides instructions for manual deprecation
- Documents rollback process

**Important Notes:**

- NPM packages cannot be unpublished after 72 hours
- RubyGems can only be yanked within certain time limits
- GitHub releases and tags can always be deleted

## Triggering Releases

### Automated Release (Main Branch)

The release workflow triggers automatically when:

1. CI workflow completes successfully on the `main` branch
2. Changesets are detected or Ruby version changes
3. A maintainer approves the pending run in the `release` environment gate

### Manual Release

Trigger manually via GitHub Actions (helpful for verified releases without a new CI run):

```bash
# Navigate to Actions > Release > Run workflow
# Leave rollback inputs empty to perform a normal release
gh workflow run release.yml

# Then approve the run when GitHub prompts for the protected environment
```

### Manual Rollback

```bash
gh workflow run release.yml \
  --field rollback_version=0.2.0 \
  --field rollback_package=javascript
```

## Release Process Steps

### JavaScript Package Release

1. **Create a changeset**:

   ```bash
   pnpm changeset
   ```

2. **Commit the changeset file**:

   ```bash
   git add .changeset/*.md
   git commit -m "chore: add changeset for feature X"
   ```

3. **Push to develop/main**:

   ```bash
   git push origin main
   ```

4. **Automated workflow**:
   - CI runs and passes
   - Release workflow triggers
   - Prepare job validates environment
   - Release job creates Release PR or publishes
   - Changesets updates `package.json` and `CHANGELOG.md`
   - Package is published to npm with provenance
   - GitHub Release is created
   - Installation is tested
   - Notifications are sent

### Ruby Package Release

1. **Update version file**:

   ```ruby
   # packages/ruby/lib/nats_pubsub/version.rb
   module NatsPubsub
     VERSION = "1.2.3"
   end
   ```

2. **Update gemspec** (if needed)

3. **Update CHANGELOG.md**

4. **Commit version changes**:

   ```bash
   git add packages/ruby/lib/nats_pubsub/version.rb
   git commit -m "chore: bump ruby version to 1.2.3"
   ```

5. **Push to main**:

   ```bash
   git push origin main
   ```

6. **Automated workflow**:
   - Detects version change
   - Validates Ruby version sync
   - Runs security audit
   - Builds gem
   - Creates Git tag
   - Publishes to RubyGems with OIDC
   - Verifies publication
   - Tests installation
   - Creates GitHub Release
   - Sends notifications

## Pre-Release Checklist

Use the built-in helper script:

```bash
pnpm release:check
```

This validates:

- ✅ Git working directory is clean
- ✅ On correct branch (develop/main)
- ✅ Changesets exist (for JS) or version changed (for Ruby)
- ✅ Node.js and pnpm installed
- ✅ Ruby installed (for Ruby releases)
- ✅ Tests passing
- ✅ Builds successful
- ✅ Credentials configured

## Monitoring Releases

### Check Release Status

```bash
pnpm release:status
```

Shows:

- Current versions for JavaScript and Ruby packages
- Latest Git tags
- Pending changesets

### Preview Release

```bash
pnpm release:preview
```

Shows:

- What will be released
- Version bumps
- Changeset summaries

## Workflow Jobs

### 1. `prepare`

**Purpose**: Validate environment and determine what needs to be released

**Steps**:

- Checkout code
- Install dependencies
- Run security audits
- Validate builds
- Check for changesets
- Detect Ruby version changes
- Generate validation summary

**Outputs**:

- `has_changesets`: boolean
- `ruby_changed`: boolean
- `ruby_version`: string
- `has_vulnerabilities`: boolean
- `audit_summary`: string

### 2. `release`

**Purpose**: Create Release PR or publish JavaScript package

**Triggers**: When `has_changesets == 'true'`

**Steps**:

- Version bumping via Changesets
- Publish to npm with provenance
- Generate enhanced release notes
- Create GitHub Release
- Verify publication
- Test installation
- Send notifications

### 3. `release-ruby`

**Purpose**: Publish Ruby gem

**Triggers**: When `ruby_changed == 'true'`

**Steps**:

- Security audit
- Build validation
- Tag creation
- Publish to RubyGems (OIDC)
- Verify publication
- Test installation
- Create GitHub Release
- Send notifications

### 4. `rollback`

**Purpose**: Assist with rolling back problematic releases

**Triggers**: Manual workflow dispatch

**Steps**:

- Validate rollback request
- Create tracking issue
- Provide deprecation instructions
- Document required manual steps

## Security Features

### Supply Chain Security

- **NPM Provenance**: Automatic attestations linking packages to source
- **OIDC Authentication**: For RubyGems and npm publishing
- **Dependency Auditing**: Automated vulnerability scanning
- **Build Verification**: Ensures artifacts match expected output

### Credentials Management

Required secrets:

- `GITHUB_TOKEN`: Automatically provided, used for releases
- `NPM_TOKEN`: Not required (uses OIDC with provenance)
- Ruby publishing uses OIDC (no secrets needed)

## Troubleshooting

### Release Workflow Fails at Changeset Status

**Issue**: `jq: parse error: Invalid numeric literal`

**Solution**: Already fixed! The workflow now:

- Pre-checks for changeset files
- Validates JSON before parsing
- Provides clear error messages

### Package Not Found After Publishing

**Causes**:

- Registry propagation delay (normal, wait 10-30 seconds)
- Authentication issues
- Network problems

**Solution**: The workflow waits and retries verification

### Security Vulnerabilities Block Release

**Response**:

- Review vulnerability report in workflow logs
- Assess severity and impact
- Update dependencies if critical
- Document decision if accepting risk

### Rollback Needed

**Process**:

1. Trigger rollback workflow
2. Follow checklist in created issue
3. For npm: `npm deprecate package@version "message"`
4. For RubyGems: Contact support within 24 hours
5. Delete GitHub release and tag
6. Create fix and new release

## Customization

### Adding Notification Channels

Edit notification steps in [.github/workflows/release.yml](.github/workflows/release.yml):

```javascript
// Add Discord webhook
await fetch(process.env.DISCORD_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content: `🚀 New release: v${version}`,
  }),
});
```

### Customizing Release Notes

Modify the `Generate release notes` step to include:

- Performance metrics
- Migration guides
- Breaking changes highlights
- Contributor acknowledgments

## Best Practices

1. **Always test locally first**:

   ```bash
   pnpm release:check
   pnpm test
   pnpm build
   ```

2. **Use semantic versioning**:
   - Major: Breaking changes
   - Minor: New features (backward compatible)
   - Patch: Bug fixes

3. **Write clear changeset descriptions**:

   ```bash
   pnpm changeset
   # Choose appropriate bump type
   # Write user-facing description
   ```

4. **Review Release PRs carefully**:
   - Check version bumps are correct
   - Verify changelog accuracy
   - Ensure all changesets are included

5. **Monitor releases**:
   - Watch workflow logs
   - Verify package availability
   - Check release notes accuracy

## References

- [Changesets Documentation](https://github.com/changesets/changesets)
- [NPM Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [RubyGems Publishing](https://guides.rubygems.org/publishing/)
- [GitHub Actions](https://docs.github.com/en/actions)
