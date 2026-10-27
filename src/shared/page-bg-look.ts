/**
 * 記事設定の背景の画像の「位置と大きさ」（2026-10-27 指示⑱ 本人「背景画像なんだけど、ここでトリミングや大きさの調整をしたい」
 * → 選択「位置と大きさを動かす」）。画像は切らずにそのまま持ち、見え方（合わせ方・大きさ・位置）だけを決める＝何度でもやり直せる。
 * 画面（LP設定の見本・編集画面）とモックサーバー（配信・プレビュー）が同じ計算で当てるため、ここに置く（DOMを使わない）。
 *
 * 持ち方: 文字列1つ（MasterStyleSheet の outer_background_look / inner_background_look）。'' ＝今まで（全体を覆う・真ん中）。
 *   「合わせ方 大きさ 左右 上下 [画像の横÷縦]」例 `free 108 50 30 1.5`
 *   - 合わせ方: cover＝全体を覆う／contain＝全体を見せる／free＝大きさを自分で決める
 *   - 大きさ: free のときの「全体を覆う大きさ」に対する%（ノーコードWidgetの背景と同じ決まり・bg-move-math.ts）
 *   - 左右・上下: 背景の位置の決まり（0＝左・上の端、50＝真ん中、100＝右・下の端）
 *   - 画像の横÷縦: free の大きさを CSS だけで当てるのに使う（下の pageBgImageDecls）
 */

export type PageBgFit = 'cover' | 'contain' | 'free'

export interface PageBgLook {
  readonly fit: PageBgFit
  readonly size: number
  readonly x: number
  readonly y: number
  readonly ratio: number | null
}

export const DEFAULT_PAGE_BG_LOOK: PageBgLook = { fit: 'cover', size: 100, x: 50, y: 50, ratio: null }

/** 範囲（ノーコードWidgetの背景と同じ・はみ出して置くこともできる） */
export const PAGE_BG_SIZE_MIN = 10
export const PAGE_BG_SIZE_MAX = 400
export const PAGE_BG_POSITION_MIN = -100
export const PAGE_BG_POSITION_MAX = 200

const FITS: readonly PageBgFit[] = ['cover', 'contain', 'free']

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

function intIn(raw: string | undefined, min: number, max: number, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(raw === undefined || raw === '' ? Number.NaN : value) ? Math.round(clamp(value, min, max)) : fallback
}

/** 文字列から読む。知らない形・壊れた値は今まで（全体を覆う・真ん中）か、範囲の中へ */
export function parsePageBgLook(text: string | null | undefined): PageBgLook {
  const [fit, size, x, y, ratio] = (text ?? '').trim().split(/\s+/)
  if (!FITS.includes(fit as PageBgFit)) return DEFAULT_PAGE_BG_LOOK
  const r = Number(ratio)
  return {
    fit: fit as PageBgFit,
    size: intIn(size, PAGE_BG_SIZE_MIN, PAGE_BG_SIZE_MAX, DEFAULT_PAGE_BG_LOOK.size),
    x: intIn(x, PAGE_BG_POSITION_MIN, PAGE_BG_POSITION_MAX, DEFAULT_PAGE_BG_LOOK.x),
    y: intIn(y, PAGE_BG_POSITION_MIN, PAGE_BG_POSITION_MAX, DEFAULT_PAGE_BG_LOOK.y),
    // 極端に細長い画像は無いものとする（0・負・壊れた値は「分からない」）
    ratio: Number.isFinite(r) && r >= 0.05 && r <= 20 ? Math.round(r * 10000) / 10000 : null,
  }
}

/** 文字列にする。今まで（全体を覆う・真ん中）なら '' */
export function formatPageBgLook(look: PageBgLook): string {
  const isDefault = look.fit === 'cover' && look.x === DEFAULT_PAGE_BG_LOOK.x && look.y === DEFAULT_PAGE_BG_LOOK.y
  if (isDefault) return ''
  return `${look.fit} ${String(look.size)} ${String(look.x)} ${String(look.y)}${look.ratio === null ? '' : ` ${String(look.ratio)}`}`
}

/**
 * 背景の画像の層に当てるCSS（background-size と background-position）。
 * free の大きさ＝「全体を覆う大きさ」×%。全体を覆う横幅は「層の幅」と「層の高さ×画像の横÷縦」の大きい方。
 * 層は画面に固定した壁紙で、配信では高さ＝画面の高さ（100vh）。編集画面・見本は層の高さを --lp-bg-h で渡す
 */
export function pageBgImageDecls(look: PageBgLook): string {
  const size =
    look.fit === 'cover' || look.fit === 'contain'
      ? look.fit
      : look.ratio === null
        ? `${String(look.size)}% auto`
        : `calc(max(100%, var(--lp-bg-h, 100vh) * ${String(look.ratio)}) * ${String(look.size / 100)}) auto`
  return `background-size:${size};background-position:${String(look.x)}% ${String(look.y)}%`
}
