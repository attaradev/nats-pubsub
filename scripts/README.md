# Release Management Scripts

This directory contains helper scripts for managing releases in the NatsPubsub monorepo.

## Available Scripts

### 📊 release-status.sh

Shows the current release status, including pending changesets and current package versions.

```bash
pnpm release:status
# or
./scripts/release-status.sh
```

**Output:**
- Number of pending changesets
- Current versions of both packages
- Latest git tags
- Next steps

### 🔮 release-preview.sh

Preview what versions will be released based on pending changesets.

```bash
pnpm release:preview
# or
./scripts/release-preview.sh
```

**Output:**
- Current versions
- Pending changesets analysis
- Expected version bumps
- Release instructions

### 🔍 release-check.sh

Run pre-release checks to ensure everything is ready for a release.

```bash
pnpm release:check
# or
./scripts/release-check.sh
```

**Checks:**
- ✅ Git working directory status
- ✅ Current branch validation
- ✅ Pending changesets
- ✅ Node.js and pnpm installation
- ✅ Ruby installation (for Ruby releases)
- ✅ Test execution
- ✅ Build success
- ✅ Credentials configuration

**Exit codes:**
- `0` - All checks passed or warnings only
- `1` - Critical errors found

## Usage Workflow

### Before Creating a Changeset

```bash
# Check current status
pnpm release:status
```

### After Creating Changesets

```bash
# Preview what will be released
pnpm release:preview

# Run pre-release checks
pnpm release:check
```

### Before Merging Release PR

```bash
# Final verification
pnpm release:check
```

## Script Requirements

All scripts require:
- Bash shell
- Git installed and repository initialized
- pnpm installed (for JavaScript package)
- Node.js installed (for JavaScript package)
- Ruby installed (for Ruby package, optional)

## Troubleshooting

### "Permission denied" when running scripts

Make scripts executable:

```bash
chmod +x scripts/*.sh
```

### "command not found: node"

Install Node.js:

```bash
# Using nvm
nvm install 24

# Using package manager
brew install node  # macOS
```

### "command not found: pnpm"

Install pnpm:

```bash
npm install -g pnpm
```

### Ruby not found

Install Ruby (for Ruby package releases):

```bash
# Using rbenv
rbenv install 3.2.0

# Using package manager
brew install ruby  # macOS
```

## Adding New Scripts

When adding new release scripts:

1. Create the script in this directory
2. Make it executable: `chmod +x scripts/your-script.sh`
3. Add error handling: `set -e` at the top
4. Add helpful output with emojis for better UX
5. Update this README
6. Add npm script alias in root `package.json`

## Related Documentation

- [RELEASING.md](../RELEASING.md) - Complete release process guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [Changesets Documentation](https://github.com/changesets/changesets)
