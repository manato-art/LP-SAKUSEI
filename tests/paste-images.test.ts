/**
 * ほかのサイトから貼った中身の画像も入れる（2026-10-31 本人「スクワットビヨンドで作成したLPを全選択してそのままエビヨンに
 * はりつけたいんだけど、文字はコピーできるけど、画像がそのままコピーできない」）。
 *
 * 本人の選択: 画像は EBIyon に写して置く／画像に付いているリンクは付けない。文字は今までどおり書式なし（2026-10-27「書式はコピーしないで」）。
 * 貼った中身を上から順に「文字」「画像」に分け、画像はサーバーで写してから、元の並びのまま入れる。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { imageSourceOf, pasteParts, pasteWithImages, type ImagePasteQuill, type PastePart } from '../src/app/pages/paste-images.ts'

const body = (html: string): HTMLElement =>
  parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body as unknown as HTMLElement

const IMG_A = 'https://img.example.test/lp/a.jpg'
const IMG_B = 'https://img.example.test/lp/b.webp'

describe('貼った中身を、上から順に文字と画像に分ける', () => {
  it('SB のLPのような中身: 文字・画像・文字・画像の順のまま。画像のリンクは付けない', () => {
    const parts = pasteParts(
      body(
        '<h2>見出し</h2>' +
          `<p><a href="https://sb.example.test/redirect"><img src="${IMG_A}" alt="ボタン"></a></p>` +
          '<p>本文の1行目<br>2行目</p>' +
          `<div><img src="${IMG_B}"></div>`,
      ),
    )
    expect(parts).toEqual<PastePart[]>([
      { kind: 'text', text: '見出し\n' },
      { kind: 'image', src: IMG_A },
      { kind: 'text', text: '本文の1行目\n2行目\n' },
      { kind: 'image', src: IMG_B },
    ])
  })

  it('スクリプト・見えない物・1px の計測用の画像は入れない', () => {
    const parts = pasteParts(
      body(
        '<script>alert(1)</script><style>p{}</style><p hidden>隠れた文</p>' +
          `<img src="https://px.example.test/t.gif" width="1" height="1"><p>本文</p>`,
      ),
    )
    expect(parts).toEqual<PastePart[]>([{ kind: 'text', text: '本文\n' }])
  })

  it('文字の中の空白・改行は、画面に見えるとおり1つにまとめる', () => {
    expect(pasteParts(body('<p>  あい\n   うえ  </p><p>お</p>'))).toEqual<PastePart[]>([{ kind: 'text', text: 'あい うえ\nお\n' }])
  })
})

describe('画像の住所', () => {
  const img = (attrs: string): Element => body(`<img ${attrs}>`).querySelector('img') as unknown as Element

  it('ふつうは src', () => {
    expect(imageSourceOf(img(`src="${IMG_A}"`))).toBe(IMG_A)
  })

  it('遅れて読み込む画像（src が仮の小さな画像）は data-src・srcset の本物を使う', () => {
    expect(imageSourceOf(img(`src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="${IMG_B}"`))).toBe(IMG_B)
    expect(imageSourceOf(img(`srcset="${IMG_A} 1x, ${IMG_B} 2x"`))).toBe(IMG_A)
  })

  it('埋め込みの画像（data:image）はそのまま、住所が読めない物（相対・空）は null', () => {
    const embedded = `data:image/png;base64,${'A'.repeat(200)}`
    expect(imageSourceOf(img(`src="${embedded}"`))).toBe(embedded)
    expect(imageSourceOf(img('src="/a.jpg"'))).toBeNull()
    expect(imageSourceOf(img(''))).toBeNull()
  })
})

/** Quill の代わり（入れた順に記録する）。本物と同じく、編集を止めている間の 'user' の書き換えは捨てる */
function fakeQuill(initial = '\n'): ImagePasteQuill & { doc: string[]; enabled: boolean[] } {
  let text = initial
  const doc: string[] = []
  const enabled: boolean[] = []
  let on = true
  return {
    doc,
    enabled,
    getSelection: () => ({ index: 0, length: 0 }),
    getFormat: () => ({ bold: true, header: 2 }),
    deleteText: () => undefined,
    insertText: (index: number, value: string, formats: Record<string, unknown>) => {
      if (!on) return
      doc.push(`text:${JSON.stringify(value)}:${JSON.stringify(formats)}`)
      text = text.slice(0, index) + value + text.slice(index)
    },
    insertEmbed: (index: number, type: string, value: string) => {
      if (!on) return
      doc.push(`${type}:${value}`)
      text = `${text.slice(0, index)}\u0000${text.slice(index)}`
    },
    getText: (index: number, length: number) => text.slice(index, index + length),
    setSelection: () => undefined,
    enable: (next = true) => {
      on = next
      enabled.push(next)
    },
  }
}

