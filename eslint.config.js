import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'capture/**', 'coverage/**', 'src/pages/**/*.html'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 企画書 §12: イミュータブル / 命名 / 握りつぶし禁止
      'no-param-reassign': ['error', { props: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
)
