/**
 * 「SBコピー」にチェックを入れて貼ったときは、SB の飾り（色・下線・マーカー・太字・大きさを変えた所）をそのまま残す
 * （2026-10-31 本人「SBからコピペした際は書式やカラー・下線・マーカー等をSBそのまま維持したい」「保存済みの左に SBコピーって
 * ボタン設けてチェック入ってるなら、維持する」）。
 *
 * 本人の選択: チェックは開くたびに外れる／文字の土台（LP全体の書体・大きさ・色）は EBIyon の LP設定・飾りは SB のまま。
 * Chrome はコピーのとき、いちばん外の行にページ全体の文字の設定（書体・大きさ・色…）を書き込み、中の飾りは違う所だけを書き込む。
 * いちばん外の行で、ほかの行と同じ値（＝ページ全体の設定）だけを外し、違う値（見出しの大きさ・中央寄せ）と中の飾りは残す。
 * リンクは付けない（本人の選択）。画像・Widget は今までどおり EBIyon に写して入れる。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { fillMediaTokens, keepSbFormatOps, markSbMarkers, stripPageBase, tokenizeMedia, type ConvertQuill } from '../src/app/pages/paste-sb-format.ts'

const BASE = 'color: rgb(51, 51, 51); font-family: &quot;Hiragino Sans&quot;, sans-serif; font-size: 16px; font-weight: 400; text-align: start;'
const IMG_A = 'https://img.example.test/lp/a.jpg'
const COPIED =
  `<p style="${BASE}">普通の文<span style="color: rgb(255, 0, 0);">赤い文</span>` +
  '<span style="background-image: linear-gradient(transparent 60%, rgb(255, 238, 0) 60%);">マーカー</span>' +
  '<u>下線</u><a href="https://sb.example.test/r">リンクの文</a></p>' +
  `<h2 style="${BASE.replace('font-size: 16px', 'font-size: 24px').replace('text-align: start', 'text-align: center')}">見出し</h2>` +
  `<p style="${BASE}"><a href="https://sb.example.test/b"><img src="${IMG_A}"></a></p>` +
  '<div class="sb-custom" style="color: rgb(51, 51, 51);"><div style="background: rgb(238, 51, 51);">Widget</div></div>'

const root = (): HTMLElement => {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${COPIED}</div></body></html>`)
  return document.getElementById('r') as unknown as HTMLElement
}

describe('ページ全体の文字の設定だけを外す（文字の土台は EBIyon の LP設定）', () => {
  it('いちばん外の行のページ全体の設定（書体・大きさ・色）は外し、見出しの大きさ・中央寄せと中の飾りは残す', () => {
    const r = root()
    stripPageBase(r)
    const [p, h2] = Array.from(r.children) as HTMLElement[]
    expect(p?.getAttribute('style') ?? '').toBe('')
    expect(h2?.getAttribute('style')).toBe('font-size: 24px; text-align: center')
    expect(r.querySelector('span')?.getAttribute('style')).toBe('color: rgb(255, 0, 0);')
    expect(r.innerHTML).toContain('background-image: linear-gradient')
  })
})

describe('画像・Widget は写す印に置き換え、リンクは外す', () => {
  it('リンクは文字だけ残す・画像と Widget は並びの所に印を置く', () => {
    const r = root()
    const media = tokenizeMedia(r)
    expect(r.querySelector('a')).toBeNull()
    expect(r.textContent).toContain('リンクの文')
    expect(media.images).toEqual([IMG_A])
    expect(media.widgets).toHaveLength(1)
    expect(media.widgets[0]?.html).toContain('background: rgb(238, 51, 51)')
    expect(r.textContent).toContain('\uE000I0\uE000')
    expect(r.textContent).toContain('\uE000W0\uE000')
  })
})

describe('印を、写した画像・Widget に置き換える', () => {
  it('文字の飾りはそのまま。画像は写した住所、写せなかった画像は外して数える。リンクの飾りは付けない', () => {
    const ops = [
      { insert: '赤い文', attributes: { color: '#ff0000', link: 'https://sb.example.test/r' } },
      { insert: '前\uE000I0\uE000後\uE000I1\uE000', attributes: { bold: true } },
      { insert: '\n' },
      { insert: '\uE000W0\uE000\n' },
    ]
    const out = fillMediaTokens(ops, new Map([[0, '/uploads/a.jpg'], [1, null]]), [{ html: '<div>W</div>' }])
    expect(out.ops).toEqual([
      { insert: '赤い文', attributes: { color: '#ff0000' } },
      { insert: '前', attributes: { bold: true } },
      { insert: { image: '/uploads/a.jpg' } },
      { insert: '後', attributes: { bold: true } },
      { insert: '\n' },
      { insert: { sbwidget: '<div>W</div>' } },
      { insert: '\n' },
    ])
    expect(out.failed).toBe(1)
  })
})

describe('貼り付け全体', () => {
  it('カーソルの所へ、選んでいた文字を置き換えて入れる（写している間は編集を止め、入れる前に戻す）', async () => {
    const calls: string[] = []
    let on = true
    const quill: ConvertQuill = {
      getSelection: () => ({ index: 5, length: 2 }),
      enable: (next = true) => {
        on = next
        calls.push(`enable:${String(next)}`)
      },
      clipboard: { convert: ({ html }) => ({ ops: [{ insert: html.includes('赤い文') ? '本文\uE000I0\uE000\uE000W0\uE000' : '?' }, { insert: '\n' }] }) },
      updateContents: (ops) => {
        if (!on) return
        calls.push(`update:${JSON.stringify(ops)}`)
      },
      setSelection: (index) => {
        calls.push(`select:${String(index)}`)
      },
    }
    const result = await keepSbFormatOps(quill, COPIED, async () => '/uploads/a.jpg', (html) =>
      parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`).document.getElementById('r') as unknown as HTMLElement,
    )
    expect(result).toEqual({ images: 1, videos: 0, widgets: 1, failed: 0, missingVideos: 0, missingWidgets: 0 })
    expect(calls[0]).toBe('enable:false')
    expect(calls[1]).toBe('enable:true')
    const update = JSON.parse((calls[2] ?? '').replace(/^update:/, '')) as unknown[]
    expect(update.slice(0, 4)).toEqual([{ retain: 5 }, { delete: 2 }, { insert: '本文' }, { insert: { image: '/uploads/a.jpg' } }])
    expect(JSON.stringify(update[4])).toContain('sbwidget')
    expect(update[5]).toEqual({ insert: '\n' })
    // 入れた中身（本文2文字・画像・Widget・改行）のすぐあと＝5＋5
    expect(calls[3]).toBe('select:10')
  })
})

/**
 * SB のマーカーは「文字の下側に色を敷く」background-image（linear-gradient(transparent 60%, 色 60%)）で来る。
 * EBIyon のマーカー（span.sb-marker・色・太さ・不透明度）にしないと、編集画面が読まずに捨てていた（手元で確かめた）。
 */
