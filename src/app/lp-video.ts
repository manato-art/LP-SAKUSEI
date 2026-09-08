/**
 * LP内の動画の再生設定を、配信・プレビュー・ダウンロードで揃える。
 *
 * 既定は「常に再生」（指示⑬）。ブラウザは音ありの自動再生をブロックするので
 * autoplay には muted が必須。インライン再生（iOSで全画面化させない）も付ける。
 * GIFは <img> なので何もしなくても animate する（対象外）。
 *
 * ただし**エディタで明示的に切った設定は尊重する**。
 * 右パネルでOFFにしたものには `data-sb-<名前>="off"` が入るので、
 * それが付いている項目は付け直さない。この印が無い動画（トグルを作る前に
 * 保存されたもの）は、これまで通り既定の「常に再生」で配信する。
 */
const AUTOPLAY_ATTRS = ['autoplay', 'muted', 'loop', 'playsinline'] as const

/** その動画タグで、この項目が明示的にOFFにされているか */
function isTurnedOff(attrs: string, name: string): boolean {
  return new RegExp(`data-sb-${name}\\s*=\\s*["']?off`, 'i').test(attrs)
}

/**
 * 属性が「その名前の属性として」書かれているか。
 * 単純な `\\bloop\\b` だと `data-anim-loop="..."` にも当たってしまい、
 * ループを付けるべき動画に付かなくなる。
 */
function hasAttr(attrs: string, name: string): boolean {
  return new RegExp(`(^|\\s)${name}(\\s|=|$)`, 'i').test(attrs)
}

/** その名前の属性を取り除く */
function dropAttr(attrs: string, name: string): string {
  return attrs.replace(new RegExp(`(^|\\s)${name}(=("[^"]*"|'[^']*'|[^\\s>]*))?`, 'gi'), ' ')
}

/** 保存済みHTML内の各 `<video>` の再生設定を、配信用に整える（純粋関数） */
export function withAutoplayVideos(html: string): string {
  return html.replace(/<video\b([^>]*)>/gi, (_match, attrs: string) => {
    let next = attrs
    for (const attr of AUTOPLAY_ATTRS) {
      if (isTurnedOff(attrs, attr)) {
        // エディタで切ったものは、付いていても外す
        next = dropAttr(next, attr)
        continue
      }
      if (!hasAttr(next, attr)) next += ` ${attr}`
    }
    return `<video${next.replace(/\s+/g, ' ').replace(/\s+$/, '')}>`
  })
}
