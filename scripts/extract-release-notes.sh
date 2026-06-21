#!/usr/bin/env bash
#
# Extracts a single version's release notes from CHANGELOG.md.
#
# Usage: extract-release-notes.sh <version> [changelog-path]
#
# Prints the body of the "## [<version>]" section (everything up to the next
# "## [" heading) to stdout, with surrounding blank lines trimmed. Prints
# nothing and exits 0 when the section is missing or empty, so callers can
# treat empty output as "no notes". The version is matched literally, so an
# optional "## [<version>] - YYYY-MM-DD" date suffix is fine.
#
# Shared by version-check.yml (the PR gate) and version-and-publish.yml (the
# publisher) so the two cannot drift in how they read the changelog.
set -euo pipefail

version="${1:?usage: extract-release-notes.sh <version> [changelog-path]}"
changelog="${2:-CHANGELOG.md}"

[ -f "$changelog" ] || exit 0

awk -v v="$version" '
  BEGIN { target = "## [" v "]" }
  # The section starts at a line beginning with the exact "## [<version>]".
  index($0, target) == 1 { found = 1; next }
  # The next "## [" heading ends the section.
  found && /^## \[/ { exit }
  found { lines[n++] = $0 }
  END {
    # Trim leading and trailing blank lines from the captured body.
    start = 0
    while (start < n && lines[start] ~ /^[[:space:]]*$/) start++
    end = n - 1
    while (end >= start && lines[end] ~ /^[[:space:]]*$/) end--
    for (i = start; i <= end; i++) print lines[i]
  }
' "$changelog"
