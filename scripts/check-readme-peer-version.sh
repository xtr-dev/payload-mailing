#!/usr/bin/env bash
#
# Fails when README.md's Requirements line states a PayloadCMS version floor
# that disagrees with package.json's `payload` peerDependency. The two have
# drifted independently before: the README line was edited from ^3.45.0 down
# to ^3.0.0 while the peerDependency stayed at ^3.37.0, and the mismatch went
# unnoticed until it was caught by manual inspection. Nothing tied the two
# together, so nothing stopped it happening again. This script is that tie.
#
# Usage: check-readme-peer-version.sh [readme-path] [package-json-path]
set -euo pipefail

readme="${1:-README.md}"
pkg="${2:-package.json}"

[ -f "$readme" ] || { echo "::error::$readme not found"; exit 1; }
[ -f "$pkg" ] || { echo "::error::$pkg not found"; exit 1; }

PEER_VERSION="$(node -p "require('./$pkg').peerDependencies && require('./$pkg').peerDependencies.payload || ''")"
if [ -z "$PEER_VERSION" ]; then
  echo "::error::$pkg has no peerDependencies.payload to check the README against."
  exit 1
fi

README_VERSION="$(grep -oE 'PayloadCMS [\^~]?[0-9]+\.[0-9]+\.[0-9]+' "$readme" | head -n1 | awk '{print $2}')"
if [ -z "$README_VERSION" ]; then
  echo "::error::Could not find a 'PayloadCMS <version>' floor in $readme's Requirements section."
  exit 1
fi

if [ "$README_VERSION" != "$PEER_VERSION" ]; then
  echo "::error::$readme states PayloadCMS $README_VERSION but $pkg's peerDependencies.payload is $PEER_VERSION. Update $readme's Requirements line to match."
  exit 1
fi

echo "OK: $readme's PayloadCMS floor ($README_VERSION) matches $pkg's peerDependencies.payload."
