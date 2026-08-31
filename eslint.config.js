import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'capture/**', 'coverage/**', 'src/pages/**/*.html'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // ブラウザで動くもの: DevToolsに貼るスニペットと、クローン本体のフロント
    files: ['tools/capture-console/**/*.js', 'src/**/*.ts'],
    languageOptions: {
      globals: {
        window: 'readonly', document: 'readonly', location: 'readonly', history: 'readonly',
        fetch: 'readonly', console: 'readonly', prompt: 'readonly', performance: 'readonly',
        addEventListener: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly', getComputedStyle: 'readonly',
        getSelection: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
        devicePixelRatio: 'readonly', localStorage: 'readonly', FileReader: 'readonly',
        HashChangeEvent: 'readonly', Event: 'readonly', MouseEvent: 'readonly',
        HTMLElement: 'readonly', HTMLInputElement: 'readonly', HTMLButtonElement: 'readonly',
        HTMLElementTagNameMap: 'readonly', Node: 'readonly', URLSearchParams: 'readonly',
      },
    },
  },
  {
    rules: {
      // 企画書 §12: イミュータブル / 命名 / 握りつぶし禁止
      // DOMの描画先(container/res等)への書き込みは正当な操作なので対象外。
      // 守りたいのは「ドメインデータのオブジェクトを破壊的に変更しない」こと（§12 イミュータブル）。
      'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['container', 'content', 'node', 'map', 'quill'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
)
