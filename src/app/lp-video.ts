/**
 * LP内の動画を「常に再生」にする（指示⑬）。配信・プレビュー・ダウンロードでも適用する。
 *
 * ブラウザは音ありの自動再生をブロックするので、autoplay には muted が必須。
 * ループ＋インライン再生（iOSで全画面化させない）＋操作もできるよう controls は残す。
 * GIFは <img> なので何もしなくても animate する（対象外）。
 */
const AUTOPLAY_ATTRS = ['autoplay', 'muted', 'loop', 'playsinline'] as const

/** 保存済みHTML内の各 `<video>` に、足りない自動再生属性を補う（純粋関数） */
export function withAutoplayVideos(html: string): string {
  return html.replace(/<video\b([^>]*)>/gi, (_match, attrs: string) => {
    let next = attrs
    for (const attr of AUTOPLAY_ATTRS) {
      if (!new RegExp(`\\b${attr}\\b`, 'i').test(next)) next += ` ${attr}`
    }
    return `<video${next}>`
  })
}
