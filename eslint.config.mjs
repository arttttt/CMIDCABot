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
        { type: 'domain-policies', pattern: 'src/domain/policies/**', mode: 'file' },
        { type: 'domain', pattern: 'src/domain/**', mode: 'file' },
        { type: 'data', pattern: 'src/data/**', mode: 'file' },
        { type: 'presentation', pattern: 'src/presentation/**', mode: 'file' },
        { type: 'infra-internal', pattern: 'src/infrastructure/internal/**', mode: 'file' },
        { type: 'infra-shared', pattern: 'src/infrastructure/shared/**', mode: 'file' },
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
            allow: ['domain', 'domain-policies', 'infra-shared', 'types'],
          },
          // Domain policies: pure rules based on domain data
          {
            from: 'domain-policies',
            allow: ['domain', 'domain-policies', 'infra-shared', 'types'],
          },
          // Data: domain interfaces + all infrastructure
          {
            from: 'data',
            allow: ['domain', 'domain-policies', 'data', 'infra-internal', 'infra-shared', 'types'],
          },
          // Presentation: domain usecases + shared infra
          {
            from: 'presentation',
            allow: ['domain', 'domain-policies', 'presentation', 'infra-shared', 'types'],
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
        ],
      }],
      'boundaries/no-unknown': 'error',
      'boundaries/no-private': 'error',
    },
  },
];
