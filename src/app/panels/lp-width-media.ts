/**
 * 編集画面で @media（画面幅の条件）を「LPの幅（620px）」で判定する（本人指定・2026-09-10）。
 *
 * ブラウザは @media をウィンドウの幅で判定する。PCで編集画面を開くと、スマホ用の値が
 * 「画面幅768px以上」の値に上書きされ、スマホ用の値を変えても見た目が動かなかった。
 * 公開LPは配信幅620pxなので、編集画面の見た目（Widget編集のプレビュー・LP編集画面）だけは
 * 620pxの画面として判定し直す。**保存するCSSは書き換えない**（表示用に作り直すだけ）。
 *
 * 幅の条件（min-width / max-width / width の範囲。px・em・rem）はここで決める。
 * 決められない条件（prefers-reduced-motion・hover・高さ・not 付き など）は残して、ブラウザに任せる。
 */

/** 公開LPの配信幅（mock-server/routes/delivery.ts の DELIVERY_WIDTH と同じ値） */
export const LP_WIDTH = 620
/** @media の em / rem は常に 16px で計算される */
const EM_PX = 16

export interface MediaVerdict {
  /** この条件の中身を使うか（幅の条件で外れたら false） */
  readonly applies: boolean
  /** ブラウザに任せる残りの条件（空文字＝いつも使う） */
  readonly rest: string
}

function lengthPx(value: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|em|rem)$/i.exec(value.trim())
  if (m === null) return null
  const n = Number(m[1])
  return (m[2] ?? '').toLowerCase() === 'px' ? n : n * EM_PX
}

function compare(a: number, op: string, b: number): boolean {
  if (op === '<') return a < b
  if (op === '<=') return a <= b
  if (op === '>') return a > b
  if (op === '>=') return a >= b
  return a === b
}

/** 条件1つを判定する。幅の条件でなければ null（ブラウザに任せる） */
function evaluateTerm(term: string, width: number): boolean | null {
  const t = term.trim()
  const lower = t.toLowerCase()
  if (lower === 'all' || lower === 'screen') return true
  if (lower === 'print' || lower === 'speech') return false

  const feature = /^\(\s*(min-|max-)?width\s*:\s*([^)]+)\)$/i.exec(t)
  if (feature !== null) {
    const px = lengthPx(feature[2] ?? '')
    if (px === null) return null
    const kind = (feature[1] ?? '').toLowerCase()
    if (kind === 'min-') return width >= px
    if (kind === 'max-') return width <= px
    return width === px
  }

  // 範囲の書き方: (width >= 768px) / (400px <= width < 700px)
  const range =
    /^\(\s*(?:(-?\d*\.?\d+(?:px|em|rem))\s*(<=|<|>=|>)\s*)?width\s*(?:(<=|<|>=|>|=)\s*(-?\d*\.?\d+(?:px|em|rem)))?\s*\)$/i.exec(t)
  if (range !== null && (range[1] !== undefined || range[4] !== undefined)) {
    if (range[1] !== undefined) {
      const px = lengthPx(range[1])
      if (px === null || !compare(px, range[2] ?? '', width)) return px === null ? null : false
    }
    if (range[4] !== undefined) {
      const px = lengthPx(range[4])
      if (px === null) return null
      return compare(width, range[3] ?? '', px)
    }
    return true
  }
  return null
}

/** @media の条件を「LPの幅の画面」で判定する */
export function mediaAtLpWidth(mediaText: string, width = LP_WIDTH): MediaVerdict {
  const branches = mediaText
    .split(',')
    .map((b) => b.trim())
    .filter((b) => b !== '')
  if (branches.length === 0) return { applies: true, rest: '' }
  const rests: string[] = []
  for (const branch of branches) {
    // 「not」付きは言い換えを誤りやすいので判定せず、そのままブラウザに任せる
    if (/^not\s/i.test(branch)) {
      rests.push(branch)
      continue
    }
    const terms = branch.replace(/^only\s+/i, '').split(/\s+and\s+/i)
    let applies = true
    const rest: string[] = []
    for (const term of terms) {
      const verdict = evaluateTerm(term, width)
      if (verdict === false) {
        applies = false
        break
      }
      if (verdict === null) rest.push(term.trim())
    }
    if (!applies) continue
    if (rest.length === 0) return { applies: true, rest: '' }
    rests.push(rest.join(' and '))
  }
  return rests.length === 0 ? { applies: false, rest: '' } : { applies: true, rest: rests.join(', ') }
}

/** いまの編集画面（LPの幅で判定）で、この @media の中身が使われるか */
export function lpMediaMatches(mediaText: string): boolean {
  const verdict = mediaAtLpWidth(mediaText)
  return verdict.applies && (verdict.rest === '' || window.matchMedia(verdict.rest).matches)
}
