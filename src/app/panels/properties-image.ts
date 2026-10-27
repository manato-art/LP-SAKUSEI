/**
 * 画像を選んだときの右プロパティパネル（properties-panel.ts から分離・指示101）。
 *
 * 幅・配置・リンク・計測タグの付け外しなど、画像1枚ぶんの設定を受け持つ。
 */
import type Quill from 'quill'
import { group, row } from './properties-parts.ts'
import { buildMediaAnimGroup, buildMediaLinkGroup, buildMediaTrackingGroup, type MediaSection } from './properties-media-extras.ts'
import { applyImageAlign, imageAlignOf, lineAlignOf } from './media-align.ts'
import { notifyEditorChanged } from './editor-change.ts'
import { buildMediaAlignGroup, syncMediaAlign } from './properties-media-align.ts'
import { swapBodyImageForVideo } from './body-media-swap.ts'
import { readFileAsDataUrl } from './webp-convert.ts'
import { toast } from '../ui.ts'

const IMG_SVG = {
  replace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
}
/** 画像の設定の欄ごとの、共通の欄（リンク設定・計測URL・アニメーション） */
const EXTRA_SECTIONS = new WeakMap<HTMLElement, readonly MediaSection[]>()

export function buildImageBody(
  quill: Quill,
  getImg: () => HTMLImageElement | null,
  setImg: (img: HTMLImageElement | null) => void,
  /** 動画に差し替えたあと、右の欄を動画の設定にする */
  showVideo: (video: HTMLVideoElement) => void,
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'sb-props-body'
  container.style.display = 'none'
  container.setAttribute('data-image-body', 'true')

  // ── サムネイルプレビュー ──
  const previewGroup = group('プレビュー')
  const previewBox = document.createElement('div')
  previewBox.style.cssText =
    'width:100%;max-height:140px;border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:4px;overflow:hidden;background:var(--sb-c-f5f6f8, #F5F6F8);display:flex;align-items:center;justify-content:center'
  const previewImg = document.createElement('img')
  previewImg.style.cssText = 'max-width:100%;max-height:136px;object-fit:contain'
  previewBox.append(previewImg)
  previewGroup.append(previewBox)

  // ── 画像ソース ──
  const srcRow = row('ソース')
  const srcField = document.createElement('div')
  srcField.className = 'sb-url-field'
  srcField.style.cssText = 'flex:1;font-size:10px;color:#999999;cursor:default;height:26px;line-height:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:4px;padding:0 6px;background:var(--sb-c-f5f6f8, #F5F6F8)'
  srcRow.append(srcField)

  // ── alt テキスト ──
  const altRow = row('alt')
  const altInput = document.createElement('input')
  altInput.className = 'sb-pr-input'
  altInput.placeholder = '代替テキスト'
  altInput.addEventListener('change', () => {
    const img = getImg()
    if (img !== null) img.alt = altInput.value
  })
  altRow.append(altInput)

  // ── 幅 × 高さ ──
  const sizeGroup = group('サイズ')
  const sizeGrid = document.createElement('div')
  sizeGrid.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto auto 1fr auto;gap:3px;align-items:center'

  const wLabel = document.createElement('span')
  wLabel.className = 'sb-pr-size-label'
  wLabel.textContent = 'W'
  const wInput = document.createElement('input')
  wInput.className = 'sb-pr-size-input'
  wInput.type = 'number'
  wInput.min = '1'
  const wUnit = document.createElement('span')
  wUnit.className = 'sb-pr-size-unit'
  wUnit.textContent = 'px'

  const hLabel = document.createElement('span')
  hLabel.className = 'sb-pr-size-label'
  hLabel.textContent = 'H'
  const hInput = document.createElement('input')
  hInput.className = 'sb-pr-size-input'
  hInput.type = 'number'
  hInput.min = '1'
  const hUnit = document.createElement('span')
  hUnit.className = 'sb-pr-size-unit'
  hUnit.textContent = 'px'

  wInput.addEventListener('change', () => {
    const img = getImg()
    if (img === null) return
    const w = parseInt(wInput.value, 10)
    if (Number.isNaN(w) || w < 1) return
    img.style.width = `${w}px`
  })
  hInput.addEventListener('change', () => {
    const img = getImg()
    if (img === null) return
    const h = parseInt(hInput.value, 10)
    if (Number.isNaN(h) || h < 1) return
    img.style.height = `${h}px`
  })

  sizeGrid.append(wLabel, wInput, wUnit, hLabel, hInput, hUnit)
  sizeGroup.append(sizeGrid)

  // ── 配置（左・中央・右。画像のある行を寄せる・2026-10-18 本人「動画や画像の位置も左右で選びたい」） ──
  const alignGroup = buildMediaAlignGroup((align) => {
    const img = getImg()
    if (img === null) return
    const blot = quill.scroll.find(img)
    if (blot === null) return
    // 大きさを変えた画像は画像自身の余白で、変えていない画像は行の寄せで動く（両方そろえる）
    applyImageAlign(img, align)
    const index = quill.getIndex(blot)
    quill.formatLine(index, 1, 'align', lineAlignOf(align), 'user')
    // 画像自身の余白だけが変わったとき（行の寄せは同じ）は Quill が気づかないので、保存の合図を出す
    notifyEditorChanged(quill.root)
    syncMediaAlign(alignGroup, imageAlignOf(img))
  })
  alignGroup.setAttribute('data-image-align', 'true')

  // ── リンク設定・計測URL（動画と共通・properties-media-extras.ts） ──
  const extrasDeps = {
    current: (): HTMLElement | null => getImg(),
    apply: (change: (el: HTMLElement) => void): void => {
      const img = getImg()
      if (img !== null) change(img)
    },
  }
  const linkSection = buildMediaLinkGroup(extrasDeps)
  const trackSection = buildMediaTrackingGroup(extrasDeps)

  // ── アクション ──
  const actGroup = group('アクション')
  actGroup.style.gap = '6px'
  actGroup.style.marginTop = '2px'

  const replaceBtn = document.createElement('button')
  replaceBtn.type = 'button'
  replaceBtn.className = 'sb-pr-action'
  replaceBtn.innerHTML = `${IMG_SVG.replace}画像・動画に差し替え`
  replaceBtn.title = '画像でも動画でも選べます。動画を選ぶと、この場所が動画になります（自動で再生・音なし・くり返し。位置と幅はそのまま）'
  replaceBtn.addEventListener('click', () => {
    const img = getImg()
    if (img === null) return
    const input = document.createElement('input')
    input.type = 'file'
    // 画像でも動画でも（2026-10-27 本人「画像を入れられる所は動画も入ればいい」）
    input.accept = 'image/*,video/*'
    input.style.display = 'none'
    document.body.append(input)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (file === undefined) return
      if (file.type.startsWith('video/')) {
        void readFileAsDataUrl(file).then((src) => {
          if (src === '') {
            toast('動画を読み込めませんでした', 'error')
            return
          }
          const video = swapBodyImageForVideo(quill, img, src)
          if (video === null) {
            toast('動画に差し替えられませんでした', 'error')
            return
          }
          setImg(null)
          showVideo(video)
          // リンク・計測URL・アニメーションも動画に引き継ぐ（2026-10-27 指示㉑）
          toast('動画に差し替えました')
        })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          img.src = reader.result
          previewImg.src = reader.result
        }
      }
      reader.readAsDataURL(file)
    })
    input.click()
  })

  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = 'sb-pr-action danger'
  removeBtn.innerHTML = `${IMG_SVG.remove}画像を削除`
  removeBtn.addEventListener('click', () => {
    const img = getImg()
    if (img === null) return
    // Quill の Blot として削除（DOM直接削除だと Quill のデルタと不整合になる）
    const blot = quill.scroll.find(img)
    if (blot !== null) {
      const index = quill.getIndex(blot)
      quill.deleteText(index, 1, 'user')
    } else {
      img.remove()
    }
    setImg(null)
    container.style.display = 'none'
  })

  actGroup.append(replaceBtn, removeBtn)

  // ── アニメーション（動画と共通・CapCut風の入場エフェクト） ──
  const animSection = buildMediaAnimGroup(extrasDeps)

  container.append(previewGroup, srcRow, altRow, sizeGroup, alignGroup, animSection.el, linkSection.el, trackSection.el, actGroup)

  // 共通の欄の表示合わせ（refreshImageBody で使う）
  EXTRA_SECTIONS.set(container, [linkSection, trackSection, animSection])
  container.dataset['ready'] = 'true'

  return container
}
/** 画像プロパティを最新の画像状態で更新 */
export function refreshImageBody(container: HTMLElement, img: HTMLImageElement): void {
  const previewImg = container.querySelector<HTMLImageElement>('.sb-pg img')
  if (previewImg !== null) previewImg.src = img.src

  const srcField = container.querySelector<HTMLElement>('.sb-url-field')
  if (srcField !== null) {
    const src = img.src
    srcField.textContent = src.startsWith('data:') ? `(データURL・${Math.round(src.length / 1024)}KB)` : src
    srcField.title = src.startsWith('data:') ? 'Base64エンコード画像' : src
  }

  const altInput = container.querySelector<HTMLInputElement>('input[placeholder="代替テキスト"]')
  if (altInput !== null) altInput.value = img.alt

  // 配置（画像のある行の寄せ。Widget の中の画像は寄せられないので欄を隠す）
  const alignEl = container.querySelector<HTMLElement>('[data-image-align]')
  if (alignEl !== null) syncMediaAlign(alignEl, imageAlignOf(img))

  const sizeInputs = container.querySelectorAll<HTMLInputElement>('.sb-pr-size-input')
  if (sizeInputs[0] !== undefined) sizeInputs[0].value = String(img.naturalWidth || img.width)
  if (sizeInputs[1] !== undefined) sizeInputs[1].value = String(img.naturalHeight || img.height)

  // リンク設定・計測URL・アニメーション（共通の欄）
  for (const section of EXTRA_SECTIONS.get(container) ?? []) section.sync(img)
}
