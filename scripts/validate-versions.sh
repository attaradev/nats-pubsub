#!/bin/bash
# Version Validation Script
# Validates version changes in package.json and version.rb files

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# Main function
main() {
  ensure_repo_root || exit 1

  local errors=0

  # Check if version files have been modified
  local modified_files
  modified_files=$(git diff --cached --name-only)

  # Validate JavaScript package.json
  if echo "$modified_files" | grep -q "packages/javascript/package.json"; then
    validate_js_version || errors=$((errors + 1))
  fi

  # Validate Ruby version.rb
  if echo "$modified_files" | grep -q "packages/ruby/lib/nats_pubsub/version.rb"; then
    validate_ruby_version || errors=$((errors + 1))
  fi

  if [ $errors -gt 0 ]; then
    echo ""
    log_error "Version validation failed with $errors error(s)"
    exit 1
  fi

  return 0
}

# Validate JavaScript version
validate_js_version() {
  print_section "Validating JavaScript version..."

  local current_version
  current_version=$(get_js_version)

  # Validate semver format
  if ! validate_semver "$current_version"; then
    log_error "Invalid JavaScript version format: $current_version"
    return 1
  fi

  # Get previous version from git
  if git rev-parse HEAD >/dev/null 2>&1; then
    local prev_version
    prev_version=$(git show HEAD:packages/javascript/package.json 2>/dev/null | grep '"version"' | cut -d'"' -f4 || echo "0.0.0")

    # Check if version changed
    if [ "$current_version" != "$prev_version" ]; then
      # Ensure new version is greater
      if ! version_gt "$current_version" "$prev_version"; then
        log_error "JavaScript version must be greater than previous: $prev_version"
        log_error "Current version: $current_version"
        return 1
      fi

      log_success "JavaScript version bump valid: $prev_version → $current_version"

      # Check if corresponding changeset exists
      if [ "$(count_changesets)" -eq 0 ]; then
        log_warning "No changeset found for version bump"
        log_warning "Consider running: pnpm changeset"
      fi
    fi
  fi

  log_success "JavaScript version is valid: $current_version"
  return 0
}

# Validate Ruby version
validate_ruby_version() {
  print_section "Validating Ruby version..."

  local current_version
  current_version=$(get_ruby_version)

  # Validate semver format
  if ! validate_semver "$current_version"; then
    log_error "Invalid Ruby version format: $current_version"
    return 1
  fi

  # Get previous version from git
  if git rev-parse HEAD >/dev/null 2>&1; then
    local prev_version
    prev_version=$(git show HEAD:packages/ruby/lib/nats_pubsub/version.rb 2>/dev/null | grep -oP "VERSION = '\K[^']+" || echo "0.0.0")

    # Check if version changed
    if [ "$current_version" != "$prev_version" ]; then
      # Ensure new version is greater
      if ! version_gt "$current_version" "$prev_version"; then
        log_error "Ruby version must be greater than previous: $prev_version"
        log_error "Current version: $current_version"
        return 1
      fi

      log_success "Ruby version bump valid: $prev_version → $current_version"

      # Check if CHANGELOG was updated
      if git diff --cached --name-only | grep -q "packages/ruby/CHANGELOG.md"; then
        log_success "CHANGELOG.md updated"
      else
        log_warning "CHANGELOG.md not updated"
        log_warning "Consider running: ./scripts/ruby-changelog.sh"
      fi
    fi
  fi

  log_success "Ruby version is valid: $current_version"
  return 0
}

# Run main function
main "$@"
