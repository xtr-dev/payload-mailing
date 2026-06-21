import { rootEslintConfig } from '@payloadcms/eslint-config'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...rootEslintConfig,
  {
    languageOptions: {
      parserOptions: {
        // Enable type-aware linting using the nearest tsconfig.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // vitest.config.ts lives at the repo root and is intentionally excluded from
    // tsconfig.json's `include` (which is scoped to ./src). Type-aware linting via
    // `projectService` therefore can't resolve it and throws a parsing error, so we
    // exclude this build-tooling config from linting alongside the .js/.mjs/.cjs configs.
    ignores: ['dist/**', 'dev/**', 'node_modules/**', '**/*.js', '**/*.mjs', '**/*.cjs', 'vitest.config.ts'],
  },
]
