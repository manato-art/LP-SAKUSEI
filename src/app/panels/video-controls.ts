/**
 * キャンバスに置いた動画の設定（再生まわり・複製）。
 *
 * 動画は挿入時に「常に再生（自動再生＋ループ＋ミュート）」で入る（指示⑬）が、
 * 1回だけ見せたい動画もあるので後から切り替えられるようにする。
 *
 * 操作UIは右パネル（`properties-video.ts`）に置き、ここは**中身の処理だけ**を持つ。
 * 動画の上に浮かせるバーだと本文に被って読めなくなるため。
 *
 * 保存は DOM から直列化される（editor.ts の `serializeQuillBody`）ので、
 * 属性を書き換えれば保存HTMLにそのまま入る。
 * 変更後は呼び出し側が `quill.update()` で Quill に知らせる。
 */

/**
 * ループ切り替えが必要とする最小の形。`HTMLVideoElement` はこれを満たす。
 * こう切っておくと、DOMの無いテストからも切り替えの筋道を確かめられる
 * （このリポジトリは jsdom を入れない方針のため）。
 */
export interface LoopTarget {
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
  loop: boolean
  autoplay: boolean
  muted: boolean
}

/** 切り替えられる再生設定 */
export type VideoFlag = 'loop' | 'autoplay' | 'muted'

/** その設定が入っているか */
export function hasFlag(video: LoopTarget, flag: VideoFlag): boolean {
  return video.hasAttribute(flag)
}

/**
 * 設定のON/OFFを入れ替えて、切り替え後の状態を返す。
 * 属性と DOM プロパティの両方を触る（属性だけだと再生中の挙動が変わらない環境がある）。
 */
export function toggleFlag(video: LoopTarget, flag: VideoFlag): boolean {
  const next = !hasFlag(video, flag)
  if (next) {
    video.setAttribute(flag, flag)
    video.removeAttribute(`data-sb-${flag}`)
  } else {
    video.removeAttribute(flag)
    /**
     * 「切った」ことを印として残す。
     * 配信ページは既定で再生設定を付け直すので（指示⑬の「常に再生」）、
     * 印が無いと切った設定がLP上で復活してしまう（`src/app/lp-video.ts`）。
     */
    video.setAttribute(`data-sb-${flag}`, 'off')
  }
  // eslint-disable-next-line no-param-reassign -- 対象要素の再生設定を変えるのがこの関数の責務
  video[flag] = next
  return next
}

/** その動画がループ再生になっているか */
export function isLooping(video: LoopTarget): boolean {
  return hasFlag(video, 'loop')
}

/** ループのON/OFFを入れ替える */
export function toggleLoop(video: LoopTarget): boolean {
  return toggleFlag(video, 'loop')
}

/**
 * 音ありの自動再生はブラウザに止められる。
 * 「自動再生ONのままミュートを切った」ときだけ true を返し、呼び出し側が注意を出す。
 */
export function willBlockAutoplay(video: LoopTarget): boolean {
  return hasFlag(video, 'autoplay') && !hasFlag(video, 'muted')
}

/**
 * 動画をすぐ下に複製する。
 *
 * Quill の API ではなく DOM に直接差し込み、呼び出し側で `quill.update()` する。
 * `<video>` は sbvideo ブロットとして登録済みなので、Quill は差し込まれた要素を
 * 認識して自分の内容に取り込む（保存HTMLからの復元と同じ経路）。
 */
export function duplicateVideo(video: HTMLVideoElement): HTMLVideoElement {
  const copy = video.cloneNode(true) as HTMLVideoElement
  // クローンは属性しか引き継がないので、再生まわりのプロパティを揃え直す
  copy.loop = video.hasAttribute('loop')
  copy.autoplay = video.hasAttribute('autoplay')
  copy.muted = video.hasAttribute('muted')
  video.insertAdjacentElement('afterend', copy)
  return copy
}
