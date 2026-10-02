import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  // `.local/` is the maintainer's own scratch space and is gitignored, so CI
  // never checks out what it holds. Ignoring it keeps `pnpm lint` (which runs
  // `eslint .`) agreeing with CI instead of failing on a file the pipeline
  // cannot even see.
  { ignores: ['lib/**', 'node_modules/**', 'assets/**', '.local/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // 浏览器半边与它的测试：DOM 全局，见 tsconfig.client.json。
    files: ['src/client/**/*.{ts,tsx}', 'tests/browser/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    rules: {
      // `_` 前缀是仓内既有的「有意不用」写法：drain 循环的绑定、解构剔除某个键。
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  eslintConfigPrettier,
]
