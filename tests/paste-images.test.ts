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
    expect(result).toEqual({ images: 1, failed: 0 })
  })

  it('写せなかった画像は入れずに数える。写している間は編集を止め、終わったら戻す', async () => {
    const quill = fakeQuill()
    const result = await pasteWithImages(quill, [{ kind: 'image', src: IMG_A }, { kind: 'image', src: IMG_B }], async (src) =>
      src === IMG_A ? '/uploads/aaa.jpg' : null,
    )
    expect(result).toEqual({ images: 1, failed: 1 })
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
