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
  /**
   * Widget ブロット（`sbwidget`）。Widget ライブラリから挿入した任意 HTML を
   * `<section class="sb-widget-block">` として Quill に登録し、reconcile で
   * 消されないようにする（指示88）。BlockEmbed なので Quill は中身を解析せず、
   * ひとかたまりの編集不可ブロックとして扱う。
   */
  class SbWidgetBlot extends BlockEmbed {
    static blotName = 'sbwidget'
    static tagName = 'section'
    static className = 'sb-widget-block'

    static override create(html: string): HTMLElement {
      const node = super.create(html) as HTMLElement
      node.setAttribute('data-widget-block', 'true')
      node.setAttribute('contenteditable', 'false')
      node.innerHTML = html
      node.style.cssText = 'margin:8px 0'
      return node
    }

    static value(node: HTMLElement): string {
      return node.innerHTML
    }
  }

  /**
   * カスタム Image ブロット。標準の Image ブロットを上書きし、
   * リンク設定・計測URL用の data 属性を保持する（image-link.ts）。
   * Quill の reconcile はブロットが知らない属性を消すため、
   * formats() で明示的に返す必要がある。
   */
  const InlineEmbed = Quill.import('blots/embed') as BlotConstructor & {
    create(value: unknown): HTMLElement
  }

  /** 保持する data 属性のリスト */
  const LINK_ATTRS = ['data-link-url', 'data-link-target', 'data-tracking-urls'] as const

  class SbImageBlot extends InlineEmbed {
    static blotName = 'image'
    static tagName = 'IMG'

    static override create(value: string | Record<string, string>): HTMLElement {
      const node = super.create(value) as HTMLImageElement
      if (typeof value === 'string') {
        node.setAttribute('src', value)
      } else {
        node.setAttribute('src', value['src'] ?? '')
        for (const attr of LINK_ATTRS) {
          const v = value[attr]
          if (v !== undefined && v !== '') node.setAttribute(attr, v)
        }
        // width 等の復元
        if (value['width'] !== undefined) {
          node.setAttribute('width', value['width'])
          node.style.width = `${value['width']}px`
        }
      }
      return node
    }

    static value(node: HTMLElement): Record<string, string> {
      const val: Record<string, string> = { src: node.getAttribute('src') ?? '' }
      for (const attr of LINK_ATTRS) {
        const v = node.getAttribute(attr)
        if (v !== null && v !== '') val[attr] = v
      }
      const w = node.getAttribute('width')
      if (w !== null) val['width'] = w
      return val
    }

    static formats(node: HTMLElement): Record<string, string> {
      const fmt: Record<string, string> = {}
      for (const attr of LINK_ATTRS) {
        const v = node.getAttribute(attr)
        if (v !== null && v !== '') fmt[attr] = v
      }
      const w = node.getAttribute('width')
      if (w !== null) fmt['width'] = w
      return fmt
    }

    format(name: string, value: string | false): void {
      const dom = (this as unknown as { domNode: HTMLElement }).domNode
      if (LINK_ATTRS.includes(name as typeof LINK_ATTRS[number]) || name === 'width') {
        if (value === false || value === '') {
          dom.removeAttribute(name)
        } else {
          dom.setAttribute(name, value)
        }
      }
      // Quill の他の format（bold 等）は img には不要なので無視
    }
  }

  ;(Quill.register as (blot: unknown, silent?: boolean) => void)(SbVideoBlot, true)
  ;(Quill.register as (blot: unknown, silent?: boolean) => void)(SbWidgetBlot, true)
  ;(Quill.register as (blot: unknown, silent?: boolean) => void)(SbImageBlot, true)
  blotsRegistered = true
}
