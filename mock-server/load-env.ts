/**
 * ローカル開発用に `.env` を読み込む（副作用のみ・**最初にimportする**）。
 *
 * store など一部モジュールは import 時に env（SEED_DEMO 等）を読むため、`.env` は
 * それらより先に読み込む必要がある。よって index.ts の**先頭importで副作用として**実行する。
 * 本番(Railway)/CI は環境変数を直接持ち `.env` は無いので、存在しなければ何もしない。
 */
try {
  process.loadEnvFile()
} catch {
  // .env なし＝本番/CI。env は起動側が直接与える。
}
