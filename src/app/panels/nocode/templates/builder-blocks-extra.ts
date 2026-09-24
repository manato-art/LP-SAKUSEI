/**
 * 部品をもっと増やした（2026-09-24・本人「部品をもっと増やして」）。
 *
 * 帯見出し・マーカー文章・特徴（アイコン＋文字）・口コミ（1件）・プロフィール・画像に文字・ビフォーアフター・
 * 電話ボタン・クーポン券・数字を並べる・ランキング・飾りの区切り。
 * 入力欄と足したときの中身と、保存の前の確かめはここ。書き出しは builder-blocks-extra-render.ts。
 * 決まりは builder-blocks-more.ts と同じ（いちばん上に幅と置く位置・入力の文字はタグにしない・選ぶ入力には絵）。
 */
import { isRichEmpty } from '../rich-text.ts'
import { ALIGN_OPTIONS, NO_ACTION, actionOf, layoutFields, telDigits } from './block-kit.ts'
import { safeImage } from './kit.ts'
import { BAND_LOOK_ICONS, LOADING_ICONS, ORNAMENT_ICONS } from './option-icons.ts'
import { ACCENT_PRESETS, str, type BlockType, type ItemData } from './types.ts'

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** 特徴のアイコン（24×24 の線。LPにもそのまま書き出す） */
export const FEATURE_ICONS: Readonly<Record<string, { readonly label: string; readonly body: string }>> = {
  check: { label: 'チェック', body: '<path d="M5 12.5l4.2 4.2L19 7"/>' },
  truck: { label: 'お届け', body: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>' },
  clock: { label: '時間', body: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>' },
  shield: { label: '安心', body: '<path d="M12 3l7 3v5.5c0 4.3-3 7.7-7 9.5-4-1.8-7-5.2-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>' },
  gift: { label: '特典', body: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S9.5 9 12 9c2.5 0 6 1 6-1.5S14 5 12 9z"/>' },
  yen: { label: 'お金', body: '<path d="M7 4l5 7 5-7M12 11v9M8 13h8M8 16.5h8"/>' },
  phone: { label: '電話', body: '<path d="M5 4h4l1.5 4.5-2.3 1.4a11 11 0 0 0 5.9 5.9l1.4-2.3L20 15v4a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>' },
  heart: { label: 'ハート', body: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>' },
  leaf: { label: '自然', body: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/>' },
  star: { label: '星', body: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>' },
}
export const FEATURE_ICON_KEYS = Object.keys(FEATURE_ICONS)

/** 選ぶ入力の絵（32×24。ほかの選ぶ入力とそろえる） */
const optionIcon = (body: string): string =>
  `<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round"><g transform="translate(4 0)">${body}</g></svg>`

/** マーカーの色（文字の下に引く淡い色） */
const MARKER_PRESETS: readonly string[] = ['#FFE45C', '#FFB3C7', '#A8DBFF', '#B8F0C2']

/** 「上の文字|数字|単位」「名前|説明」のように「|」で区切った行（全角の「｜」も） */
export function splitRows(text: string, max: number): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, max)
    .map((line) => line.split(/[|｜]/).map((cell) => cell.trim()))
}

// 電話番号の数字だけ（tel:）は、押したときの「電話をかける」と同じものを使う
export { telDigits } from './block-kit.ts'

export const EXTRA_BLOCK_TYPES: readonly BlockType[] = [
  {
    // 2026-09-24・本人「部品にロード中という内容を追加して」（動き＝本人の選択「数秒後に次の画面へ」）
    type: 'loading',
    label: 'ロード中',
    icon: svg('<path d="M12 3a9 9 0 1 1-9 9" /><path d="M12 7v5l3 2"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      {
        kind: 'select',
        key: 'look',
        label: '見た目',
        options: [
          { value: 'spinner', label: 'くるくる', icon: LOADING_ICONS.spinner },
          { value: 'bar', label: 'バー', icon: LOADING_ICONS.bar },
          { value: 'dots', label: '点々', icon: LOADING_ICONS.dots },
        ],
        fallback: 'spinner',
      },
      { kind: 'text', key: 'text', label: '下の文字', placeholder: 'あなたに合う内容を診断しています…', maxLength: 60 },
      { kind: 'number', key: 'seconds', label: '待つ時間', min: 1, max: 10, unit: '秒', step: 0.5, fallback: 3 },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
      // 終わったら: 画面②③…（＋新しい画面）かリンク。LP上のアクションは出さない（template-form.ts の pressFieldEl）
      { kind: 'goto', key: 'action', label: '終わったら', section: 'press' },
      { kind: 'url', key: 'url', label: '開くページ', placeholder: 'https://', showIfItem: (item) => str(item, 'action') === 'link', section: 'press' },
      { kind: 'toggle', key: 'track', label: 'クリック数をレポートで数える', showIfItem: (item) => str(item, 'action') === 'link', section: 'press' },
    ],
    newItem: () => ({ type: 'loading', look: 'spinner', text: 'あなたに合う内容を診断しています…', seconds: 3, color: '#E5573F', ...NO_ACTION }),
  },
  {
    type: 'band',
    label: '帯見出し',
    icon: svg('<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M8 12h8"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'text', label: '帯の文字', placeholder: '今だけの特典', rich: true },
      {
        kind: 'select',
        key: 'look',
        label: '見た目',
        options: [
          { value: 'fill', label: '塗りの帯', short: '塗り', icon: BAND_LOOK_ICONS.fill },
          { value: 'ribbon', label: 'リボン', icon: BAND_LOOK_ICONS.ribbon },
          { value: 'line', label: '下線', icon: BAND_LOOK_ICONS.line },
        ],
        fallback: 'fill',
      },
      { kind: 'number', key: 'size', label: '文字の大きさ', min: 13, max: 30, unit: 'px', fallback: 18 },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'band', text: '', look: 'fill', size: 18, color: '#E5573F' }),
  },
  {
    type: 'marker',
    label: 'マーカー文章',
    icon: svg('<path d="M4 16h16" stroke-width="5" opacity=".35"/><path d="M5 12h14"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'textarea', key: 'text', label: '文章（下にマーカーを引きます）', rows: 3, rich: true },
      { kind: 'color', key: 'color', label: 'マーカーの色', presets: MARKER_PRESETS },
      { kind: 'number', key: 'size', label: '文字の大きさ', min: 13, max: 26, unit: 'px', fallback: 17 },
      { kind: 'toggle', key: 'bold', label: '太字にする' },
      { kind: 'select', key: 'align', label: '文字の寄せ', options: ALIGN_OPTIONS, fallback: 'center' },
    ],
    newItem: () => ({ type: 'marker', text: '', color: '#FFE45C', size: 17, bold: true, align: 'center' }),
  },
  {
    type: 'iconText',
    label: '特徴（アイコン）',
    icon: svg('<circle cx="7" cy="12" r="4"/><path d="M5.5 12l1 1 2-2M14 10h7M14 14h5"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      {
        kind: 'select',
        key: 'icon',
        label: 'アイコン',
        options: FEATURE_ICON_KEYS.map((key) => ({ value: key, label: FEATURE_ICONS[key]?.label ?? key, icon: optionIcon(FEATURE_ICONS[key]?.body ?? '') })),
        fallback: 'check',
      },
      { kind: 'text', key: 'title', label: '見出し', placeholder: '最短翌日にお届け', rich: true },
      { kind: 'textarea', key: 'text', label: '文章', rows: 2, rich: true },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'iconText', icon: 'check', title: '', text: '', color: '#1F7AE0' }),
  },
  {
    type: 'quote',
    label: '口コミ（1件）',
    icon: svg('<path d="M4 6h16v10H9l-4 3v-3H4z"/><path d="M8 10h8M8 13h5"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'number', key: 'stars', label: '星の数', min: 0, max: 5, unit: 'こ', fallback: 5 },
      { kind: 'textarea', key: 'text', label: '口コミの文', rows: 3, rich: true },
      { kind: 'text', key: 'name', label: '名前（任意）', placeholder: '30代・女性', maxLength: 30 },
      { kind: 'image', key: 'photo', label: '写真（任意）' },
    ],
    newItem: () => ({ type: 'quote', stars: 5, text: '', name: '', photo: '' }),
  },
  {
    type: 'profile',
    label: 'プロフィール',
    icon: svg('<circle cx="8" cy="10" r="3.5"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0M15 8h6M15 12h6M15 16h4"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'image', key: 'photo', label: '写真（任意）' },
      { kind: 'text', key: 'role', label: '肩書き（任意）', placeholder: '監修', maxLength: 30 },
      { kind: 'text', key: 'name', label: '名前', placeholder: '山田 花子', maxLength: 40 },
      { kind: 'textarea', key: 'text', label: '紹介の文', rows: 3, rich: true },
      { kind: 'color', key: 'color', label: '肩書きの色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'profile', photo: '', role: '監修', name: '', text: '', color: '#1F7AE0' }),
  },
  {
    type: 'cover',
    label: '画像に文字',
    icon: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 11h10M9 14h6"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'image', key: 'image', label: '背景の画像（任意。無ければ濃い色の地）' },
      { kind: 'text', key: 'heading', label: '見出し', rich: true },
      { kind: 'textarea', key: 'text', label: '文章（任意）', rows: 2, rich: true },
      { kind: 'select', key: 'align', label: '文字の寄せ', options: ALIGN_OPTIONS, fallback: 'center' },
      { kind: 'number', key: 'shade', label: '画像を暗くする', min: 0, max: 80, unit: '%', fallback: 35 },
      { kind: 'number', key: 'height', label: '高さ', min: 120, max: 520, unit: 'px', fallback: 240 },
    ],
    newItem: () => ({ type: 'cover', image: '', heading: '', text: '', align: 'center', shade: 35, height: 240 }),
  },
  {
    type: 'beforeAfter',
    label: 'ビフォーアフター',
    icon: svg('<rect x="3" y="6" width="7" height="12" rx="1.5"/><rect x="14" y="6" width="7" height="12" rx="1.5"/><path d="M11 12h2"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'image', key: 'before', label: '前の画像' },
      { kind: 'image', key: 'after', label: '後の画像' },
      { kind: 'text', key: 'beforeLabel', label: '前の名前', placeholder: 'Before', maxLength: 16 },
      { kind: 'text', key: 'afterLabel', label: '後の名前', placeholder: 'After', maxLength: 16 },
      { kind: 'color', key: 'color', label: '後の名前の色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'beforeAfter', before: '', after: '', beforeLabel: 'Before', afterLabel: 'After', color: '#E5573F' }),
  },
  {
    type: 'tel',
    label: '電話ボタン',
    icon: svg(FEATURE_ICONS['phone']?.body ?? ''),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'number', label: '電話番号', placeholder: '0120-000-000', maxLength: 20 },
      { kind: 'text', key: 'label', label: '上の文字（任意）', placeholder: 'お電話でのお問い合わせ', maxLength: 30 },
      { kind: 'text', key: 'hours', label: '受付時間（任意）', placeholder: '受付 9:00〜18:00（土日祝を除く）', maxLength: 60 },
      { kind: 'color', key: 'color', label: 'ボタンの色', presets: ACCENT_PRESETS },
      { kind: 'toggle', key: 'track', label: '押された数をレポートで数える' },
    ],
    newItem: () => ({ type: 'tel', number: '', label: 'お電話でのお問い合わせ', hours: '', color: '#0B7A3E', track: true }),
  },
  {
    type: 'coupon',
    label: 'クーポン券',
    icon: svg('<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="1.5 2"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'text', key: 'title', label: '上の文字（任意）', placeholder: '初回限定クーポン', maxLength: 30 },
      { kind: 'text', key: 'amount', label: '割引', placeholder: '500円OFF', maxLength: 20 },
      { kind: 'text', key: 'code', label: 'クーポンコード（任意）', placeholder: 'WELCOME500', maxLength: 30 },
      { kind: 'text', key: 'note', label: '下の注釈（任意）', placeholder: '有効期限: 10月31日まで', maxLength: 60 },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'coupon', title: '初回限定クーポン', amount: '500円OFF', code: '', note: '', color: '#E5573F' }),
  },
  {
    type: 'numbers',
    label: '数字を並べる',
    icon: svg('<path d="M4 16V8l-1.5 1M9 9.5a2 2 0 1 1 3.3 1.5L9 16h4M16 8h4l-2.5 3.5a2.3 2.3 0 1 1-2 3.5"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'textarea', key: 'text', label: '1行に1つ（上の文字|数字|単位）。4つまで横に並びます', rows: 4 },
      { kind: 'color', key: 'color', label: '数字の色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'numbers', text: '累計販売数|10|万個\n満足度|98|%\nリピート率|85|%', color: '#E5573F' }),
  },
  {
    type: 'ranking',
    label: 'ランキング',
    icon: svg('<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      { kind: 'textarea', key: 'text', label: '1行に1つ（名前|説明）。上から1位・2位…（10位まで）', rows: 4 },
    ],
    newItem: () => ({ type: 'ranking', text: '定期便コース|いちばん人気・毎月お届け\nお試しセット|はじめての方に\n単品|必要なときに1つから' }),
  },
  {
    type: 'ornament',
    label: '飾りの区切り',
    icon: svg('<path d="M3 12q2.25-4 4.5 0t4.5 0 4.5 0 4.5 0"/>'),
    fields: [
      ...layoutFields('boxWidth'),
      {
        kind: 'select',
        key: 'look',
        label: '形',
        options: [
          { value: 'wave', label: '波', icon: ORNAMENT_ICONS.wave },
          { value: 'zigzag', label: 'ギザギザ', icon: ORNAMENT_ICONS.zigzag },
          { value: 'dots', label: '点々', icon: ORNAMENT_ICONS.dots },
          { value: 'slant', label: '斜め', icon: ORNAMENT_ICONS.slant },
        ],
        fallback: 'wave',
      },
      { kind: 'number', key: 'height', label: '高さ', min: 6, max: 64, unit: 'px', fallback: 14 },
      { kind: 'color', key: 'color', label: '色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'ornament', look: 'wave', height: 14, color: '#E5573F' }),
  },
]

/** もっと増やした部品の、保存の前の確かめ。問題が無ければ null */
export function extraBlockProblem(item: ItemData, where: string): string | null {
  const empty = (key: string): boolean => str(item, key).trim() === ''
  switch (str(item, 'type')) {
    case 'loading': {
      const action = actionOf(item)
      if (action === 'link') return str(item, 'url').trim() === '' ? `ロード中の開くページが空です（${where}）。URLを入れてください` : null
      return action === 'screen' ? null : `ロード中の「終わったら」移る先が選ばれていません（${where}）。画面かリンクを選んでください`
    }
    case 'band':
      return isRichEmpty(str(item, 'text')) ? `帯見出しの文字が空です（${where}）。文字を書くか、その部品を消してください` : null
    case 'marker':
      return isRichEmpty(str(item, 'text')) ? `マーカー文章が空です（${where}）。文字を書くか、その部品を消してください` : null
    case 'iconText':
      return isRichEmpty(str(item, 'title')) && isRichEmpty(str(item, 'text'))
        ? `特徴の文字が空です（${where}）。見出しか文章を書くか、その部品を消してください`
        : null
    case 'quote':
      return isRichEmpty(str(item, 'text')) ? `口コミの文が空です（${where}）。文を書くか、その部品を消してください` : null
    case 'profile':
      return empty('name') ? `プロフィールの名前が空です（${where}）。名前を書くか、その部品を消してください` : null
    case 'cover':
      return isRichEmpty(str(item, 'heading')) && isRichEmpty(str(item, 'text'))
        ? `画像に重ねる文字が空です（${where}）。見出しか文章を書くか、その部品を消してください`
        : null
    case 'beforeAfter':
      return safeImage(str(item, 'before')) === '' || safeImage(str(item, 'after')) === ''
        ? `画像が選ばれていません（${where}。前と後の画像を選びます）`
        : null
    case 'tel':
      return telDigits(str(item, 'number')).replace('+', '').length < 3
        ? `電話番号が空か、数字がありません（${where}）。番号を書くか、その部品を消してください`
        : null
    case 'coupon':
      return empty('amount') ? `クーポン券の割引が空です（${where}）。「500円OFF」などを書くか、その部品を消してください` : null
    case 'numbers':
      return splitRows(str(item, 'text'), 4).every((row) => (row[1] ?? '') === '')
        ? `数字を並べるの中身が空です（${where}）。「上の文字|数字|単位」を1行に1つ書くか、その部品を消してください`
        : null
    case 'ranking':
      return splitRows(str(item, 'text'), 10).length === 0
        ? `ランキングの中身が空です（${where}）。「名前|説明」を1行に1つ書くか、その部品を消してください`
        : null
    default:
      return null
  }
}