describe('写してから、元の並びのまま入れる', () => {
  it('画像は写した住所で入れ、文字は貼った所の見た目（行の書式は持ち込まない）', async () => {
    const quill = fakeQuill()
    const copied = new Map([[IMG_A, '/uploads/aaa.jpg']])
    const result = await pasteWithImages(
      quill,
      [{ kind: 'text', text: '見出し\n' }, { kind: 'image', src: IMG_A }, { kind: 'text', text: '本文' }],
      async (src) => copied.get(src) ?? null,
    )
    expect(quill.doc).toEqual([
      'text:"見出し\\n":{"bold":true}',
      'image:/uploads/aaa.jpg',
      'text:"\\n":{}',
      'text:"本文":{"bold":true}',
    ])
    expect(result).toEqual({ images: 1, videos: 0, widgets: 0, failed: 0, missingVideos: 0, missingWidgets: 0 })
  })

  it('写せなかった画像は入れずに数える。写している間は編集を止め、終わったら戻す', async () => {
    const quill = fakeQuill()
    const result = await pasteWithImages(quill, [{ kind: 'image', src: IMG_A }, { kind: 'image', src: IMG_B }], async (src) =>
      src === IMG_A ? '/uploads/aaa.jpg' : null,
    )
    expect(result).toEqual({ images: 1, videos: 0, widgets: 0, failed: 1, missingVideos: 0, missingWidgets: 0 })
    expect(quill.doc.filter((line) => line.startsWith('image:'))).toEqual(['image:/uploads/aaa.jpg'])
    expect(quill.enabled).toEqual([false, true])
  })

  it('同じ画像が何度出てきても、写すのは1回', async () => {
    const quill = fakeQuill()
    let calls = 0
    await pasteWithImages(quill, [{ kind: 'image', src: IMG_A }, { kind: 'image', src: IMG_A }], async () => {
      calls += 1
      return '/uploads/aaa.jpg'
    })
    expect(calls).toBe(1)
  })
})

/**
 * SB の Widget も入れる（2026-10-31 本人「Widgetもコピーできる？できないならコピーしたい」→ 本人の選択「両方」の①）。
 * 全選択のコピーには Widget の動き（スクリプト）と CSS が入らない（実際の Chrome で確かめた）。Chrome は見た目を
 * 部品ごとの style に書き込むので、見た目（その瞬間の形）は持って来られる。SB の Widget の外枠は div.sb-custom。
 * 外枠に書き込まれたページ全体の文字の設定は外す（LPの文字の設定を受け継ぐ）。リンクは付けない（本人の選択）。
 */
describe('SB の Widget（div.sb-custom）は、見た目のまま EBIyon の Widget として入れる', () => {
  const COPIED_WIDGET =
    '<p>前の文</p>' +
    '<div class="sb-custom" style="color: rgb(0, 0, 0); font-family: sans-serif; font-size: medium;">' +
    '<div class="cd-box" style="background: rgb(238, 51, 51); padding: 12px;" onclick="alert(1)">' +
    '<p>残り時間</p><div class="cd-num" style="font-size: 28px;">00:09:56</div>' +
    `<a class="cd-btn" href="https://sb.example.test/go" target="_blank">今すぐ申し込む</a>` +
    `<img data-src="${IMG_A}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">` +
    `<div style="background-image: url(&quot;${IMG_B}&quot;); height: 40px;"></div>` +
    '</div></div><p>後の文</p>'

  it('文・Widget・文の順。Widget の中の画像（背景の画像も）は写す印に置き換え、写す住所を持つ', () => {
    const parts = pasteParts(body(COPIED_WIDGET))
    expect(parts.map((part) => part.kind)).toEqual(['text', 'widget', 'text'])
    const widget = parts[1]
    if (widget?.kind !== 'widget') throw new Error('Widget がありません')
    expect(widget.images).toEqual([IMG_A, IMG_B])
    expect(widget.html).toContain('src="nc-paste-img-0"')
    expect(widget.html).toContain('nc-paste-img-1')
    expect(widget.html).not.toContain(IMG_A)
    expect(widget.html).not.toContain('data-src')
  })

  it('見た目（部品ごとの style）は残し、外枠のページ全体の文字の設定・押したときの命令・リンク先は外す', () => {
    const widget = pasteParts(body(COPIED_WIDGET))[1]
    if (widget?.kind !== 'widget') throw new Error('Widget がありません')
    expect(widget.html).toContain('background: rgb(238, 51, 51)')
    expect(widget.html).toContain('font-size: 28px')
    expect(widget.html).toContain('今すぐ申し込む')
    expect(widget.html).not.toContain('font-family: sans-serif')
    expect(widget.html).not.toContain('onclick')
    expect(widget.html).not.toContain('sb.example.test')
    expect(widget.html).toContain('href="#"')
  })

  it('写した住所に置き換えて Widget として入れる。写せなかった画像は外して数える', async () => {
    const quill = fakeQuill()
    const parts = pasteParts(body(COPIED_WIDGET))
    const result = await pasteWithImages(quill, parts, async (src) => (src === IMG_A ? '/uploads/aaa.jpg' : null))
    const widgetLine = quill.doc.find((line) => line.startsWith('sbwidget:')) ?? ''
    expect(widgetLine).toContain('src="/uploads/aaa.jpg"')
    expect(widgetLine).not.toContain('nc-paste-img')
    expect(widgetLine).toContain('background-image: none')
    expect(result).toEqual({ images: 1, videos: 0, widgets: 1, failed: 1, missingVideos: 0, missingWidgets: 0 })
  })
})

