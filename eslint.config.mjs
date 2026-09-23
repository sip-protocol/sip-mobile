// Flat config for ESLint 9 + typescript-eslint 8 (versions pinned in devDependencies — no new plugins).
//
// Scope: a pragmatic correctness baseline, not a style guide. Formatting is out of scope
// (no stylistic rules); React/RN-specific linting is omitted because the matching plugins
// are not dependencies of this repo. Rules may be tightened over time; relaxations below
// are documented inline so they are easy to audit.
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    // Generated, vendored, and non-source trees.
    ignores: [
      '**/node_modules/**',
      '.expo/**',
      'coverage/**',
      'android/**',
      'ios/**',
      '.detox/**',
      'patches/**',
      'screenshots/**',
      'e2e/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // Syntactic recommended set (no type-aware rules — keeps lint fast and CI-cheap).
      ...typescriptEslint.configs.recommended.rules,

      // --- Documented baseline relaxations -----------------------------------
      // `any` is pervasive at current call sites (RN bridges, web3 SDKs). Tracking
      // issue should tighten this per-module over time.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Non-null assertions appear in crypto/keystore paths where narrowing is
      // awkward; used deliberately. Do not add new ones in TS-friendly code.
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Unused locals/params/caught-errors are errors; prefix with `_` to opt out.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // require() in app code is limited to asset loads, guarded native-module
      // loads, and function-local lazy imports — each carries an inline disable
      // with a reason. See the inline comments for the rationale per site.
      '@typescript-eslint/no-require-imports': 'error',
    },
  },
  {
    // Test files load native-only modules, RN-only modules, and Anchor IDL JSON
    // via require() inside vi.mock()/beforeAll blocks; a static import of those
    // modules would crash the Node test runtime. This is the established
    // convention in tests/ — do not port to app code.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Plain-JS tooling configs at the repo root (expo/babel/metro/tailwind/detox).
    files: ['*.config.js', '*.config.mjs', '*.config.ts', '.detoxrc.js'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],
    },
  },
];
