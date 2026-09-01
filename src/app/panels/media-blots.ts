/**
 * ローカル動画を `<video controls>` として編集内に置く独自 Quill ブロットの登録。
 *
 * ここだけ **Quill 本体（クラス）** を実行時 import する（`Quill.import` / `Quill.register` のため）。
 * Quill はモジュール読み込み時に `document` を触るので、DOMの無い node テストから読み込むと落ちる。
 * よってクラス依存はこの1ファイルに隔離し、エディタ（ブラウザ）からのみ import する。
 * 挿入・ドロップ等の配線は `media-insert.ts`（Quill は型のみ）に置き、テストから安全に読める。
 */
import Quill from 'quill'

type BlotConstructor = new (...args: unknown[]) => object

let blotsRegistered = false

/**
 * 動画ブロット（`sbvideo`）を1回だけ登録する。編集を始める前に呼んでおくと、
 * 保存HTMLから復元した `<video>` も Quill が認識して消えない。
 */
export function registerMediaBlots(): void {
  if (blotsRegistered) return
  const BlockEmbed = Quill.import('blots/block/embed') as BlotConstructor & {
    create(value: unknown): HTMLElement
  }
  class SbVideoBlot extends BlockEmbed {
    static blotName = 'sbvideo'
    static tagName = 'video'
    static override create(url: string): HTMLElement {
      const node = super.create(url)
      node.setAttribute('src', url)
      node.setAttribute('controls', 'controls')
      // 指示⑬: 常に再生（自動再生＋ループ）。音ありの自動再生はブロックされるので muted 必須。
      node.setAttribute('autoplay', 'autoplay')
      node.setAttribute('muted', 'muted')
      node.setAttribute('loop', 'loop')
      node.setAttribute('playsinline', 'playsinline')
      node.setAttribute('preload', 'metadata')
      if (node instanceof HTMLVideoElement) node.muted = true // 属性だけだと効かない環境向け
      node.style.maxWidth = '100%'
      return node
    }
    static value(node: HTMLElement): string {
      return node.getAttribute('src') ?? ''
    }
  }
  ;(Quill.register as (blot: unknown, silent?: boolean) => void)(SbVideoBlot, true)
  blotsRegistered = true
}
