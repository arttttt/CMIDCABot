import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'boundaries': boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/**', mode: 'file' },
        { type: 'data', pattern: 'src/data/**', mode: 'file' },
        { type: 'presentation', pattern: 'src/presentation/**', mode: 'file' },
        { type: 'infra-internal', pattern: 'src/infrastructure/internal/**', mode: 'file' },
        { type: 'infra-shared', pattern: 'src/infrastructure/shared/**', mode: 'file' },
        { type: 'wip', pattern: 'src/_wip/**', mode: 'file' },
        { type: 'types', pattern: 'src/types/**', mode: 'file' },
      ],
      'boundaries/ignore': ['**/*.test.ts', '**/*.spec.ts'],
    },
    rules: {
      // === ARCHITECTURAL BOUNDARIES ===
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          // Domain: only own interfaces + infra-shared + types
          {
            from: 'domain',
            allow: ['domain', 'infra-shared', 'types'],
          },
          // Data: domain interfaces + all infrastructure
          {
            from: 'data',
            allow: ['domain', 'data', 'infra-internal', 'infra-shared', 'types'],
          },
          // Presentation: domain usecases + shared infra
          {
            from: 'presentation',
            allow: ['domain', 'presentation', 'infra-shared', 'types'],
          },
          // Infrastructure internal: only shared + types
          {
            from: 'infra-internal',
            allow: ['infra-internal', 'infra-shared', 'types'],
          },
          // Infrastructure shared: only other shared + types
          {
            from: 'infra-shared',
            allow: ['infra-shared', 'types'],
          },
          // WIP: temporary, more permissive
          {
            from: 'wip',
            allow: ['domain', 'data', 'infra-shared', 'types', 'wip'],
          },
        ],
      }],
      'boundaries/no-unknown': 'error',
      'boundaries/no-private': 'error',
    },
  },
];
