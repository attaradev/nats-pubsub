#!/bin/bash
# Release Status - Show what's pending release

set -e

echo "📦 Release Status for NatsPubsub Monorepo"
echo "=========================================="
echo ""

# Check if changesets exist
if [ ! -d ".changeset" ]; then
  echo "❌ Changesets not initialized. Run: pnpm changeset init"
  exit 1
fi

# Count pending changesets
CHANGESET_COUNT=$(find .changeset -name "*.md" -not -name "README.md" | wc -l | tr -d ' ')

if [ "$CHANGESET_COUNT" -eq 0 ]; then
  echo "✅ No pending changesets"
  echo ""
  echo "📊 Current Versions:"
  echo ""

  # Show current JavaScript version
  if [ -f "packages/javascript/package.json" ]; then
    JS_VERSION=$(node -p "require('./packages/javascript/package.json').version")
    echo "  JavaScript (npm): v$JS_VERSION"
    echo "    Latest tag: $(git describe --tags --abbrev=0 --match "javascript-v*" 2>/dev/null || echo "No tags yet")"
  fi

  # Show current Ruby version
  if [ -f "packages/ruby/lib/nats_pubsub/version.rb" ]; then
    RUBY_VERSION=$(ruby -e "require_relative 'packages/ruby/lib/nats_pubsub/version.rb'; puts NatsPubsub::VERSION")
    echo "  Ruby (gem): v$RUBY_VERSION"
    echo "    Latest tag: $(git describe --tags --abbrev=0 --match "ruby-v*" 2>/dev/null || echo "No tags yet")"
  fi

  echo ""
  echo "💡 To prepare a release, run: pnpm changeset"
else
  echo "📝 Pending Changesets: $CHANGESET_COUNT"
  echo ""

  # Run changesets status
  pnpm changeset status --verbose

  echo ""
  echo "💡 To create a release PR, merge these changes to develop"
  echo "💡 To preview versions, run: pnpm release:preview"
fi

echo ""
