#!/bin/bash
# Release Check - Verify release requirements

set -e

echo "🔍 Release Requirements Check"
echo "=============================="
echo ""

ERRORS=0
WARNINGS=0

# Check Git status
echo "📋 Checking Git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "  ⚠️  Warning: Working directory has uncommitted changes"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✅ Working directory is clean"
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo ""
echo "📋 Checking branch..."
echo "  Current branch: $CURRENT_BRANCH"
if [ "$CURRENT_BRANCH" != "develop" ] && [ "$CURRENT_BRANCH" != "main" ]; then
  echo "  ⚠️  Warning: Not on develop or main branch"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✅ On release branch"
fi

# Check for changesets
echo ""
echo "📋 Checking changesets..."
if [ ! -d ".changeset" ]; then
  echo "  ❌ ERROR: Changesets not initialized"
  ERRORS=$((ERRORS + 1))
else
  CHANGESET_COUNT=$(find .changeset -name "*.md" -not -name "README.md" | wc -l | tr -d ' ')
  if [ "$CHANGESET_COUNT" -eq 0 ]; then
    echo "  ⚠️  Warning: No pending changesets"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  ✅ Found $CHANGESET_COUNT pending changeset(s)"
  fi
fi

# Check Node.js version
echo ""
echo "📋 Checking Node.js..."
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version)
  echo "  ✅ Node.js installed: $NODE_VERSION"

  # Check if version meets minimum requirement
  NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "  ⚠️  Warning: Node.js 20+ recommended (current: v$NODE_MAJOR)"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "  ❌ ERROR: Node.js not installed"
  ERRORS=$((ERRORS + 1))
fi

# Check pnpm
echo ""
echo "📋 Checking pnpm..."
if command -v pnpm >/dev/null 2>&1; then
  PNPM_VERSION=$(pnpm --version)
  echo "  ✅ pnpm installed: v$PNPM_VERSION"
else
  echo "  ❌ ERROR: pnpm not installed"
  ERRORS=$((ERRORS + 1))
fi

# Check Ruby (for Ruby package)
echo ""
echo "📋 Checking Ruby..."
if command -v ruby >/dev/null 2>&1; then
  RUBY_VERSION=$(ruby --version | awk '{print $2}')
  echo "  ✅ Ruby installed: v$RUBY_VERSION"
else
  echo "  ⚠️  Warning: Ruby not installed (required for Ruby package releases)"
  WARNINGS=$((WARNINGS + 1))
fi

# Check if tests pass
echo ""
echo "📋 Checking JavaScript tests..."
cd packages/javascript
if pnpm test >/dev/null 2>&1; then
  echo "  ✅ JavaScript tests passing"
else
  echo "  ⚠️  Warning: JavaScript tests failing"
  WARNINGS=$((WARNINGS + 1))
fi
cd ../..

# Check if builds succeed
echo ""
echo "📋 Checking JavaScript build..."
cd packages/javascript
if pnpm build >/dev/null 2>&1; then
  echo "  ✅ JavaScript build successful"
else
  echo "  ❌ ERROR: JavaScript build failed"
  ERRORS=$((ERRORS + 1))
fi
cd ../..

# Check for NPM token (if publishing)
echo ""
echo "📋 Checking credentials..."
if [ -z "$NPM_TOKEN" ]; then
  echo "  ⚠️  Warning: NPM_TOKEN not set (required for npm publishing)"
  echo "     Set in GitHub Secrets or .env file"
  WARNINGS=$((WARNINGS + 1))
else
  echo "  ✅ NPM_TOKEN is set"
fi

# Summary
echo ""
echo "=============================="
echo "📊 Summary"
echo "=============================="
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ $ERRORS error(s) found - Cannot proceed with release"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  $WARNINGS warning(s) found - Review before releasing"
  exit 0
else
  echo "✅ All checks passed - Ready to release!"
  exit 0
fi
