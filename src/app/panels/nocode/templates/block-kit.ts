/**
 * 部品の共通の欄と書き出しの小道具（2026-09-24・部品を増やすときに builder-blocks.ts から分けた）。
 * 幅と置く位置・押したとき・移る先の印は、どの部品でも同じものを使う（builder-blocks.ts と builder-blocks-more.ts から読む）。
 */
import { linkAttrs } from './kit.ts'
import { ALIGN_ICONS, PLACE_ICONS, SCROLL_ICONS } from './option-icons.ts'
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

/**
 * LP上のアクション（2026-09-24・本人「LP上アクションをできるように。画像を表示したりクーポンみたいな」）。
 * 画像を大きく・動画を大きく・クーポン・小窓（中身は画面）・LPの場所へ移動・文字をコピー・電話をかける・閉じる。
 * 書き出しとスクリプトは press-actions.ts
 */
export const LP_ACTIONS = ['image', 'video', 'coupon', 'modal', 'scroll', 'copy', 'tel', 'close'] as const
export type LpAction = (typeof LP_ACTIONS)[number]
export const ACTIONS = ['none', 'screen', 'link', ...LP_ACTIONS] as const
export type Action = (typeof ACTIONS)[number]

/** 電話番号の数字（と先頭の +）だけ。tel: に使う（全角の数字も読む） */
export function telDigits(number: string): string {
  const half = number.replace(/[０-９＋]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  const plus = half.trim().startsWith('+') ? '+' : ''
  return plus + half.replace(/[^0-9]/g, '')
}

/** LP上のアクションの入力（選んだアクションの分だけ出す） */
function lpActionFields(): readonly Field[] {
  const when =
    (...actions: string[]) =>
    (item: ItemData): boolean =>
      actions.includes(str(item, 'action'))
  return [
    { kind: 'image', key: 'actImage', label: '大きく見せる画像', showIfItem: when('image'), section: 'press' },
    { kind: 'video', key: 'actVideo', label: '大きく再生する動画（mp4・webm、30MBまで）', showIfItem: when('video'), section: 'press' },
    { kind: 'text', key: 'actTitle', label: 'クーポンの上の文字（任意）', placeholder: '初回限定クーポン', maxLength: 30, showIfItem: when('coupon'), section: 'press' },
    { kind: 'text', key: 'actAmount', label: 'クーポンの割引', placeholder: '500円OFF', maxLength: 20, showIfItem: when('coupon'), section: 'press' },
    { kind: 'text', key: 'actCode', label: 'クーポンコード（任意。コピーのボタンが付きます）', placeholder: 'WELCOME500', maxLength: 40, showIfItem: when('coupon'), section: 'press' },
    { kind: 'text', key: 'actNote', label: 'クーポンの注釈（任意）', placeholder: '有効期限: 10月31日まで', maxLength: 60, showIfItem: when('coupon'), section: 'press' },
    {
      kind: 'select',
      key: 'actScroll',
      label: '移動する場所',
      options: [
        { value: 'top', label: 'LPのいちばん上', short: 'いちばん上', icon: SCROLL_ICONS.top },
        { value: 'below', label: 'このWidgetのすぐ下', short: 'すぐ下', icon: SCROLL_ICONS.below },
        { value: 'id', label: 'LPの目印（id）で指定', short: '目印で指定', icon: SCROLL_ICONS.id },
      ],
      fallback: 'below',
      showIfItem: when('scroll'),
      section: 'press',
    },
    {
      kind: 'text',
      key: 'actAnchor',
      label: 'LPの目印（id。半角英数字・-・_）',
      placeholder: 'form',
      maxLength: 64,
      showIfItem: (item) => str(item, 'action') === 'scroll' && str(item, 'actScroll') === 'id',
      section: 'press',
    },
    { kind: 'text', key: 'actCopy', label: 'コピーする文字', placeholder: 'WELCOME500', maxLength: 200, showIfItem: when('copy'), section: 'press' },
    { kind: 'text', key: 'actTel', label: '電話番号', placeholder: '0120-000-000', maxLength: 20, showIfItem: when('tel'), section: 'press' },
  ]
}

/**
 * 「押したとき」の入力（ボタン・画像・図形・動画・画像と文章）。
 * なし・画面②③…・＋新しい画面・リンクを開く をボタンで選ぶ（本人の依頼「画面2・3・4・5…として簡単に設定」）
 */
export function actionFields(): readonly Field[] {
  return [
    { kind: 'goto', key: 'action', label: '押したとき', section: 'press' },
    { kind: 'url', key: 'url', label: '開くページ', placeholder: 'https://', showIfItem: (item) => str(item, 'action') === 'link', section: 'press' },
    {
      kind: 'toggle',
      key: 'track',
      label: 'クリック数をレポートで数える',
      showIfItem: (item) => str(item, 'action') === 'link' || str(item, 'action') === 'tel',
      section: 'press',
    },
    ...lpActionFields(),
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
  const href = hrefOf(item)
  if (href === null) return inner
  return `<a class="${className}"${linkAttrs(href, { track: bool(item, 'track'), newTab: false })}>${inner}</a>`
}

/** 押したら開くリンク（リンクを開く＝URL、電話をかける＝tel:）。リンクでなければ null */
export function hrefOf(item: ItemData): string | null {
  const action = actionOf(item)
  if (action === 'link') {
    const url = str(item, 'url').trim()
    return url === '' ? null : url
  }
  if (action === 'tel') {
    const digits = telDigits(str(item, 'actTel'))
    return digits.replace('+', '').length >= 3 ? `tel:${digits}` : null
  }
  return null
}

/** 左・中央・右 に置く左右の余白 */
export function placeMargins(place: Place): string {
  if (place === 'left') return 'margin-left:0;margin-right:auto'
  if (place === 'right') return 'margin-left:auto;margin-right:0'
  return 'margin-left:auto;margin-right:auto'
}
