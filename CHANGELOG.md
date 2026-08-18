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

### Fixed

- **`sendEmail` no longer sends with zero recipients.** A `to` value that is a
  whitespace/comma-only string (e.g. `" , "`) or an empty array passed the
  `"to" is required` check (it's truthy before normalization) and then
  collapsed to an empty list during recipient parsing, so the email was
  created with no recipients instead of being rejected. `sendEmail` now
  re-checks `to` after normalization and throws the same "required" error.

## [0.6.0] - 2026-07-26

### Changed

- **Secure-by-default collection access (breaking).** The `emails` and
  `email-templates` collections now **deny every operation by default** instead
  of inheriting Payload's built-in default (which grants access to any
  authenticated user). This prevents accidentally exposing email content,
  recipients, and templates in apps that have non-admin/front-end users. The
  plugin's own sending, scheduling, and rendering are unaffected — they run
  through Payload's Local API, which bypasses access control. **Action
  required:** grant the access your app needs via the plugin's
  `collections.emails.access` / `collections.templates.access` overrides. Your
  `access` functions are merged on top of the deny-all defaults, so any
  operation you don't override stays denied. See the new **Access Control**
  section in the README.

### Docs

- Rewrote the README to be shorter and focused on essential usage, added an
  **Access Control** section, and corrected stale references (a non-existent
  `onReady` option, an `attemptCount` field, and a `sendTemplateEmailTask` /
  `send-template-email` job task that the plugin does not expose — its
  processing job is registered automatically).

### Security

- Removed the unused `nodemailer` dependency and the `@types/nodemailer`
  dev dependency. The plugin sends through Payload's configured email
  adapter (`payload.email.sendEmail`) and never imported nodemailer, so
  dropping them clears their advisories and removes the transitively
  pulled `@aws-sdk/client-ses` type subtree.
- Bumped the optional `liquidjs` dependency to `^10.27.0`, patching the
  path-traversal (GHSA-8gc5-j5rx-235r) and `renderFile`/`parseFile`
  root-bypass (GHSA-gh4j-gqv2-49f6) advisories.

## [0.5.0] - 2026-06-26

### Added

- **Reusable email layouts** (#88): configure named layouts, each with an HTML
  wrapper and an optional plain-text wrapper, into which a template's rendered
  body is injected at a `{{ content }}` slot. Apply one globally with
  `defaultLayout`, override it per template, or opt a template out entirely with
  the `none` selection.
- **In-admin template render preview** (#88): a live, debounced preview on the
  template edit screen that renders the draft through the selected layout with
  sample variables, shown in a sandboxed (`sandbox=""`) iframe. Sample variables
  are preview-only and never stored on sent emails.
- **Template-engine adapter layer** abstracting LiquidJS, Mustache, the simple
  replacer, and custom renderers, so layout composition applies the correct
  escaping model for each engine.
- **Required template variables**: templates can declare the variables they
  expect (via a new **Variables** field) and mark some as required. Sending a
  template without a required variable is rejected before the email is queued,
  with an error naming the missing variables — preventing emails that go out
  with unrendered placeholders or blank values. Fully opt-in; templates that
  declare nothing are unconstrained, and the preview/`renderTemplate` paths are
  not affected.

### Fixed

- **Layout-variable escaping** is now uniform across every engine: a layout's
  own variables (e.g. `{{ siteName }}`) are always HTML-escaped with no raw
  opt-out, closing an XSS vector for user-controlled values surfaced in a layout
  header or footer. The rendered body is still injected once, without
  double-escaping — including on Mustache, where `{{ content }}` and
  `{{{ content }}}` both work.
- **`findExistingJobs`** query repaired (correct `taskSlug`, with the nested
  `input.emailId` matched in JS) so scheduled-email deduplication works across
  all database adapters, and the scan is now bounded instead of loading every
  job.

## [0.4.22]

- Baseline release. History prior to this version predates this changelog; see
  the git tags and the npm release history for earlier changes.
