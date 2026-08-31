/**
 * アセットの保存先を決める。
 *
 * 採取したCSSは `url(/assets/arrow_down_black-f0adf289.svg)` のように**実物のURLのまま**
 * 画像を参照する。CSSは土台としてそのまま使う（企画書 §5: 手書きで似せない）ので、
 * **ファイル側をそのURLに合わせて置く**のが正しい。
 *
 * 以前は basename だけを取って `assets/files/` へ平らに置いていたため、
 * CSSが求める `/assets/x.svg` と噛み合わず、editor.css だけで133箇所の画像が出ていなかった。
 */
import { normalize } from 'node:path'

/**
 * @param assetUrl 実物のURLパス（先頭スラッシュ必須・クエリ可）
 * @returns capture ディレクトリからの相対パス
 */
export function localPathForAsset(assetUrl: string): string {
  if (!assetUrl.startsWith('/')) {
    throw new Error(`不正なアセットURL（先頭が / でない）: ${assetUrl}`)
  }
  const withoutQuery = assetUrl.split('?')[0] ?? ''
  const relative = normalize(withoutQuery.slice(1))
  if (relative.startsWith('..') || relative.includes(`..${'/'}`)) {
    throw new Error(`不正なアセットURL（上位ディレクトリへ抜けている）: ${assetUrl}`)
  }
  return relative
}