describe('SB のマーカーを EBIyon のマーカーにする', () => {
  const span = (style: string): HTMLElement => {
    const { document } = parseHTML(`<!doctype html><html><body><div id="r"><p>前<span style="${style}">マーカー</span>後</p></div></body></html>`)
    const r = document.getElementById('r') as unknown as HTMLElement
    markSbMarkers(r)
    return r.querySelector('span') as unknown as HTMLElement
  }

  it('色と太さ（帯の高さ）を読み、ほかの飾り（文字の色など）は残す', () => {
    const marked = span('color: rgb(255, 0, 0); background-image: linear-gradient(transparent 60%, rgb(255, 238, 0) 60%);')
    expect(marked.classList.contains('sb-marker')).toBe(true)
    expect(marked.getAttribute('data-marker')).toBe('#ffee00,40,100')
    expect(marked.getAttribute('style')).toBe('color: rgb(255, 0, 0)')
  })

  it('半透明の色・向きの書いてある形も読む', () => {
    expect(span('background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 70%, rgba(255, 0, 0, 0.5) 70%);').getAttribute('data-marker')).toBe('#ff0000,30,50')
  })

  it('マーカーでない背景の画像（写真など）はそのまま', () => {
    const plain = span('background-image: url(&quot;https://img.example.test/a.jpg&quot;);')
    expect(plain.classList.contains('sb-marker')).toBe(false)
  })
})

it('Widget の中のマーカーは置き換えない（Widget は見た目のまま入るので、帯は style のまま）', () => {
  const { document } = parseHTML(
    '<!doctype html><html><body><div id="r"><div class="sb-custom"><span style="background-image: linear-gradient(transparent 60%, rgb(255, 238, 0) 60%);">帯</span></div></div></body></html>',
  )
  const r = document.getElementById('r') as unknown as HTMLElement
  markSbMarkers(r)
  expect(r.querySelector('span')?.getAttribute('style')).toContain('linear-gradient')
  expect(r.querySelector('.sb-marker')).toBeNull()
})
