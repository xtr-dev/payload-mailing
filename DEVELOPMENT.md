# Development

## Setup

```bash
pnpm install
pnpm dev        # Next.js + Payload dev app from dev/, on http://localhost:3000
```

The dev app (`dev/payload.config.ts`) loads the plugin straight from `src/`, so
source changes are picked up without a build. It uses SQLite (`dev/dev.db`;
set `DATABASE_URI` to use another file) and a test email adapter that logs each
email and keeps it in memory instead of sending it.

On start it seeds a `welcome-email` template and a user
`dev@payloadcms.com` / `test`. Useful pages:

- `/admin`: Payload admin (**Mailing → Email Templates / Emails**, plus the jobs collection)
- `/mailing-test`: send or schedule an email from a template or raw HTML
- `/sent-emails`: what the test adapter received
- `POST /api/test-email`, `POST /api/process-emails`, `GET /api/sent-emails`: the same from scripts

A jobs `autoRun` cron processes the `default` queue every minute.

## Checks

```bash
pnpm lint        # eslint ./src
pnpm typecheck   # tsc --noEmit
pnpm test        # unit tests (src/**/*.test.ts)
pnpm test:int    # integration tests: boots the dev app against SQLite (dev/int.spec.ts)
pnpm test:e2e    # Playwright against `pnpm dev` on port 3300 (dev/e2e.spec.ts)
pnpm build       # compile to dist/
pnpm dev:build   # production build of the dev app (type-checks dev/ and src/ together)
```

CI (`.github/workflows/ci.yml`) runs `scripts/check-readme-peer-version.sh`,
lint, typecheck, unit and integration tests and the build on every pull request.
The README's `PayloadCMS ^x.y.z` requirement must match the `payload` peer
dependency, or that script fails.

## Layout

- `src/plugin.ts`: plugin entry; registers the collections, the `process-email` task and `payload.mailing`
- `src/collections/`: `emails` and `email-templates`, including the hook that queues a job per email
- `src/services/`: `MailingService` (rendering, sending, processing) and the template engines
- `src/sendEmail.ts`: the public send API
- `src/utils/`: rich-text serializer, job scheduler, helpers
- `src/tasks/`: the optional `schedule-email` task (`/tasks` export)
- `src/components/`: the admin preview client component (`/client` export)

## Releasing

Pull request titles use conventional-commit form; don't bump the version in a
PR. Releases run from the manual **Release** workflow, which uses
xtr-dev/changelog to pick the version and write the changelog.
