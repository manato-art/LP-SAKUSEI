/**
 * 増やした部品（2026-09-24・本人「部品を足すの部品の数を増やして。必ず『移行先』を作る」）。
 *
 * - 移行先: ボタンや見本Widgetに被せる透明な押せる範囲（hotspot-model.ts）。押したら画面②③…かURLへ
 * - 吹き出し・価格・囲み枠・注意書き・表・星の評価・バッジ・画像を並べる・ポイント・数字で見せる・開いて読む・下向きの矢印
 *
 * 入力欄と足したときの中身と、保存の前の確かめはここ。書き出しは builder-blocks-more-render.ts。
 * 決まりは今までの部品と同じ: いちばん上に「幅」と「置く位置」（移行先だけは被せた部品に対する位置と大きさ）、
 * 入力の文字はタグにしない、選ぶ入力には絵を付ける。
 */
import { isRichEmpty } from '../rich-text.ts'
import { NO_ACTION, actionFields, layoutFields } from './block-kit.ts'
import { safeImage } from './kit.ts'
import { BADGE_LOOK_ICONS, BOX_LOOK_ICONS, SIDE_ICONS } from './option-icons.ts'
import { ACCENT_PRESETS, str, type BlockType, type ItemData } from './types.ts'

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** 吹き出しの地の色（淡い色だけ。中の文字は濃い色のまま読める） */
const BUBBLE_PRESETS: readonly string[] = ['#F1F3F5', '#FFF4E5', '#E8F4FF', '#EAF7EE', '#FDECEF', '#FFFFFF']
/** 星の色 */
const STAR_PRESETS: readonly string[] = ['#F2A516', '#E5573F', '#1F2A37']
/** 開いて読むの文字と線の色（文字に使うので暗い色だけ） */
const INK_PRESETS: readonly string[] = ['#1F2A37', '#155BB0', '#B83A26', '#0B7A3E']

/** 表の1行（「|」か全角の「｜」で区切る。4列まで） */
export function tableRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => line.split(/[|｜]/).map((cell) => cell.trim()).slice(0, 4))
}

