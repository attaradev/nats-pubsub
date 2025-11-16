#!/bin/bash
# Release Preview - Show what versions will be released

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# Main function
main() {
  ensure_repo_root || exit 1
  ensure_changesets || exit 1
  require_command pnpm "Install pnpm: npm install -g pnpm" || exit 1

  print_header "🔮 Release Preview for NatsPubsub Monorepo"

  # Get changeset count
  local changeset_count
  changeset_count=$(count_changesets)

  if [ "$changeset_count" -eq 0 ]; then
    log_success "No pending changesets to release"
    exit 0
  fi

  echo "📝 Found $changeset_count pending changeset(s)"
  show_current_versions
  analyze_changesets
  show_next_steps
}

# Show current package versions
show_current_versions() {
  print_section "Current Versions"

  # JavaScript version
  if require_command node >/dev/null 2>&1 && [ -f "$JS_PACKAGE_JSON" ]; then
    local js_version
    js_version=$(get_js_version)
    echo "  JavaScript (npm): v$js_version"
  fi

  # Ruby version
  if [ -f "$RUBY_VERSION_FILE" ]; then
    local ruby_version
    ruby_version=$(get_ruby_version)
    echo "  Ruby (gem): v$ruby_version"
  fi
}

# Analyze changesets
analyze_changesets() {
  print_section "Analyzing changesets..."
  echo ""

  # Run changeset status
  pnpm changeset status

  echo ""
  log_info "Note: Ruby package versions are manually managed."
  echo "     JavaScript versions will be updated automatically by Changesets."
}

# Show next steps
show_next_steps() {
  echo ""
  echo "To proceed:"
  echo "  1. Review the changesets above"
  echo "  2. Merge to develop branch to create Release PR"
  echo "  3. Review and merge Release PR to trigger publishing"
  echo ""
}

# Run main function
main "$@"
