/**
 * Widget の外枠（`<section class="sb-widget-block">`）に編集画面が付ける属性を、画面の外に出すHTMLから外す（2026-09-22）。
 *
 * LP の HTML は編集中の本文をそのまま保存するので、編集画面が自分の表示のために外枠へ付けた属性まで保存され、
 * 公開LPにもそのまま出ていた（実測: `data-widget-name="MuiBox-root"`）。見る人には意味が無い。
 *   - data-widget-name     … 編集画面がホバー時の名前に付けていた（52da45e で名前の表示ごとやめた。それより前に保存したLPに残っている）
 *   - data-widget-selected … 選択中の青枠の目印（編集画面の選択CSS だけが見る。保存済みのLPにあれば外す）
 *   - contenteditable      … Quill の中で Widget を「文字を打てない1かたまり」にする（media-blots.ts の SbWidgetBlot）。
 *                            もともと編集できないページでは、有っても無くても表示も操作も同じ。
 *                            配信のCSS・スクリプト（計測タグ・リンク・アニメ・ポップアップ）もこの属性を見ていない
 * 残すもの: class（配信のCSS `section.sb-widget-block`・`:where(.sb-widget-block)` が使う）・data-widget-block・style（外枠の余白）。
 * Widget の中身には触らない（中の要素が自分で持つ contenteditable 等はそのまま）。
 *
 * 保存データは書き換えない（本人指定）。編集画面は保存データを読むので、`contenteditable="false"` はこれまでどおり届く
 * （保存HTMLから開くとき、Quill は外枠の要素をそのまま使い SbWidgetBlot.create を通らないので、保存データのこの属性が頼り）。
 *
 * 既知の限界: スクリプトの文字列・コメント・section 以外のタグの属性の値の中に `<section class="sb-widget-block" …>` と
 * 書かれていても外枠として扱う（相手は Quill が書き出す普通のHTMLなので考慮しない。link-html.ts と同じ割り切り）。
 * それ以外は、ブラウザの HTML の読み取り（DOMParser）で読んだ結果が「外枠から3つの属性が消えただけ」になることを、
 * 乱数で作った HTML 2万4千件で確かめた（2026-09-22）。
 */

/** Widget の外枠の目印（配信のCSSもこれを使う） */
const WIDGET_CLASS = 'sb-widget-block'

/** 編集画面だけが使う、Widget の外枠の属性（名前は小文字で比べる） */
const EDITOR_ONLY_ATTRIBUTES: readonly string[] = ['data-widget-name', 'data-widget-selected', 'contenteditable']

interface TagAttribute {
  /** 小文字にした名前 */
  name: string
  /** 引用符を外した値（値なしは null）。文字参照はほどかない */
  value: string | null
  /** 書かれたままの属性（名前の始まりから値の終わりまで） */
  source: string
}

/** タグの中で属性を区切る空白（HTML の決まり） */
function isHtmlSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f'
}

/**
 * 開始タグの属性を、タグ名の直後（from）から順に読む。引用符の中の `>` はタグの終わりとみなさない。
 * タグが閉じていなければ null。
 */
function readAttributes(html: string, from: number): { attributes: TagAttribute[]; end: number } | null {
  const attributes: TagAttribute[] = []
  let i = from
  for (;;) {
    while (isHtmlSpace(html.charAt(i))) i += 1
    const ch = html.charAt(i)
    if (ch === '') return null
    if (ch === '>') return { attributes, end: i + 1 }
    if (ch === '/') {
      i += 1
      continue
    }
    const nameStart = i
    // 名前の1文字目は `=` でもよい（HTML の決まり）ので、1文字進めてから区切りを探す
    i += 1
    while (i < html.length && !isHtmlSpace(html.charAt(i)) && !'/>='.includes(html.charAt(i))) i += 1
    const name = html.slice(nameStart, i).toLowerCase()
    let value: string | null = null
    let j = i
    while (isHtmlSpace(html.charAt(j))) j += 1
    if (html.charAt(j) === '=') {
      j += 1
      while (isHtmlSpace(html.charAt(j))) j += 1
      const quote = html.charAt(j)
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, j + 1)
        if (close === -1) return null
        value = html.slice(j + 1, close)
        i = close + 1
      } else {
        const valueStart = j
        while (j < html.length && !isHtmlSpace(html.charAt(j)) && html.charAt(j) !== '>') j += 1
        value = html.slice(valueStart, j)
        i = j
      }
    }
    attributes.push({ name, value, source: html.slice(nameStart, i) })
  }
}

