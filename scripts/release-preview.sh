#!/bin/bash
# Release Preview - Show what versions will be released

set -e

echo "🔮 Release Preview for NatsPubsub Monorepo"
echo "==========================================="
echo ""

# Check if changesets exist
if [ ! -d ".changeset" ]; then
  echo "❌ Changesets not initialized. Run: pnpm changeset init"
  exit 1
fi

# Count pending changesets
CHANGESET_COUNT=$(find .changeset -name "*.md" -not -name "README.md" | wc -l | tr -d ' ')

if [ "$CHANGESET_COUNT" -eq 0 ]; then
  echo "✅ No pending changesets to release"
  exit 0
fi

echo "📝 Found $CHANGESET_COUNT pending changeset(s)"
echo ""

# Show current versions
echo "📊 Current Versions:"
echo ""

if [ -f "packages/javascript/package.json" ]; then
  JS_VERSION=$(node -p "require('./packages/javascript/package.json').version")
  echo "  JavaScript (npm): v$JS_VERSION"
fi

if [ -f "packages/ruby/lib/nats_pubsub/version.rb" ]; then
  RUBY_VERSION=$(ruby -e "require_relative 'packages/ruby/lib/nats_pubsub/version.rb'; puts NatsPubsub::VERSION")
  echo "  Ruby (gem): v$RUBY_VERSION"
fi

echo ""
echo "🔍 Analyzing changesets..."
echo ""

# Run changeset status
pnpm changeset status

echo ""
echo "💡 Note: Ruby package versions are manually managed."
echo "   JavaScript versions will be updated automatically by Changesets."
echo ""
echo "To proceed:"
echo "  1. Review the changesets above"
echo "  2. Merge to develop branch to create Release PR"
echo "  3. Review and merge Release PR to trigger publishing"
echo ""
