/**
 * 部品の共通の欄と書き出しの小道具（2026-09-24・部品を増やすときに builder-blocks.ts から分けた）。
 * 幅と置く位置・押したとき・移る先の印は、どの部品でも同じものを使う（builder-blocks.ts と builder-blocks-more.ts から読む）。
 */
import { linkAttrs } from './kit.ts'
import { ALIGN_ICONS, PLACE_ICONS } from './option-icons.ts'
import { bool, pick, str, type Field, type ItemData } from './types.ts'

/** 画面のid（s1, s2…）。これ以外は移る先にしない */
export const SCREEN_ID = /^s\d{1,4}$/

/**
 * 大きさの数（px・%）。以前の「大/中/小」「s/m/l」の選びは presets で数に読み替える
 * （2026-09-23・Canva風に数字でドラッグできるようにした。古い中身もそのまま読める）。
 * 範囲の外は端に、読めない値は fallback。0.5 刻み
 */
export function sizeOf(item: ItemData, key: string, presets: Readonly<Record<string, number>>, min: number, max: number, fallback: number): number {
  const value = item[key]
  const preset = typeof value === 'string' ? presets[value] : undefined
  const n = preset ?? (typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 2) / 2)) : fallback
}

export const ALIGNS = ['left', 'center', 'right'] as const
export const ALIGN_OPTIONS = [
  { value: 'left', label: '左に寄せる', short: '左', icon: ALIGN_ICONS.left },
  { value: 'center', label: '真ん中', short: '真ん中', icon: ALIGN_ICONS.center },
  { value: 'right', label: '右に寄せる', short: '右', icon: ALIGN_ICONS.right },
]

/**
 * 部品を置く位置（2026-09-24・本人「部品ごとに中央揃えや左右へ。サイズも変えられるように」）。
 * どの部品にも「幅（%）」と「置く位置」がある。幅の欄の名前は部品によって違う（widthKeyOf）
 */
export const PLACES = ['left', 'center', 'right'] as const
export type Place = (typeof PLACES)[number]
export const PLACE_OPTIONS = [
  { value: 'left', label: '左に置く', short: '左', icon: PLACE_ICONS.left },
  { value: 'center', label: '中央に置く', short: '中央', icon: PLACE_ICONS.center },
  { value: 'right', label: '右に置く', short: '右', icon: PLACE_ICONS.right },
]

/**
 * 幅と置く位置の入力（どの部品でも、いちばん上に出す＝選んだらすぐ直せる）。
 * 値が無い部品（見本の部品・以前の中身）は、書き出し（layoutCss）と同じ 幅100%・中央 を欄にも見せる
 */
export function layoutFields(widthKey: string): readonly Field[] {
  return [
    { kind: 'number', key: widthKey, label: '幅', min: 10, max: 100, unit: '%', fallback: 100, section: 'layout' },
    { kind: 'select', key: 'place', label: '置く位置', options: PLACE_OPTIONS, fallback: 'center', section: 'layout' },
  ]
}

export const ACTIONS = ['none', 'screen', 'link'] as const
export type Action = (typeof ACTIONS)[number]

/**
 * 「押したとき」の入力（ボタン・画像・図形・動画・画像と文章）。
 * なし・画面②③…・＋新しい画面・リンクを開く をボタンで選ぶ（本人の依頼「画面2・3・4・5…として簡単に設定」）
 */
export function actionFields(): readonly Field[] {
  return [
    { kind: 'goto', key: 'action', label: '押したとき', section: 'press' },
    { kind: 'url', key: 'url', label: '開くページ', placeholder: 'https://', showIfItem: (item) => str(item, 'action') === 'link', section: 'press' },
    { kind: 'toggle', key: 'track', label: 'クリック数をレポートで数える', showIfItem: (item) => str(item, 'action') === 'link', section: 'press' },
  ]
}

export const NO_ACTION = { action: 'none', target: '', url: '', track: true }

export function actionOf(item: ItemData): Action {
  return pick(item, 'action', ACTIONS, 'none')
}

/** 押したら移る先（今ある画面だけ。無ければ null） */
export function goTarget(item: ItemData, screenIds: ReadonlySet<string>): string | null {
  const target = str(item, 'target')
  return actionOf(item) === 'screen' && SCREEN_ID.test(target) && screenIds.has(target) ? target : null
}

/** 押したら移る印（ボタン・リンク以外には「押せる」印と、キーボードで選べる印も付ける） */
export function goAttrs(target: string | null, isControl: boolean): string {
  if (target === null) return ''
  return ` data-nc-go="${target}"${isControl ? '' : ' role="button" tabindex="0"'}`
}

/** リンクで包む（「リンクを開く」のとき） */
export function withLink(item: ItemData, className: string, inner: string): string {
  if (actionOf(item) !== 'link' || str(item, 'url').trim() === '') return inner
  return `<a class="${className}"${linkAttrs(str(item, 'url'), { track: bool(item, 'track'), newTab: false })}>${inner}</a>`
}

/** 左・中央・右 に置く左右の余白 */
export function placeMargins(place: Place): string {
  if (place === 'left') return 'margin-left:0;margin-right:auto'
  if (place === 'right') return 'margin-left:auto;margin-right:0'
  return 'margin-left:auto;margin-right:auto'
}