/** Widget の外枠か。class が2つあれば、ブラウザと同じく先の方を見る */
function isWidgetBlock(attributes: readonly TagAttribute[]): boolean {
  const cls = attributes.find((a) => a.name === 'class')?.value ?? ''
  return cls.split(/[\t\n\f\r ]+/).includes(WIDGET_CLASS)
}

/**
 * LP の HTML の、すべての Widget の外枠から編集画面だけの属性を外した新しい HTML を返す（元の文字列は変えない）。
 * 外枠の開始タグは、残す属性を書かれたまま半角空白1つずつで並べ直す（ほかの所は1文字も変えない）。
 * 外すものが無ければ元の文字列をそのまま返す。
 */
export function stripEditorWidgetAttributes(html: string): string {
  // 呼ぶたびに作る（global な正規表現の lastIndex を呼び出しの間で持ち越さない）
  const openTag = /<section(?=[\t\n\f\r />])/gi
  const parts: string[] = []
  let cursor = 0
  for (let m = openTag.exec(html); m !== null; m = openTag.exec(html)) {
    const tag = readAttributes(html, m.index + m[0].length)
    if (tag === null) continue
    // タグの中（属性の値）は次の探索に含めない（値の中の `<section` はタグではない）
    openTag.lastIndex = tag.end
    if (!isWidgetBlock(tag.attributes)) continue
    const kept = tag.attributes.filter((a) => !EDITOR_ONLY_ATTRIBUTES.includes(a.name))
    if (kept.length === tag.attributes.length) continue
    // 外した所の空白を詰めるだけだと、引用符なしの値に後ろの `/` がくっつくことがある（class=sb-widget-block/）。
    // 空白1つで並べ直せば、タグ名・名前・値のどれのあとでも区切りになる。`/>` の `/` は section では意味が無いので付けない
    parts.push(html.slice(cursor, m.index), m[0], ...kept.map((a) => ` ${a.source}`), '>')
    cursor = tag.end
  }
  if (parts.length === 0) return html
  parts.push(html.slice(cursor))
  return parts.join('')
}

/**
 * すべての Widget の外枠の class に cls を足した新しい HTML を返す（元の文字列は変えない）。
 * もう付いている外枠・外枠でない section はそのまま。外枠の開始タグは属性を書かれたまま半角空白1つずつで並べ直す
 * （stripEditorWidgetAttributes と同じ読み方・並べ方）。足す所が無ければ元の文字列をそのまま返す。
 */
export function addWidgetBlockClass(html: string, cls: string): string {
  const openTag = /<section(?=[\t\n\f\r />])/gi
  const parts: string[] = []
  let cursor = 0
  for (let m = openTag.exec(html); m !== null; m = openTag.exec(html)) {
    const tag = readAttributes(html, m.index + m[0].length)
    if (tag === null) continue
    openTag.lastIndex = tag.end
    if (!isWidgetBlock(tag.attributes)) continue
    const classAttr = tag.attributes.find((a) => a.name === 'class')
    const classes = (classAttr?.value ?? '').split(/[\t\n\f\r ]+/).filter((c) => c !== '')
    if (classAttr === undefined || classes.includes(cls)) continue
    const rewritten = tag.attributes.map((a) => (a === classAttr ? `class="${[...classes, cls].join(' ')}"` : a.source))
    parts.push(html.slice(cursor, m.index), m[0], ...rewritten.map((source) => ` ${source}`), '>')
    cursor = tag.end
  }
  if (parts.length === 0) return html
  parts.push(html.slice(cursor))
  return parts.join('')
}
