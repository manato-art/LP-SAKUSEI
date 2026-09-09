import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    /**
     * 本番(Railway)と同じ UTC で回す。
     *
     * 手元のJSTでだけ通るテストがあると、日付の切り替わりのズレが
     * 本番で初めて出る（実際に「日本の朝のアクセスが前日に記録される」を
     * 見落としていた）。既定を本番に合わせて、その差を手元で捕まえる。
     * コード側は日付をJSTに固定してあるので、ここを変えても結果は変わらない。
     */
    env: { TZ: 'UTC' },
  },
})
