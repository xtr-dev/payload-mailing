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

### Added

- **`perPart({ html, text })` for template variables.** Both MIME parts used to
  be rendered with the same variables, so a variable holding HTML (used with
  `| raw`) showed up as tags in the plain-text part. A variable made with the
  new exported `perPart()` helper resolves to its `html` value in the HTML body
  and HTML layout, and to its `text` value in the text body, text layout and
  subject. It works at any depth and is stored as a plain `{ html, text }`
  object. Plain objects with `html`/`text` keys are not affected.
- **`locale`, `currency` and `timeZone` options for the date and money
  filters.** `formatDate` and `formatCurrency` were hardcoded to `en-US` and
  `USD`. The new plugin options set their defaults, and both filters accept the
  locale (and `formatCurrency` the currency) as an extra argument, e.g.
  `{{ total | formatCurrency: "EUR", "nl-NL" }}`. Without the options the
  output is unchanged. An invalid `locale`, `currency` or `timeZone` option makes the
  plugin throw a clear error at startup. An invalid locale or currency passed
  as a filter argument falls back to the configured defaults instead of failing
  the render.
- **`strictTemplates` option.** By default a template that fails to parse or
  render (e.g. an unclosed `{% if %}`) is logged and sent through the naive
  `{{ name }}` replacer, so raw Liquid tags can reach recipients. With
  `strictTemplates: true` the Liquid, Mustache and custom-renderer adapters
  throw a new exported `TemplateRenderError` instead: `sendEmail` rejects before
  anything is queued and the admin preview shows the error. Strict mode also
  makes unknown Liquid filters an error (liquidjs `strictFilters`) and throws
  when the configured `liquidjs` / `mustache` package cannot be loaded. The
  default is unchanged.
- **`escapeHtml` and `safeUrl` are exported** from the package entry, so hosts
  that send direct (non-template) HTML can use the same escaping as the
  rich-text serializer. `escapeHtml` now also escapes `'` (as `&#39;`), so its
  output is safe inside single-quoted attributes too.

### Fixed

- **Rich-text links made in the Payload 3 editor kept no URL.** The serializer
  read `node.url` / `node.newTab`, but Payload 3's Lexical link nodes store them
  under `node.fields`, so admin-made links rendered as `href="#"` (and ` ()` in
  the text part). It now reads `fields.url` / `fields.newTab` (falling back to
  the old flat shape), renders `autolink` nodes as links, and resolves internal
  links through the new `resolveInternalLink` option. A link with no usable
  target keeps its text but no longer becomes a dead `#` link.

- **Liquid comparisons with `<` / `>` broke the HTML body.** Text nodes were
  escaped before Liquid parsed the HTML body, so `{% if n > 5 %}` reached the
  engine as `{% if n &gt; 5 %}`, failed to parse, and the HTML part fell back
  to the simple renderer (raw tags sent). Complete `{% … %}` / `{{ … }}` tags
  inside a text node are now left verbatim for the engine that understands
  them (Liquid: `{% %}` and `{{ }}`; Mustache: `{{ }}`; simple engine and
  custom renderers: none). Text around them is still escaped and output values
  are still escaped by the engine. When the body does not parse, the fallback
  renders a fully escaped body, so markup inside a broken tag is never sent
  raw. A tag split across
  differently formatted text runs is not recognised (it would contain
  formatting markup and could not parse anyway).

- **Quoted Liquid arguments broke the HTML body.** Rich-text text nodes were
  escaped with the attribute escaper before Liquid parsed the HTML body, so
  `"` became `&quot;` and `{{ d | formatDate: "long" }}` failed to parse; the
  HTML part then fell back to the simple renderer and recipients got raw tags.
  Text nodes now only escape `& < >`; values substituted by the engine are
  still escaped as before.

- **The template preview endpoint now checks template access.**
  `POST /api/mailing/preview-template` only checked that a user was logged in.
  It now also requires the user to pass the templates collection's `update` or
  `create` access (the access needed to edit a template) and answers `403`
  otherwise. Anyone who can edit templates in the admin keeps the preview.

- **README's Requirements line understated the PayloadCMS floor.** It read
  `PayloadCMS ^3.0.0` while `package.json`'s `payload` peerDependency has
  required `^3.37.0` since the collection-access rewrite — installing at the
  README-advertised floor would hit peer-resolution warnings or failures.
  Corrected the README line to `^3.37.0`, and added
  `scripts/check-readme-peer-version.sh` (run in CI) so the two can't drift
  apart silently again; this exact line already drifted once before without
  anything catching it.

- **`processEmails` now orders equal-priority emails oldest-first.** The Local
  API `find` used a comma-separated sort string (`priority,createdAt`), which
  Payload only splits on REST. Local API treats the string as one field, so
  Mongo fell back to `-createdAt` and a 50-email run starved older rows. The
  query now passes `['priority', 'createdAt']`.

### Changed

- **`@xtr-dev/payload-automation` is no longer declared as a peer dependency.**
  The optional integration shown in `ScheduleEmailTask` is structural and does
  not import or require payload-automation at build time or runtime. Consumers
  that use that example should install payload-automation directly.

- **`@payloadcms/richtext-lexical` is now a required peerDependency.** It was
  already loaded at runtime (the templates collection uses `lexicalEditor` as
  its default editor) but was only declared in devDependencies, so a clean
  install without it failed with `ERR_MODULE_NOT_FOUND`. If your project
  already has `@payloadcms/richtext-lexical` installed (most Payload apps do,
  since it's Payload's default rich text editor), this changes nothing. If it
  doesn't, npm's strict peer-dependency resolution (or pnpm without
  `auto-install-peers`) will now warn or error on install until you add it —
  see the updated install line in the README.

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
