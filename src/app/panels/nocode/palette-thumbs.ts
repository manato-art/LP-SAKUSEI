/**
 * 「部品を足す → もっと見る」のサムネ（2026-09-24・本人「もっと見るを押したら、同じ左のツールバーのままでサムネ付きで全部表示」）。
 *
 * 絵を別に描かず、その部品を見本の中身で本当に書き出して縮めて見せる（部品の見た目を変えても、サムネが古くならない）。
 * 画面（Widget編集・アプリのCSS）とまざらないよう、shadow root の中に置く。スクリプトは動かさない（innerHTML）。
 * 画像・動画はまだ無いので灰色の箱で見せる。一度作ったサムネは使い回す（開くたびに作り直さない）。
 */
import { BUILDER_TEMPLATE } from './templates/builder.ts'
import { newUid } from './templates/kit.ts'
import type { BlockType, ItemData } from './templates/types.ts'

/** 縮める前の幅（スマホのLPに近い幅で書き出して、枠に合わせて縮める） */
const RENDER_WIDTH = 360

const BUTTON: ItemData = { type: 'button', label: '今すぐ申し込む', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', track: true }

const textLine = (text: string): ItemData => ({ type: 'text', text, size: 15, align: 'center' })

/** サムネに使う中身（無い部品は、足したときの中身） */
const THUMB_BLOCKS: Readonly<Record<string, () => readonly ItemData[]>> = {
  heading: () => [{ type: 'heading', text: '見出しの文字', size: 28, align: 'center', color: '#1F2A37' }],
  text: () => [{ type: 'text', text: 'ここに文章が入ります。読みやすい長さで、伝えたいことを書きます。', size: 16, align: 'left' }],
  button: () => [BUTTON],
  image: () => [{ type: 'image', image: '', alt: '', width: 100 }],
  hotspot: () => [BUTTON, { type: 'hotspot', x: 0, y: 0, w: 100, h: 100, action: 'screen', target: 's2', url: '', track: true }],
  imageText: () => [{ type: 'imageText', image: '', heading: '見出し', text: '説明の文章が入ります。', side: 'left' }],
  list: () => [{ type: 'list', text: '送料無料\n30日間返品OK\nいつでも相談', marker: 'check' }],
  shape: () => [{ type: 'shape', shape: 'round', size: 100, color: '#1F7AE0', text: '図形' }],
  video: () => [{ type: 'video', video: '', autoplay: false, width: 100 }],
  spacer: () => [{ type: 'spacer', size: 64 }],
  divider: () => [textLine('上の文章'), { type: 'divider', style: 'solid' }, textLine('下の文章')],
  speech: () => [{ type: 'speech', avatar: '', name: '30代・会社員', text: 'はじめてでも迷わず使えました！', side: 'left', color: '#F1F3F5' }],
  box: () => [{ type: 'box', title: 'ご注意', text: 'お届けまで3〜5日ほどかかります。', look: 'label', color: '#1F7AE0' }],
  note: () => [{ type: 'note', text: '個人の感想です\n効果には個人差があります', mark: true }],
  point: () => [{ type: 'point', kicker: 'POINT 01', heading: '届いたその日から使える', text: '面倒な準備はいりません。', color: '#E5573F' }],
  accordion: () => [{ type: 'accordion', title: '詳しい条件を見る', text: '初回のみ・お一人様1回まで', open: true, color: '#1F2A37' }],
  gallery: () => [{ type: 'gallery', image1: '', image2: '', image3: '', gap: 8, round: true }],
  cue: () => [{ type: 'cue', text: '詳しくはこちら', color: '#E5573F', move: false }],
}

/** サムネだけの見え方（まだ無い画像・動画は灰色の箱。余白は点線の枠。移行先は斜線） */
const THUMB_CSS =
  ':host{all:initial;display:block}' +
  '.frame{width:360px;pointer-events:none;user-select:none}' +
  '.nc-b-image:empty,.nc-b-video:empty,.nc-b-imageText__img:empty,.nc-b-gallery__cell:empty{min-height:120px;background:#E6EAF0;border-radius:10px}' +
  '.nc-b-video:empty{position:relative}' +
  '.nc-b-video:empty::before{content:"";position:absolute;left:50%;top:50%;transform:translate(-40%,-50%);border-style:solid;' +
  'border-width:16px 0 16px 26px;border-color:transparent transparent transparent #9AA3AE}' +
  '.nc-b-spacer{outline:3px dashed #C9CFD6;outline-offset:-3px;border-radius:8px}' +
  '.nc-b-hotspot{background:repeating-linear-gradient(135deg,rgba(0,145,255,.28) 0 8px,rgba(0,145,255,.1) 8px 16px) !important;' +
  'outline:3px dashed #0091FF;outline-offset:-3px;border-radius:12px}' +
  '.nc-b-hotspot::after{content:attr(aria-label);position:absolute;left:8px;top:8px;padding:4px 10px;border-radius:6px;' +
  'background:#0091FF;color:#FFFFFF;font:700 20px/1.3 sans-serif;white-space:nowrap}'

const cache = new Map<string, HTMLElement>()

/** 部品のサムネ（width は枠の幅 px。一度作ったものは使い回す） */
export function thumbnailFor(type: BlockType, width: number): HTMLElement {
  const cached = cache.get(type.type)
  if (cached !== undefined) return cached
  const host = document.createElement('div')
  host.className = 'ncf-cat__thumb'
  host.setAttribute('aria-hidden', 'true')
  const blocks = THUMB_BLOCKS[type.type]?.() ?? [type.newItem()]
  const data = {
    ...BUILDER_TEMPLATE.defaults(new Date()),
    background: '#FFFFFF',
    padding: 18,
    // 移行先のサムネは「画面②へ」と出したいので、移る先の画面も用意しておく（見えるのは画面①だけ）
    screens: [
      { id: 's1', name: '画面①', blocks },
      { id: 's2', name: '画面②', blocks: [{ type: 'spacer', size: 8 }] },
    ],
  }
  const html = BUILDER_TEMPLATE.render(data, newUid())
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${THUMB_CSS}</style><div class="frame" style="zoom:${(width / RENDER_WIDTH).toFixed(4)}">${html}</div>`
  cache.set(type.type, host)
  return host
}
