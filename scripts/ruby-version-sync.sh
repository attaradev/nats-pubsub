#!/bin/bash
# Ruby Version Sync Script
# Syncs Ruby version from changesets or validates manual version updates

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# Main function
main() {
  ensure_repo_root || exit 1

  print_header "🔍 Ruby Version Sync & Validation"

  local current_version
  current_version=$(get_ruby_version)

  echo "Current version: $current_version"
  echo ""

  # Validate semver format
  if ! validate_semver "$current_version"; then
    exit 1
  fi

  # Run appropriate validation based on environment
  if [ -n "${CI:-}" ]; then
    validate_ci_environment "$current_version"
  else
    validate_local_environment "$current_version"
  fi

  print_version_summary "$current_version"
}

# Validate in CI environment
validate_ci_environment() {
  local current_version=$1

  echo "Running in CI environment"
  echo ""

  # Get previous version from git
  if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
    log_warning "No previous commit found, skipping version comparison"
    return
  fi

  local prev_version
  prev_version=$(get_previous_ruby_version)
  echo "Previous version: $prev_version"

  # Check if version changed
  if [ "$current_version" = "$prev_version" ]; then
    log_info "Version unchanged, no release needed"
    return
  fi

  log_success "Version changed: $prev_version → $current_version"

  # Validate version bump
  if ! version_gt "$current_version" "$prev_version"; then
    log_error "New version must be greater than previous version"
    exit 1
  fi

  # Check if version exists on RubyGems
  check_rubygems_availability "$current_version" || exit 1

  # Check if CHANGELOG updated
  check_changelog_updated "$current_version"

  echo ""
  log_success "Ruby version validation passed!"
  echo "Ready to release ruby-v$current_version"
}

# Validate in local environment
validate_local_environment() {
  local current_version=$1

  echo "Running locally"
  echo ""

  # Check if version is valid
  log_success "Version format is valid"

  # Optionally check RubyGems
  if require_command gem >/dev/null 2>&1; then
    check_rubygems_availability "$current_version" || true
  fi
}

# Get previous Ruby version from git
get_previous_ruby_version() {
  git show HEAD~1:"$RUBY_VERSION_FILE" 2>/dev/null | \
    grep -oP "VERSION = '\K[^']+" || echo "0.0.0"
}

# Check if version exists on RubyGems
check_rubygems_availability() {
  local version=$1

  if ! require_command gem >/dev/null 2>&1; then
    log_warning "gem command not available, skipping RubyGems check"
    return 0
  fi

  echo "Checking RubyGems for version $version..."

  if gem list -r nats_pubsub --exact 2>/dev/null | grep -q "($version)"; then
    log_error "Version $version already exists on RubyGems"
    log_error "Cannot release: version already published"
    return 1
  else
    log_success "Version $version is available"
    return 0
  fi
}

# Check if CHANGELOG was updated for the version
check_changelog_updated() {
  local version=$1

  if [ ! -f "$RUBY_CHANGELOG" ]; then
    log_warning "CHANGELOG.md not found"
    return
  fi

  if git diff HEAD~1 HEAD -- "$RUBY_CHANGELOG" 2>/dev/null | grep -q "^+.*$version"; then
    log_success "CHANGELOG.md updated for version $version"
  else
    log_warning "CHANGELOG.md may not be updated for version $version"
  fi
}

# Print version summary
print_version_summary() {
  local version=$1

  echo ""
  echo "=================================="
  echo "Version: $version"
  echo "=================================="
}

# Run main function
main "$@"