/**
 * 動画も入れる・コピーに中身が入っていない物は入れずに知らせる（2026-10-31 本人「動画がコピーできない」
 * 「Widgetはこんな感じで何も入っていないWidgetになる」）。実際の Chrome で確かめたこと:
 *  - <video><source src> の <source> はコピーに入らない（住所が無くなる）。<video src>・data-src は残る
 *  - 文字を選べない作り（user-select:none）の Widget は、中身の無い外枠だけになる
 *  - スクロールで出る Widget（opacity:0 から出る）は、透明のまま入る
 */
describe('動画', () => {
  const VIDEO_A = 'https://media.example.test/a.mp4'

  it('住所の残っている動画（src・data-src）は動画として入れる。住所の無い動画は入れずに数える', () => {
    const parts = pasteParts(body(`<p>前</p><video data-src="${VIDEO_A}" autoplay muted></video><video autoplay muted></video><p>後</p>`))
    expect(parts).toEqual<PastePart[]>([
      { kind: 'text', text: '前\n' },
      { kind: 'video', src: VIDEO_A },
      { kind: 'missing', what: 'video' },
      { kind: 'text', text: '後\n' },
    ])
  })

  it('写した動画を入れ、入れなかった物を数える', async () => {
    const quill = fakeQuill()
    const result = await pasteWithImages(
      quill,
      [{ kind: 'video', src: VIDEO_A }, { kind: 'missing', what: 'video' }, { kind: 'missing', what: 'widget' }],
      async () => '/uploads/v.mp4',
    )
    expect(quill.doc).toContain('sbvideo:/uploads/v.mp4')
    expect(result).toEqual({ images: 0, videos: 1, widgets: 0, failed: 0, missingVideos: 1, missingWidgets: 1 })
  })
})

describe('中身の入っていない Widget・透明の Widget', () => {
  it('中身の無い外枠だけの Widget は入れずに数える（空の枠を入れない）', () => {
    expect(pasteParts(body('<p>前</p><div class="sb-custom" style="color: rgb(0, 0, 0);"></div>'))).toEqual<PastePart[]>([
      { kind: 'text', text: '前\n' },
      { kind: 'missing', what: 'widget' },
    ])
  })

  it('スクロールで出る前の透明（opacity:0・visibility:hidden）は外して、見えるようにする', () => {
    const widget = pasteParts(body('<div class="sb-custom"><div class="hid" style="opacity: 0; color: red;">出る前</div><p style="visibility: hidden;">隠れ</p></div>'))[0]
    if (widget?.kind !== 'widget') throw new Error('Widget がありません')
    expect(widget.html).not.toContain('opacity: 0')
    expect(widget.html).not.toContain('visibility: hidden')
    expect(widget.html).toContain('color: red')
  })

  it('Widget の中の動画も写す印にする（住所の無い動画は外す）', () => {
    const widget = pasteParts(body('<div class="sb-custom"><p>見出し</p><video src="https://media.example.test/w.mp4"></video><video></video></div>'))[0]
    if (widget?.kind !== 'widget') throw new Error('Widget がありません')
    expect(widget.images).toEqual(['https://media.example.test/w.mp4'])
    expect(widget.html).toContain('src="nc-paste-img-0"')
    expect(widget.html.match(/<video/g)).toHaveLength(1)
  })
})
