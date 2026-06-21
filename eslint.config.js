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
    ignores: ['dist/**', 'dev/**', 'node_modules/**', '**/*.js', '**/*.mjs', '**/*.cjs'],
  },
]
