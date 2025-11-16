#!/bin/bash
# Release Check - Verify release requirements

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# Global counters
ERRORS=0
WARNINGS=0

# Increment error counter and log
add_error() {
  log_error "$*"
  ERRORS=$((ERRORS + 1))
}

# Increment warning counter and log
add_warning() {
  log_warning "$*"
  WARNINGS=$((WARNINGS + 1))
}

# Main function
main() {
  ensure_repo_root || exit 1

  print_header "🔍 Release Requirements Check"

  check_git_status
  check_git_branch
  check_changesets
  check_nodejs
  check_pnpm
  check_ruby
  check_javascript_tests
  check_javascript_build
  check_credentials

  print_summary
}

# Check Git working directory status
check_git_status() {
  print_section "Checking Git status..."

  if is_git_clean; then
    log_success "Working directory is clean"
  else
    add_warning "Working directory has uncommitted changes"
  fi
}

# Check current Git branch
check_git_branch() {
  print_section "Checking branch..."

  local current_branch
  current_branch=$(get_current_branch)
  echo "  Current branch: $current_branch"

  if [ "$current_branch" != "develop" ] && [ "$current_branch" != "main" ]; then
    add_warning "Not on develop or main branch"
  else
    log_success "On release branch"
  fi
}

# Check for changesets
check_changesets() {
  print_section "Checking changesets..."

  if ! ensure_changesets 2>/dev/null; then
    add_error "Changesets not initialized"
    return
  fi

  local changeset_count
  changeset_count=$(count_changesets)

  if [ "$changeset_count" -eq 0 ]; then
    add_warning "No pending changesets"
  else
    log_success "Found $changeset_count pending changeset(s)"
  fi
}

# Check Node.js installation and version
check_nodejs() {
  print_section "Checking Node.js..."

  if ! require_command node "Install Node.js from https://nodejs.org"; then
    add_error "Node.js not installed"
    return
  fi

  local node_version
  node_version=$(node --version)
  log_success "Node.js installed: $node_version"

  # Check minimum version
  if ! check_node_version 20 2>/dev/null; then
    local node_major
    node_major=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    add_warning "Node.js 20+ recommended (current: v$node_major)"
  fi
}

# Check pnpm installation
check_pnpm() {
  print_section "Checking pnpm..."

  if ! require_command pnpm "Install pnpm: npm install -g pnpm"; then
    add_error "pnpm not installed"
    return
  fi

  local pnpm_version
  pnpm_version=$(pnpm --version)
  log_success "pnpm installed: v$pnpm_version"
}

# Check Ruby installation (optional for Ruby releases)
check_ruby() {
  print_section "Checking Ruby..."

  if ! require_command ruby "Install Ruby from https://www.ruby-lang.org"; then
    add_warning "Ruby not installed (required for Ruby package releases)"
    return
  fi

  local ruby_version
  ruby_version=$(ruby --version | awk '{print $2}')
  log_success "Ruby installed: v$ruby_version"
}

# Check JavaScript tests
check_javascript_tests() {
  print_section "Checking JavaScript tests..."

  if [ ! -d "$JS_PACKAGE_DIR" ]; then
    add_warning "JavaScript package not found"
    return
  fi

  if run_in_dir "$JS_PACKAGE_DIR" pnpm test >/dev/null 2>&1; then
    log_success "JavaScript tests passing"
  else
    add_warning "JavaScript tests failing"
  fi
}

# Check JavaScript build
check_javascript_build() {
  print_section "Checking JavaScript build..."

  if [ ! -d "$JS_PACKAGE_DIR" ]; then
    add_warning "JavaScript package not found"
    return
  fi

  if run_in_dir "$JS_PACKAGE_DIR" pnpm build >/dev/null 2>&1; then
    log_success "JavaScript build successful"
  else
    add_error "JavaScript build failed"
  fi
}

# Check publishing credentials
check_credentials() {
  print_section "Checking credentials..."

  if [ -z "${NPM_TOKEN:-}" ]; then
    add_warning "NPM_TOKEN not set (required for npm publishing)"
    echo "     Set in GitHub Secrets or .env file"
  else
    log_success "NPM_TOKEN is set"
  fi
}

# Print summary and exit with appropriate code
print_summary() {
  print_header "📊 Summary"

  if [ "$ERRORS" -gt 0 ]; then
    log_error "$ERRORS error(s) found - Cannot proceed with release"
    exit 1
  elif [ "$WARNINGS" -gt 0 ]; then
    log_warning "$WARNINGS warning(s) found - Review before releasing"
    exit 0
  else
    log_success "All checks passed - Ready to release!"
    exit 0
  fi
}

# Run main function
main "$@"
