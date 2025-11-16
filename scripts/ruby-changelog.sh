#!/bin/bash
# Ruby CHANGELOG Generator
# Generates or updates CHANGELOG.md for Ruby package based on git tags and commits

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "$SCRIPT_DIR/common.sh"

# Configuration
readonly CHANGELOG_FILE="$RUBY_PACKAGE_DIR/CHANGELOG.md"
readonly TEMP_CHANGELOG="/tmp/ruby-changelog-$$"

# Main function
main() {
  ensure_repo_root || exit 1

  local version=${1:-}

  if [ -z "$version" ]; then
    version=$(get_ruby_version)
    echo "Using current version: $version"
  fi

  print_header "📝 Generating Ruby CHANGELOG for v$version"

  # Create or update CHANGELOG
  if [ -f "$CHANGELOG_FILE" ]; then
    update_changelog "$version"
  else
    create_changelog "$version"
  fi

  log_success "CHANGELOG updated successfully"
  echo "File: $CHANGELOG_FILE"
}

# Create new CHANGELOG file
create_changelog() {
  local version=$1

  cat > "$CHANGELOG_FILE" <<EOF
# Changelog

All notable changes to the Ruby package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

$(generate_version_section "$version")
EOF

  log_success "Created new CHANGELOG.md"
}

# Update existing CHANGELOG file
update_changelog() {
  local version=$1

  # Check if version already exists in CHANGELOG
  if grep -q "## \[$version\]" "$CHANGELOG_FILE"; then
    log_warning "Version $version already exists in CHANGELOG"
    return
  fi

  # Generate new version section
  local new_section
  new_section=$(generate_version_section "$version")

  # Insert after "## [Unreleased]" section
  awk -v version="$version" -v section="$new_section" '
    /^## \[Unreleased\]/ {
      print
      print ""
      print section
      next
    }
    { print }
  ' "$CHANGELOG_FILE" > "$TEMP_CHANGELOG"

  mv "$TEMP_CHANGELOG" "$CHANGELOG_FILE"

  log_success "Updated CHANGELOG.md with version $version"
}

# Generate version section from git history
generate_version_section() {
  local version=$1
  local date
  date=$(date +%Y-%m-%d)

  echo "## [$version] - $date"
  echo ""

  # Get the last ruby tag
  local last_tag
  last_tag=$(git tag -l "ruby-v*" --sort=-version:refname | head -n 1)

  if [ -n "$last_tag" ]; then
    # Get commits since last tag
    local commits
    commits=$(git log "$last_tag"..HEAD --pretty=format:"- %s (%h)" -- packages/ruby/ 2>/dev/null || echo "")

    if [ -n "$commits" ]; then
      echo "### Changed"
      echo ""
      echo "$commits"
    else
      echo "### Changed"
      echo ""
      echo "- Initial release"
    fi
  else
    # No previous tags, this is the first release
    echo "### Added"
    echo ""
    echo "- Initial release of nats_pubsub Ruby gem"
    echo "- Full-featured NATS JetStream pub/sub library"
    echo "- Rails integration with generators"
    echo "- Inbox/Outbox pattern support"
    echo "- Dead Letter Queue (DLQ) handling"
    echo "- Web UI for monitoring"
  fi

  echo ""
}

# Interactive mode - prompt for changes
interactive_mode() {
  local version=$1

  print_section "Interactive CHANGELOG Entry"

  echo "Enter changes for version $version:"
  echo "(Enter 'done' when finished)"
  echo ""

  local changes=()
  local category=""

  # Prompt for category
  echo "Select category:"
  echo "  1. Added (new features)"
  echo "  2. Changed (changes in existing functionality)"
  echo "  3. Deprecated (soon-to-be removed features)"
  echo "  4. Removed (removed features)"
  echo "  5. Fixed (bug fixes)"
  echo "  6. Security (security fixes)"
  echo ""
  read -rp "Category (1-6): " category_num

  case $category_num in
    1) category="Added" ;;
    2) category="Changed" ;;
    3) category="Deprecated" ;;
    4) category="Removed" ;;
    5) category="Fixed" ;;
    6) category="Security" ;;
    *) category="Changed" ;;
  esac

  echo ""
  echo "Enter changes (one per line, 'done' to finish):"

  while true; do
    read -rp "> " change
    [ "$change" = "done" ] && break
    [ -n "$change" ] && changes+=("$change")
  done

  # Generate section with user input
  local date
  date=$(date +%Y-%m-%d)

  cat > "$TEMP_CHANGELOG" <<EOF
## [$version] - $date

### $category

EOF

  for change in "${changes[@]}"; do
    echo "- $change" >> "$TEMP_CHANGELOG"
  done

  echo "" >> "$TEMP_CHANGELOG"

  # Prepend to existing changelog (after header)
  if [ -f "$CHANGELOG_FILE" ]; then
    awk 'NR==1,/^## \[Unreleased\]/{print} /^## \[Unreleased\]/{system("cat '"$TEMP_CHANGELOG"'"); next} /^## \[Unreleased\]/,0' "$CHANGELOG_FILE" > "${TEMP_CHANGELOG}.tmp"
    mv "${TEMP_CHANGELOG}.tmp" "$CHANGELOG_FILE"
  else
    create_changelog "$version"
    cat "$TEMP_CHANGELOG" >> "$CHANGELOG_FILE"
  fi

  rm -f "$TEMP_CHANGELOG"
}

# Show usage
usage() {
  cat <<EOF
Usage: $0 [OPTIONS] [VERSION]

Generate or update CHANGELOG.md for Ruby package.

Options:
  -i, --interactive   Interactive mode (prompts for changes)
  -h, --help         Show this help message

Examples:
  $0                  # Use current version from version.rb
  $0 0.2.0           # Specify version
  $0 -i 0.2.0        # Interactive mode
EOF
}

# Parse command line arguments
INTERACTIVE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -i|--interactive)
      INTERACTIVE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      VERSION_ARG=$1
      shift
      ;;
  esac
done

# Run appropriate mode
if [ "$INTERACTIVE" = true ]; then
  version=${VERSION_ARG:-$(get_ruby_version)}
  interactive_mode "$version"
else
  main "${VERSION_ARG:-}"
fi
