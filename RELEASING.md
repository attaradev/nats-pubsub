# Release Process

This guide describes how to release packages in the NatsPubsub monorepo.

## Quick Start

### For Contributors

When making changes that affect package functionality:

```bash
# Create a changeset describing your changes
pnpm changeset

# Commit with your code changes
git add .changeset/
git commit -m "feat: your feature"
git push
```

### For Maintainers

1. Merge PR → Changesets bot creates "Version Packages" PR
2. Review the automated PR → Merge it
3. Packages are automatically published

## Creating Changesets

Run `pnpm changeset` and follow the prompts:

1. **Select packages** - Choose affected package(s)
2. **Select bump type** - Major, minor, or patch
3. **Write summary** - User-facing description

### When to Create a Changeset

✅ **Yes:**

- New features
- Bug fixes
- Breaking changes
- Performance improvements

❌ **No:**

- Documentation updates
- Internal refactoring
- Test-only changes

### Writing Good Summaries

**Good:**

```md
Add custom retry configuration

Users can now configure retry behavior with maxRetries and retryDelay options.
```

**Bad:**

```md
Update Publisher
```

**Breaking change:**

```md
BREAKING: Rename connect() to initialize()

Migration: Replace client.connect() with client.initialize()
```

## Release Workflow

### Automated (Recommended)

1. **Developer creates changeset:**

   ```bash
   pnpm changeset
   ```

2. **PR is merged to develop**

3. **Changesets bot creates Release PR:**
   - Updates package versions
   - Generates changelogs
   - Ready for review

4. **Maintainer merges Release PR:**
   - JavaScript package published to npm
   - Ruby package version updated (manual publish needed)
   - GitHub releases created

### Manual Release

For emergency releases or when automation isn't suitable:

```bash
# JavaScript
cd packages/javascript
pnpm version <major|minor|patch>
pnpm build
pnpm publish --access public

# Ruby
cd packages/ruby
# Edit lib/nats_pubsub/version.rb
gem build nats_pubsub.gemspec
gem push nats_pubsub-*.gem
```

Or use GitHub Actions manual workflows:

- **Actions → JavaScript Release**
- **Actions → Ruby Release**

## Version Policies

### Semantic Versioning

- **Major (1.0.0 → 2.0.0)** - Breaking changes
- **Minor (1.0.0 → 1.1.0)** - New features
- **Patch (1.0.0 → 1.0.1)** - Bug fixes

### When to Bump Major

- Removing public APIs
- Changing method signatures
- Changing default behavior
- Updating minimum version requirements

## Useful Commands

```bash
# Check release status
pnpm release:status

# Preview what will be released
pnpm release:preview

# Run pre-release checks
pnpm release:check

# Create changeset
pnpm changeset
```

## Troubleshooting

### No changesets to release

Create a changeset:

```bash
pnpm changeset
```

### Version already exists

The version is already published. Wait for next change or manually bump version.

### Permission denied publishing

- **npm:** Check `NPM_TOKEN` in GitHub Secrets
- **RubyGems:** Verify trusted publishing configuration

### npm EOTP error (2FA/OTP required)

If you see `EOTP This operation requires a one-time password`:

1. **Use an Automation Token (Recommended)**
   - Go to https://www.npmjs.com/settings/[username]/tokens
   - Create a new **Automation** token (not Classic or Publish)
   - Update GitHub secret `NPM_TOKEN` with the new token
   - Automation tokens bypass 2FA for CI/CD

2. **Alternative: Use Granular Access Token**
   - Create a Granular Access Token with publish permissions
   - These tokens work with 2FA in CI/CD environments

**Note:** Classic tokens with 2FA enabled cannot be used in automated publishing workflows without OTP.

### Release PR not created

- Check workflow logs in Actions tab
- Manually create version: `pnpm changeset version`

## Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## Questions?

- Open an issue for release questions
- Contact: <mpyebattara@gmail.com>
