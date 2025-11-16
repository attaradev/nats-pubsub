#!/bin/bash
# Release Status - Show what's pending release

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# Main function
main() {
  ensure_repo_root || exit 1
  ensure_changesets || exit 1

  print_header "📦 Release Status for NatsPubsub Monorepo"

  # Get changeset count
  local changeset_count
  changeset_count=$(count_changesets)

  if [ "$changeset_count" -eq 0 ]; then
    log_success "No pending changesets"
    show_current_versions
    echo ""
    log_info "To prepare a release, run: pnpm changeset"
  else
    echo "📝 Pending Changesets: $changeset_count"
    echo ""

    # Require pnpm for changeset status
    if require_command pnpm "Install pnpm: npm install -g pnpm"; then
      pnpm changeset status --verbose
    fi

    echo ""
    log_info "To create a release PR, merge these changes to develop"
    log_info "To preview versions, run: pnpm release:preview"
  fi

  echo ""
}

# Show current package versions
show_current_versions() {
  print_section "Current Versions"

  # JavaScript version
  if require_command node >/dev/null 2>&1 && [ -f "$JS_PACKAGE_JSON" ]; then
    local js_version
    js_version=$(get_js_version)
    echo "  JavaScript (npm): v$js_version"
    echo "    Latest tag: $(get_latest_tag javascript)"
  fi

  # Ruby version
  if [ -f "$RUBY_VERSION_FILE" ]; then
    local ruby_version
    ruby_version=$(get_ruby_version)
    echo "  Ruby (gem): v$ruby_version"
    echo "    Latest tag: $(get_latest_tag ruby)"
  fi
}

# Run main function
main "$@"