export const MORE_BLOCK_TYPES: readonly BlockType[] = [
  {
    type: 'hotspot',
    label: '移行先',
    icon: svg('<rect x="3" y="4" width="15" height="11" rx="2" stroke-dasharray="3 2.2"/><path d="M13 11l7.5 3.2-3.2 1.3-1.3 3.2z"/>'),
    // 位置と大きさは、被せた部品に対する %（見たまま画面で斜線の枠をつかんで動かす・四辺で大きさ）
    fields: [
      { kind: 'number', key: 'x', label: '左から', min: 0, max: 95, unit: '%', step: 0.5, fallback: 0, section: 'layout' },
      { kind: 'number', key: 'y', label: '上から', min: 0, max: 95, unit: '%', step: 0.5, fallback: 0, section: 'layout' },
      { kind: 'number', key: 'w', label: '幅', min: 5, max: 100, unit: '%', step: 0.5, fallback: 100, section: 'layout' },
      { kind: 'number', key: 'h', label: '高さ', min: 5, max: 100, unit: '%', step: 0.5, fallback: 100, section: 'layout' },
      ...actionFields(),
    ],
    newItem: () => ({ type: 'hotspot', x: 0, y: 0, w: 100, h: 100, ...NO_ACTION }),
  },
  {
    type: 'speech',
    label: '吹き出し',
    icon: svg('<circle cx="6" cy="8" r="3"/><path d="M11 5h9a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 14h-5l-3 3v-3h-1"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'image', key: 'avatar', label: '人物の写真（任意）' },
      { kind: 'text', key: 'name', label: '名前（任意）', placeholder: '30代・会社員', maxLength: 30 },
      { kind: 'textarea', key: 'text', label: 'セリフ', rows: 3, rich: true },
      {
        kind: 'select',
        key: 'side',
        label: '人物を置く側',
        options: [
          { value: 'left', label: '左', icon: SIDE_ICONS.left },
          { value: 'right', label: '右', icon: SIDE_ICONS.right },
        ],
        fallback: 'left',
      },
      { kind: 'color', key: 'color', label: '吹き出しの色', presets: BUBBLE_PRESETS },
    ],
    newItem: () => ({ type: 'speech', avatar: '', name: '', text: '', side: 'left', color: '#F1F3F5' }),
  },
  {
    type: 'price',
    label: '価格',
    icon: svg('<path d="M4 7h7M4 7l2.5 4M11 7l-2.5 4M7.5 11v6M5 13.5h5M5 16h5"/><path d="M14 17l6-10" opacity=".55"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'regularLabel', label: '通常価格の見出し', placeholder: '通常価格', maxLength: 20 },
      { kind: 'text', key: 'regular', label: '通常価格（取り消し線が付きます・任意）', placeholder: '9,800円', maxLength: 20 },
      { kind: 'text', key: 'label', label: '特別価格の見出し（任意）', placeholder: '初回限定', maxLength: 20 },
      { kind: 'text', key: 'price', label: '特別価格', placeholder: '1,980', maxLength: 20 },
      { kind: 'text', key: 'unit', label: '単位（任意）', placeholder: '円（税込）', maxLength: 20 },
      { kind: 'toggle', key: 'off', label: '割引率（◯%OFF）を出す' },
      { kind: 'color', key: 'color', label: '価格の色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({
      type: 'price',
      regularLabel: '通常価格',
      regular: '9,800円',
      label: '初回限定',
      price: '1,980',
      unit: '円（税込）',
      off: true,
      color: '#E5573F',
    }),
  },
  {
    type: 'box',
    label: '囲み枠',
    icon: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h7"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'title', label: '見出し（任意）', rich: true },
      { kind: 'textarea', key: 'text', label: '文章', rows: 3, rich: true },
      {
        kind: 'select',
        key: 'look',
        label: '見た目',
        options: [
          { value: 'soft', label: '淡い地', icon: BOX_LOOK_ICONS.soft },
          { value: 'line', label: '枠線', icon: BOX_LOOK_ICONS.line },
          { value: 'label', label: '見出しを帯に', short: '帯', icon: BOX_LOOK_ICONS.label },
        ],
        fallback: 'soft',
      },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'box', title: '', text: '', look: 'soft', color: '#1F7AE0' }),
  },
  {
    type: 'note',
    label: '注意書き',
    icon: svg('<path d="M5 7h14M5 12h14M5 17h9"/><path d="M3 5.5l.8.8M3.8 5.5l-.8.8" stroke-width="1.2"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'textarea', key: 'text', label: '注意書き（1行に1つ）', rows: 3 },
      { kind: 'toggle', key: 'mark', label: '頭に「※」を付ける' },
    ],
    newItem: () => ({ type: 'note', text: '', mark: true }),
  },
  {
    type: 'table',
    label: '表',
    icon: svg('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18M3 14.5h18M9.5 5v14"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'textarea', key: 'text', label: '表の中身（1行に1つ。項目と内容は「|」で区切ります）', rows: 5 },
      { kind: 'toggle', key: 'head', label: '1行目を見出しにする' },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'table', text: '内容量|30日分\n送料|無料\nお届け|最短翌日', head: false, color: '#1F7AE0' }),
  },
  {
    type: 'rating',
    label: '星の評価',
    icon: svg('<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'number', key: 'score', label: '点数（5点まで）', min: 0, max: 5, unit: '点', step: 0.1, fallback: 5 },
      { kind: 'text', key: 'label', label: '上の文字（任意）', placeholder: 'お客様満足度', maxLength: 30 },
      { kind: 'text', key: 'note', label: '下の注釈（任意）', placeholder: '※2025年 自社調べ', maxLength: 60 },
      { kind: 'color', key: 'color', label: '星の色', presets: STAR_PRESETS },
    ],
    newItem: () => ({ type: 'rating', score: 4.8, label: 'お客様満足度', note: '', color: '#F2A516' }),
  },
  {
    type: 'badge',
    label: 'バッジ',
    icon: svg('<path d="M4 8.5h13l3.5 3.5-3.5 3.5H4z"/><circle cx="8" cy="12" r="1"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'text', label: 'バッジの文字', placeholder: '今だけ', maxLength: 20 },
      {
        kind: 'select',
        key: 'look',
        label: '形',
        options: [
          { value: 'pill', label: 'カプセル', icon: BADGE_LOOK_ICONS.pill },
          { value: 'ribbon', label: 'リボン', icon: BADGE_LOOK_ICONS.ribbon },
          { value: 'circle', label: '丸', icon: BADGE_LOOK_ICONS.circle },
          { value: 'tag', label: '札', icon: BADGE_LOOK_ICONS.tag },
        ],
        fallback: 'pill',
      },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'badge', text: '今だけ', look: 'pill', color: '#E5573F' }),
  },
  {
    type: 'gallery',
    label: '画像を並べる',
    icon: svg('<rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'image', key: 'image1', label: '1枚目' },
      { kind: 'image', key: 'image2', label: '2枚目' },
      { kind: 'image', key: 'image3', label: '3枚目（任意。入れると3列）' },
      { kind: 'number', key: 'gap', label: '画像の間', min: 0, max: 24, unit: 'px', fallback: 8 },
      { kind: 'toggle', key: 'round', label: '角を丸くする' },
    ],
    newItem: () => ({ type: 'gallery', image1: '', image2: '', image3: '', gap: 8, round: true }),
  },
  {
    type: 'point',
    label: 'ポイント',
    icon: svg('<path d="M4 6h5M4 10h16M4 14h16M4 18h10"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'kicker', label: '上の小さい文字', placeholder: 'POINT 01', maxLength: 20 },
      { kind: 'text', key: 'heading', label: '見出し', rich: true },
      { kind: 'textarea', key: 'text', label: '文章', rows: 3, rich: true },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'point', kicker: 'POINT 01', heading: '', text: '', color: '#E5573F' }),
  },
  {
    type: 'stat',
    label: '数字で見せる',
    icon: svg('<path d="M5 17V9l-2 1.5M9.5 9.5a2.2 2.2 0 1 1 3.6 1.7L9.5 17h4.5"/><path d="M17 17l3-8" opacity=".55"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'label', label: '上の文字', placeholder: 'リピート率', maxLength: 30 },
      { kind: 'text', key: 'value', label: '数字', placeholder: '98', maxLength: 12 },
      { kind: 'text', key: 'unit', label: '単位（任意）', placeholder: '%', maxLength: 8 },
      { kind: 'text', key: 'note', label: '下の注釈（任意）', placeholder: '※2025年 自社調べ', maxLength: 60 },
      { kind: 'color', key: 'color', label: '数字の色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'stat', label: 'リピート率', value: '98', unit: '%', note: '', color: '#E5573F' }),
  },
  {
    type: 'accordion',
    label: '開いて読む',
    icon: svg('<rect x="3" y="4" width="18" height="6" rx="1.5"/><path d="M16 6.5l1.5 1.5 1.5-1.5M5 14h14M5 18h10"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'title', label: '押す所の文字', placeholder: '詳しい条件を見る', maxLength: 60 },
      { kind: 'textarea', key: 'text', label: '開いたときの文章', rows: 4, rich: true },
      { kind: 'toggle', key: 'open', label: '最初から開いておく' },
      { kind: 'color', key: 'color', label: '色', presets: INK_PRESETS },
    ],
    newItem: () => ({ type: 'accordion', title: '詳しい条件を見る', text: '', open: false, color: '#1F2A37' }),
  },
  {
    type: 'cue',
    label: '下向きの矢印',
    icon: svg('<path d="M6 6l6 5 6-5M6 12l6 5 6-5"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'text', label: '上の文字（任意）', placeholder: '詳しくはこちら', maxLength: 30 },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
      { kind: 'toggle', key: 'move', label: 'ふわふわ動かす（動きを減らす設定の人には止まります）' },
    ],
    newItem: () => ({ type: 'cue', text: '', color: '#E5573F', move: true }),
  },
]

/** 増やした部品の、保存の前の確かめ（移行先は並びを見るので builder.ts）。問題が無ければ null */
export function moreBlockProblem(item: ItemData, where: string): string | null {
  const empty = (key: string): boolean => str(item, key).trim() === ''
  switch (str(item, 'type')) {
    case 'speech':
      return isRichEmpty(str(item, 'text')) ? `吹き出しのセリフが空です（${where}）。セリフを書くか、その部品を消してください` : null
    case 'price':
      return empty('price') ? `特別価格が空です（${where}）。価格を書くか、その部品を消してください` : null
    case 'box':
      return isRichEmpty(str(item, 'text')) && isRichEmpty(str(item, 'title'))
        ? `囲み枠の文字が空です（${where}）。文字を書くか、その部品を消してください`
        : null
    case 'note':
      return empty('text') ? `注意書きが空です（${where}）。文字を書くか、その部品を消してください` : null
    case 'table':
      return tableRows(str(item, 'text')).length === 0 ? `表の中身が空です（${where}）。1行に1つ書くか、その部品を消してください` : null
    case 'badge':
      return empty('text') ? `バッジの文字が空です（${where}）。文字を書くか、その部品を消してください` : null
    case 'gallery':
      return safeImage(str(item, 'image1')) === '' || safeImage(str(item, 'image2')) === ''
        ? `画像が選ばれていません（${where}。1枚目と2枚目は必ず選びます）`
        : null
    case 'point':
      return isRichEmpty(str(item, 'heading')) && isRichEmpty(str(item, 'text'))
        ? `ポイントの文字が空です（${where}）。見出しか文章を書くか、その部品を消してください`
        : null
    case 'stat':
      return empty('value') ? `数字が空です（${where}）。数字を書くか、その部品を消してください` : null
    case 'accordion':
      return empty('title') || isRichEmpty(str(item, 'text'))
        ? `開いて読むの文字が空です（${where}）。押す所の文字と開いたときの文章を書くか、その部品を消してください`
        : null
    default:
      return null
  }
}
