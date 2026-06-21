# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release **must** have a matching `## [x.y.z]` section below before it can
be published. CI enforces this: a pull request that bumps the version in
`package.json` fails unless this file contains a non-empty section for the new
version (see `.github/workflows/version-check.yml`). On merge, the publish
workflow uses that section as the annotated git tag message and the GitHub
Release body.

To cut a release: move your `## [Unreleased]` notes under a new
`## [x.y.z] - YYYY-MM-DD` heading in the same PR that bumps the version.

## [Unreleased]

<!-- Add notes for the next release here. When you bump the version in
     package.json, move these under a `## [x.y.z] - YYYY-MM-DD` heading. -->

## [0.4.22]

- Baseline release. History prior to this version predates this changelog; see
  the git tags and the npm release history for earlier changes.
