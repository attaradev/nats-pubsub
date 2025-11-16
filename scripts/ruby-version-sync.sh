#!/bin/bash
# Ruby Version Sync Script
# Syncs Ruby version from changesets or validates manual version updates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUBY_VERSION_FILE="$ROOT_DIR/packages/ruby/lib/nats_pubsub/version.rb"
RUBY_CHANGELOG="$ROOT_DIR/packages/ruby/CHANGELOG.md"

echo "🔍 Ruby Version Sync & Validation"
echo "=================================="
echo ""

# Extract current Ruby version
get_ruby_version() {
  if [ -f "$RUBY_VERSION_FILE" ]; then
    grep -oP "VERSION = '\K[^']+" "$RUBY_VERSION_FILE" || echo "0.0.0"
  else
    echo "0.0.0"
  fi
}

# Validate semver format
validate_semver() {
  local version=$1
  if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
    echo "❌ Invalid semver format: $version"
    return 1
  fi
  return 0
}

# Check if version exists on RubyGems
check_rubygems_version() {
  local version=$1
  echo "Checking RubyGems for version $version..."

  if gem list -r nats_pubsub --exact | grep -q "($version)"; then
    echo "⚠️  Version $version already exists on RubyGems"
    return 1
  else
    echo "✅ Version $version is available"
    return 0
  fi
}

# Compare versions (returns 0 if v1 > v2)
version_gt() {
  test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Main validation
CURRENT_VERSION=$(get_ruby_version)
echo "Current version: $CURRENT_VERSION"
echo ""

# Validate semver
if ! validate_semver "$CURRENT_VERSION"; then
  exit 1
fi

# Check if this is a CI environment
if [ -n "$CI" ]; then
  echo "Running in CI environment"

  # Get previous version from git
  if git rev-parse HEAD~1 >/dev/null 2>&1; then
    PREV_VERSION=$(git show HEAD~1:"$RUBY_VERSION_FILE" 2>/dev/null | grep -oP "VERSION = '\K[^']+" || echo "0.0.0")
    echo "Previous version: $PREV_VERSION"

    # Check if version changed
    if [ "$CURRENT_VERSION" != "$PREV_VERSION" ]; then
      echo "✅ Version changed: $PREV_VERSION → $CURRENT_VERSION"

      # Validate version bump
      if ! version_gt "$CURRENT_VERSION" "$PREV_VERSION"; then
        echo "❌ New version must be greater than previous version"
        exit 1
      fi

      # Check if version exists on RubyGems
      if ! check_rubygems_version "$CURRENT_VERSION"; then
        echo "❌ Cannot release: version already published"
        exit 1
      fi

      # Check if CHANGELOG updated
      if git diff HEAD~1 HEAD -- "$RUBY_CHANGELOG" | grep -q "^+.*$CURRENT_VERSION"; then
        echo "✅ CHANGELOG.md updated for version $CURRENT_VERSION"
      else
        echo "⚠️  Warning: CHANGELOG.md may not be updated for version $CURRENT_VERSION"
      fi

      echo ""
      echo "✅ Ruby version validation passed!"
      echo "Ready to release ruby-v$CURRENT_VERSION"

    else
      echo "ℹ️  Version unchanged, no release needed"
    fi
  fi
else
  echo "Running locally"

  # Check if version is valid
  echo "✅ Version format is valid"

  # Optionally check RubyGems
  if command -v gem >/dev/null 2>&1; then
    check_rubygems_version "$CURRENT_VERSION" || true
  fi
fi

echo ""
echo "=================================="
echo "Version: $CURRENT_VERSION"
echo "=================================="
