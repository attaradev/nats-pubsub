#!/bin/bash
# Common functions for release scripts
# Source this file in other scripts: source "$(dirname "$0")/common.sh"

# Strict error handling
set -euo pipefail

# Colors for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# Script directory and root directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Package paths
readonly JS_PACKAGE_DIR="$ROOT_DIR/packages/javascript"
readonly RUBY_PACKAGE_DIR="$ROOT_DIR/packages/ruby"
readonly JS_PACKAGE_JSON="$JS_PACKAGE_DIR/package.json"
readonly RUBY_VERSION_FILE="$RUBY_PACKAGE_DIR/lib/nats_pubsub/version.rb"
readonly RUBY_CHANGELOG="$RUBY_PACKAGE_DIR/CHANGELOG.md"
readonly CHANGESET_DIR="$ROOT_DIR/.changeset"

# Logging functions with colors
log_info() {
  echo -e "${COLOR_BLUE}ℹ️  $*${COLOR_RESET}"
}

log_success() {
  echo -e "${COLOR_GREEN}✅ $*${COLOR_RESET}"
}

log_warning() {
  echo -e "${COLOR_YELLOW}⚠️  $*${COLOR_RESET}"
}

log_error() {
  echo -e "${COLOR_RED}❌ $*${COLOR_RESET}" >&2
}

# Check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Require a command to exist or exit with error
require_command() {
  local cmd=$1
  local install_hint=${2:-"Please install $cmd"}

  if ! command_exists "$cmd"; then
    log_error "$cmd is not installed"
    log_info "$install_hint"
    return 1
  fi
  return 0
}

# Get JavaScript package version
get_js_version() {
  if [ -f "$JS_PACKAGE_JSON" ]; then
    node -p "require('$JS_PACKAGE_JSON').version" 2>/dev/null || echo "0.0.0"
  else
    echo "0.0.0"
  fi
}

# Get Ruby gem version
get_ruby_version() {
  if [ -f "$RUBY_VERSION_FILE" ]; then
    grep -oP "VERSION = '\K[^']+" "$RUBY_VERSION_FILE" 2>/dev/null || echo "0.0.0"
  else
    echo "0.0.0"
  fi
}

# Count pending changesets
count_changesets() {
  if [ -d "$CHANGESET_DIR" ]; then
    find "$CHANGESET_DIR" -name "*.md" -not -name "README.md" 2>/dev/null | wc -l | tr -d ' '
  else
    echo "0"
  fi
}

# Validate semver format
validate_semver() {
  local version=$1
  if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
    log_error "Invalid semver format: $version"
    return 1
  fi
  return 0
}

# Compare versions (returns 0 if v1 > v2)
version_gt() {
  test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Get current git branch
get_current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Check if git working directory is clean
is_git_clean() {
  [ -z "$(git status --porcelain 2>/dev/null)" ]
}

# Get latest git tag for a package
get_latest_tag() {
  local package=$1  # "javascript" or "ruby"
  git describe --tags --abbrev=0 --match "${package}-v*" 2>/dev/null || echo "No tags yet"
}

# Check Node.js version requirement
check_node_version() {
  local min_version=${1:-20}

  if ! require_command node "Install Node.js from https://nodejs.org"; then
    return 1
  fi

  local node_major
  node_major=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

  if [ "$node_major" -lt "$min_version" ]; then
    log_warning "Node.js ${min_version}+ recommended (current: v${node_major})"
    return 1
  fi

  return 0
}

# Print a section header
print_header() {
  local title=$1
  local length=${#title}
  local separator
  separator=$(printf '=%.0s' $(seq 1 $((length + 4))))

  echo ""
  echo "$separator"
  echo "  $title"
  echo "$separator"
  echo ""
}

# Print a subsection
print_section() {
  echo ""
  echo "📋 $*"
}

# Ensure we're in the repository root
ensure_repo_root() {
  if [ ! -d "$ROOT_DIR/.git" ]; then
    log_error "Must be run from within a git repository"
    return 1
  fi
  cd "$ROOT_DIR" || return 1
}

# Run command in a specific directory
run_in_dir() {
  local dir=$1
  shift
  (cd "$dir" && "$@")
}

# Check if changesets are initialized
ensure_changesets() {
  if [ ! -d "$CHANGESET_DIR" ]; then
    log_error "Changesets not initialized"
    log_info "Run: pnpm changeset init"
    return 1
  fi
  return 0
}
