/**
 * 右プロパティパネル（エディタ右端 260px）。
 *
 * キャンバスで選択中のテキスト要素のプロパティを表示・編集する。
 * 旧コンテンツツールバーにあった全機能をここに集約する。
 *
 * タブ: コンテンツ / スタイル
 * セクション:
 *   テキスト / フォント / サイズ / 太字 / 斜体 / 文字色 / 背景色
 *   文字間隔 / 行間 / 配置 / 位置・サイズ / 書式 / 挿入 / アクション
 */
import type Quill from 'quill'
import { buildVideoBody } from './properties-video.ts'
import {
  cssFontFamilyValue,
  fontSizeLabel,
  allowPxSizeAndFreeFont,
} from './toolbar/text-format.ts'
import { makeFontDropdown } from './toolbar/font-dropdown.ts'
import { pickAndInsertMedia } from './media-insert.ts'
import { ANIM_PRESETS, ANIM_SPEEDS } from '../anim/anim-presets.ts'
import { colorPicker, fmtBtn, group, row } from './properties-parts.ts'
import { buildImageBody, refreshImageBody } from './properties-image.ts'
import {
  ALIGN_LABELS,
  SVG,
  injectAnimCssOnce,
  injectStyles,
  normalizeColor,
} from './properties-panel-styles.ts'


/* ── CSS ── */


/* ── SVG icons ── */



/* ── Public ── */


export function mountPropertiesPanel(quill: Quill): HTMLElement {
  injectStyles()
  injectAnimCssOnce()
  allowPxSizeAndFreeFont(quill)

  const panel = document.createElement('div')
  panel.className = 'sb-props-panel'
  panel.setAttribute('data-props-panel', 'true')

  // ── ヘッダー ──
  const header = document.createElement('div')
  header.className = 'sb-props-header'
  const title = document.createElement('h3')
  title.innerHTML = 'プロパティ'
  // 指示153: ヘッダーのバツ印（閉じる）は表示しない。
  header.append(title)

  // ── タブ（スタイル統一） ──
  const tabs = document.createElement('div')
  tabs.className = 'sb-props-tabs'
  const styleTab = document.createElement('button')
  styleTab.type = 'button'
  styleTab.className = 'sb-props-tab active'
  styleTab.textContent = 'スタイル'
  tabs.append(styleTab)

  // ── ボディ（コンテンツタブ） ──
  const body = document.createElement('div')
  body.className = 'sb-props-body'

  // 未選択時の表示
  const emptyMsg = document.createElement('div')
  emptyMsg.className = 'sb-props-empty'
  emptyMsg.textContent = 'テキスト・画像・動画を選択すると\nここにプロパティが表示されます'
  emptyMsg.style.whiteSpace = 'pre-line'

  // ── 画像プロパティ（指示101: 画像クリックで右パネルに詳細表示） ──
  let selectedImage: HTMLImageElement | null = null
  const imageBody = buildImageBody(quill, () => selectedImage, (img) => { selectedImage = img })

  // ── 動画プロパティ（動画クリックで再生設定・サイズ・複製をここで操作する） ──
  let selectedVideo: HTMLVideoElement | null = null
  const videoBody = buildVideoBody({
    quill,
    getVideo: () => selectedVideo,
    setVideo: (v) => {
      selectedVideo = v
    },
  })

  // ── helpers ──
  // 指示94: Quill の getSelection() がフォーカス喪失で null を返すケースに対応。
  // selection-change イベントから受け取った有効レンジを保持しフォールバックにする。
  let lastKnownRange: { index: number; length: number } | null = null
  const getRange = (): { index: number; length: number } | null => {
    const r = quill.getSelection()
    if (r !== null) return r
    return lastKnownRange
  }
  const getFormats = () => {
    const r = getRange()
    return r !== null ? quill.getFormat(r.index, r.length) : {}
  }
  const applyInline = (name: string, value: unknown): void => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.formatText(r.index, r.length, name, value, 'user')
    quill.setSelection(r.index, r.length, 'silent')
    refresh()
  }
  const applyBlock = (name: string, value: unknown): void => {
    const r = getRange()
    if (r === null) return
    quill.formatLine(r.index, r.length, name, value, 'user')
    quill.setSelection(r.index, r.length, 'silent')
    refresh()
  }
  const toggleInline = (name: string): void => {
    applyInline(name, getFormats()[name] === true ? false : true)
  }

  // ── テキスト ──
  const textGroup = group('テキスト')
  const textArea = document.createElement('textarea')
  textArea.className = 'sb-pr-textarea'
  // 指示107: 直接編集可能にする
  // ⚠️ isEditingText: deleteText→text-change→refresh が再帰して textarea.value を上書きするのを防ぐ
  let isEditingText = false
  textArea.addEventListener('input', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const currentFmt = getFormats()
    const newText = textArea.value
    // 指示140: 編集前の textarea のカーソル位置を控える（後で復元する）
    const caret = textArea.selectionStart ?? newText.length
    isEditingText = true
    try {
      quill.deleteText(r.index, r.length)
      quill.insertText(r.index, newText, currentFmt)
      // 指示140:
      //  1) 以前は quill.setSelection で挿入テキスト全体を「選択状態」にしていたが、これは
      //     エディタ本体（キャンバス）へフォーカスを奪い、テキスト全体が選択された状態になる。
      //     すると次のバックスペースが textarea ではなくキャンバスの「全選択」に効いて、
      //     テキストごと消える（＝2文字目のバックスペースで全消去になる不具合）。setSelection は外す。
      //  2) deleteText/insertText 自体もエディタ本体へフォーカスを戻すため、直後に textarea へ
      //     フォーカスとカーソル位置を戻し、1文字ずつ連続で消せるようにする。
      lastKnownRange = { index: r.index, length: newText.length }
    } finally {
      isEditingText = false
    }
    // Quill操作で奪われたフォーカス/カーソルを textarea へ戻す（正本は textarea 側）
    textArea.focus()
    const pos = Math.min(caret, textArea.value.length)
    textArea.setSelectionRange(pos, pos)
  })
  textGroup.append(textArea)

  // ── フォント（日本語名を各フォントで表示するカスタムドロップダウン） ──
  const fontRow = row('フォント')
  const fontDropdown = makeFontDropdown({
    triggerClassName: 'sb-pr-select',
    onSelect: (font) => applyInline('font', cssFontFamilyValue(font)),
  })
  fontRow.append(fontDropdown.el)

  // ── サイズ ──
  const sizeRow = row('サイズ')
  const sizeInput = document.createElement('input')
  sizeInput.className = 'sb-pr-input'
  sizeInput.type = 'number'
  sizeInput.min = '1'
  sizeInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums'
  sizeInput.addEventListener('change', () => {
    const v = parseInt(sizeInput.value, 10)
    if (Number.isNaN(v) || v < 1) return
    applyInline('size', `${v}px`)
  })
  const sizeStepWrap = document.createElement('div')
  sizeStepWrap.className = 'sb-pr-stepper-wrap'
  const sizeUp = document.createElement('button')
  sizeUp.type = 'button'
  sizeUp.className = 'sb-pr-stepper-btn'
  sizeUp.textContent = '▲'
  sizeUp.addEventListener('click', () => {
    const v = parseInt(sizeInput.value, 10)
    if (Number.isNaN(v)) return
    sizeInput.value = String(v + 1)
    sizeInput.dispatchEvent(new Event('change'))
  })
  const sizeDown = document.createElement('button')
  sizeDown.type = 'button'
  sizeDown.className = 'sb-pr-stepper-btn'
  sizeDown.textContent = '▼'
  sizeDown.addEventListener('click', () => {
    const v = parseInt(sizeInput.value, 10)
    if (Number.isNaN(v) || v <= 1) return
    sizeInput.value = String(v - 1)
    sizeInput.dispatchEvent(new Event('change'))
  })
  sizeStepWrap.append(sizeUp, sizeDown)
  const sizeUnit = document.createElement('span')
  sizeUnit.className = 'sb-pr-unit'
  sizeUnit.textContent = 'px'
  sizeRow.append(sizeInput, sizeStepWrap, sizeUnit)

  // 指示170: 太字/斜体はトグルスイッチをやめ、下の「書式」行に B / I ボタンとして統合する
  // （押すと色が変わる四角ボタン）。実際の生成は書式セクションで行う。

  // ── 文字色 ──
  const textColorRow = row('文字色')
  const { wrap: tcWrap, swatch: tcSwatch, picker: tcPicker, hex: tcHex } = colorPicker('#000000')
  tcPicker.addEventListener('input', () => {
    const c = tcPicker.value
    tcSwatch.style.background = c
    tcHex.value = c.toUpperCase()
    applyInline('color', c)
  })
  tcHex.addEventListener('change', () => {
    const c = tcHex.value.trim()
    if (/^#[0-9a-f]{6}$/i.test(c)) {
      tcSwatch.style.background = c
      tcPicker.value = c
      applyInline('color', c)
    }
  })
  textColorRow.append(tcWrap)

  // ── 背景色 ──
  const bgColorRow = row('背景色')
  const { wrap: bgWrap, swatch: bgSwatch, picker: bgPicker, hex: bgHex } = colorPicker('#FFFFFF')
  bgPicker.addEventListener('input', () => {
    const c = bgPicker.value
    bgSwatch.style.background = c
    bgHex.value = c.toUpperCase()
    applyInline('background', c)
  })
  bgHex.addEventListener('change', () => {
    const c = bgHex.value.trim()
    if (/^#[0-9a-f]{6}$/i.test(c)) {
      bgSwatch.style.background = c
      bgPicker.value = c
      applyInline('background', c)
    }
  })
  bgColorRow.append(bgWrap)

  // ── 文字間隔 ──
  const lsRow = row('文字間隔')
  const lsInput = document.createElement('input')
  lsInput.className = 'sb-pr-input'
  lsInput.type = 'number'
  lsInput.value = '0'
  lsInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums'
  // 文字間隔は Quill 標準にはないので、選択テキストの DOM を直接操作する
  lsInput.addEventListener('change', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const v = parseFloat(lsInput.value)
    if (Number.isNaN(v)) return
    // Quill の行ごとに letter-spacing を適用
    for (const line of quill.getLines(r.index, r.length)) {
      const node = line.domNode as HTMLElement
      node.style.letterSpacing = v === 0 ? '' : `${v}px`
    }
  })
  const lsUnit = document.createElement('span')
  lsUnit.className = 'sb-pr-unit'
  lsUnit.textContent = 'px'
  lsRow.append(lsInput, lsUnit)

  // ── 行間 ──
  const lhRow = row('行間')
  const lhInput = document.createElement('input')
  lhInput.className = 'sb-pr-input'
  lhInput.type = 'number'
  lhInput.value = '1.4'
  lhInput.step = '0.1'
  lhInput.min = '0.5'
  lhInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums'
  lhInput.addEventListener('change', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const v = parseFloat(lhInput.value)
    if (Number.isNaN(v) || v < 0.5) return
    for (const line of quill.getLines(r.index, r.length)) {
      const node = line.domNode as HTMLElement
      node.style.lineHeight = String(v)
    }
  })
  lhRow.append(lhInput)

  // ── 位置・サイズ ──
  const posGroup = group('位置・サイズ')
  const posGrid = document.createElement('div')
  posGrid.className = 'sb-pr-size-grid'

  const posXLabel = document.createElement('span')
  posXLabel.className = 'sb-pr-size-label'
  posXLabel.textContent = 'X'
  const posXInput = document.createElement('input')
  posXInput.className = 'sb-pr-size-input'
  posXInput.type = 'number'
  posXInput.value = '0'
  const posXUnit = document.createElement('span')
  posXUnit.className = 'sb-pr-size-unit'
  posXUnit.textContent = 'px'

  const posYLabel = document.createElement('span')
  posYLabel.className = 'sb-pr-size-label'
  posYLabel.textContent = 'Y'
  const posYInput = document.createElement('input')
  posYInput.className = 'sb-pr-size-input'
  posYInput.type = 'number'
  posYInput.value = '0'
  const posYUnit = document.createElement('span')
  posYUnit.className = 'sb-pr-size-unit'
  posYUnit.textContent = 'px'

  const posWLabel = document.createElement('span')
  posWLabel.className = 'sb-pr-size-label'
  posWLabel.textContent = 'W'
  const posWInput = document.createElement('input')
  posWInput.className = 'sb-pr-size-input'
  posWInput.type = 'number'
  posWInput.value = '0'
  const posWUnit = document.createElement('span')
  posWUnit.className = 'sb-pr-size-unit'
  posWUnit.textContent = 'px'

  const posHLabel = document.createElement('span')
  posHLabel.className = 'sb-pr-size-label'
  posHLabel.textContent = 'H'
  const posHInput = document.createElement('input')
  posHInput.className = 'sb-pr-size-input'
  posHInput.type = 'number'
  posHInput.value = '0'
  const posHUnit = document.createElement('span')
  posHUnit.className = 'sb-pr-size-unit'
  posHUnit.textContent = 'px'

  posGrid.append(
    posXLabel, posXInput, posXUnit,
    posYLabel, posYInput, posYUnit,
    posWLabel, posWInput, posWUnit,
    posHLabel, posHInput, posHUnit,
  )
  posGroup.append(posGrid)

  // ── 配置 ──
  const alignGroup = group('配置')
  const alignBtns = document.createElement('div')
  alignBtns.className = 'sb-align-btns'
  const alignButtons: HTMLButtonElement[] = []
  for (const a of ALIGN_LABELS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sb-align-btn'
    btn.title = a.title
    btn.innerHTML = a.svg
    btn.addEventListener('click', () => {
      applyBlock('align', a.value)
    })
    alignButtons.push(btn)
    alignBtns.append(btn)
  }
  alignGroup.append(alignBtns)

  // ── 書式（ツールバーから移動したボタン群） ──
  const fmtGroup = group('書式')
  const fmtBtns = document.createElement('div')
  fmtBtns.className = 'sb-fmt-btns'

  // 指示170: 太字=B / 斜体=I を四角ボタン化（押すと色が変わる）。B I U S リンク の並び。
  const boldBtn = fmtBtn('<span style="font-weight:800;font-size:14px">B</span>', '太字')
  boldBtn.addEventListener('click', () => toggleInline('bold'))
  const italicBtn = fmtBtn('<span style="font-style:italic;font-weight:600;font-size:14px;font-family:Georgia,serif">I</span>', '斜体')
  italicBtn.addEventListener('click', () => toggleInline('italic'))

  const ulBtn = fmtBtn(SVG.underline, '下線')
  ulBtn.addEventListener('click', () => toggleInline('underline'))

  const stBtn = fmtBtn(SVG.strike, '打消し線')
  stBtn.addEventListener('click', () => toggleInline('strike'))

  const linkBtn = fmtBtn(SVG.link, 'リンク')
  linkBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const fmt = quill.getFormat(r.index, r.length)
    const existing = typeof fmt['link'] === 'string' ? fmt['link'] : ''
    const url = prompt('リンクURL', existing || 'https://')
    if (url === null) return
    if (url === '' || url === 'https://') {
      quill.formatText(r.index, r.length, 'link', false, 'user')
    } else {
      quill.formatText(r.index, r.length, 'link', url, 'user')
    }
    refresh()
  })

  const clearBtn = fmtBtn(SVG.clearFmt, '書式クリア')
  clearBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.removeFormat(r.index, r.length, 'user')
    refresh()
  })

  fmtBtns.append(boldBtn, italicBtn, ulBtn, stBtn, linkBtn, clearBtn)
  fmtGroup.append(fmtBtns)

  // ── 挿入 ──
  const insGroup = group('挿入')
  const insBtns = document.createElement('div')
  insBtns.className = 'sb-ins-btns'

  const imgInsBtn = document.createElement('button')
  imgInsBtn.type = 'button'
  imgInsBtn.className = 'sb-ins-btn'
  imgInsBtn.innerHTML = `${SVG.image}画像`
  imgInsBtn.addEventListener('click', () => pickAndInsertMedia(quill))

  const brInsBtn = document.createElement('button')
  brInsBtn.type = 'button'
  brInsBtn.className = 'sb-ins-btn'
  brInsBtn.innerHTML = `${SVG.lineBreak}改行`
  brInsBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null) return
    quill.insertText(r.index, '\n', 'user')
  })

  insBtns.append(imgInsBtn, brInsBtn)
  insGroup.append(insBtns)

  // ── アクション ──
  const actGroup = group('アクション')
  actGroup.style.gap = '6px'
  actGroup.style.marginTop = '2px'

  const dupBtn = document.createElement('button')
  dupBtn.type = 'button'
  dupBtn.className = 'sb-pr-action'
  dupBtn.innerHTML = `${SVG.duplicate}要素を複製`
  dupBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const delta = quill.getContents(r.index, r.length)
    quill.updateContents(
      // @ts-expect-error -- Delta 型は new Delta() を要求するが、insert の配列で代替
      { ops: [{ retain: r.index + r.length }, ...delta.ops] },
      'user',
    )
  })

  const delBtn = document.createElement('button')
  delBtn.type = 'button'
  delBtn.className = 'sb-pr-action danger'
  delBtn.innerHTML = `${SVG.trash}要素を削除`
  delBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.deleteText(r.index, r.length, 'user')
  })

  actGroup.append(dupBtn, delBtn)

  // ── 組み立て ──
  // ── アニメーション（CapCut風の入場エフェクト・指示） ──
  const animGroup = group('アニメーション')
  let animSpeed = 'normal'
  const animGrid = document.createElement('div')
  animGrid.className = 'sb-pr-anim-grid'
  const animButtons = new Map<string, HTMLElement>()
  const setActiveAnim = (id: string): void => {
    for (const [key, b] of animButtons) b.classList.toggle('active', key === id)
  }
  // 選択テキストに付いた data-anim の span / img を1回再生し直す（プレビュー）
  const replayAnims = (): void => {
    for (const el of quill.root.querySelectorAll<HTMLElement>('[data-anim]')) {
      el.classList.remove('sb-anim-run')
      void el.offsetWidth // リフローで再生をリセット
      el.classList.add('sb-anim-run')
    }
  }
  let animLoop = false
  const applyAnim = (id: string): void => {
    if (id === '') {
      applyInline('anim', false)
      applyInline('animspeed', false)
      applyInline('animloop', false)
      setActiveAnim('')
      return
    }
    applyInline('anim', id)
    applyInline('animspeed', animSpeed)
    applyInline('animloop', animLoop ? '1' : false)
    setActiveAnim(id)
    replayAnims()
  }
  const mkAnimBtn = (label: string, id: string): HTMLElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sb-pr-anim-btn'
    b.textContent = label
    b.title = label
    b.addEventListener('click', () => applyAnim(id))
    animButtons.set(id, b)
    return b
  }
  animGrid.append(mkAnimBtn('なし', ''))
  for (const p of ANIM_PRESETS) animGrid.append(mkAnimBtn(p.label, p.id))
  animGroup.append(animGrid)

  const animCtl = document.createElement('div')
  animCtl.className = 'sb-pr-anim-ctl'
  const animSpeedSel = document.createElement('select')
  animSpeedSel.className = 'sb-pr-select'
  animSpeedSel.style.flex = '1'
  for (const s of ANIM_SPEEDS) {
    const o = document.createElement('option')
    o.value = s.id
    o.textContent = `速度: ${s.label}`
    if (s.id === 'normal') o.selected = true
    animSpeedSel.append(o)
  }
  animSpeedSel.addEventListener('change', () => {
    animSpeed = animSpeedSel.value
    const f = getFormats()
    if (typeof f['anim'] === 'string' && f['anim'] !== '') {
      applyInline('animspeed', animSpeed)
      replayAnims()
    }
  })
  const animReplayBtn = document.createElement('button')
  animReplayBtn.type = 'button'
  animReplayBtn.className = 'sb-pr-anim-replay'
  animReplayBtn.textContent = '▶ プレビュー'
  animReplayBtn.addEventListener('click', () => replayAnims())
  animCtl.append(animSpeedSel, animReplayBtn)
  animGroup.append(animCtl)

  // ループ設定（くり返し再生）
  const animLoopRow = document.createElement('label')
  animLoopRow.className = 'sb-pr-anim-loop'
  const animLoopChk = document.createElement('input')
  animLoopChk.type = 'checkbox'
  const animLoopTxt = document.createElement('span')
  animLoopTxt.textContent = 'ループ再生（くり返す）'
  animLoopRow.append(animLoopChk, animLoopTxt)
  animLoopChk.addEventListener('change', () => {
    animLoop = animLoopChk.checked
    const f = getFormats()
    if (typeof f['anim'] === 'string' && f['anim'] !== '') {
      applyInline('animloop', animLoop ? '1' : false)
      replayAnims()
    }
  })
  animGroup.append(animLoopRow)

  // 選択中テキストの現在のアニメ設定をUIへ反映する（refresh から呼ぶ）
  const syncAnimUI = (): void => {
    const f = getFormats()
    const cur = typeof f['anim'] === 'string' ? (f['anim'] as string) : ''
    setActiveAnim(cur)
    const sp = typeof f['animspeed'] === 'string' ? (f['animspeed'] as string) : 'normal'
    if (ANIM_SPEEDS.some((s) => s.id === sp)) {
      animSpeed = sp
      animSpeedSel.value = sp
    }
    animLoop = f['animloop'] === '1'
    animLoopChk.checked = animLoop
  }

  body.append(
    textGroup,
    fontRow, sizeRow,
    fmtGroup, // 指示170: 書式(B I U S リンク)を太字/斜体があった位置（サイズの直下）へ移動
    textColorRow, bgColorRow,
    lsRow, lhRow,
    alignGroup,
    animGroup,
    posGroup,
    insGroup,
    actGroup,
  )

  panel.append(header, tabs, body, imageBody, videoBody, emptyMsg)

  // ── 状態の同期 ──
  /** 画像選択モードを表示 */
  function showImageMode(img: HTMLImageElement): void {
    selectedImage = img
    selectedVideo = null
    body.style.display = 'none'
    imageBody.style.display = 'flex'
    videoBody.style.display = 'none'
    emptyMsg.style.display = 'none'
    title.textContent = '選択中：画像'
    refreshImageBody(imageBody, img)
  }

  /** 動画選択モードを表示 */
  function showVideoMode(video: HTMLVideoElement): void {
    selectedVideo = video
    selectedImage = null
    body.style.display = 'none'
    imageBody.style.display = 'none'
    videoBody.style.display = 'flex'
    emptyMsg.style.display = 'none'
    title.textContent = '選択中：動画'
    videoBody.sync?.(video)
  }

  function refresh(): void {
    // テキスト編集中は再帰的なrefreshを抑止する（deleteText→text-change→refresh の連鎖防止）
    if (isEditingText) return
    // 画像・動画を選んでいる間はそのモードを維持する
    if (selectedImage !== null && document.contains(selectedImage)) {
      return
    }
    if (selectedVideo !== null && document.contains(selectedVideo)) {
      return
    }
    selectedImage = null
    selectedVideo = null

    const r = getRange()
    const hasSelection = r !== null && r.length > 0

    if (hasSelection) {
      body.style.display = 'flex'
      imageBody.style.display = 'none'
      emptyMsg.style.display = 'none'
      title.textContent = '選択中：テキスト'
      syncAnimUI()
    } else {
      body.style.display = 'none'
      imageBody.style.display = 'none'
      emptyMsg.style.display = 'block'
      title.innerHTML = 'プロパティ'
      return
    }

    const fmt = getFormats()

    // テキスト内容
    if (r !== null) {
      textArea.value = quill.getText(r.index, r.length)
    }

    // フォント（選択中テキストの現在フォントをトリガー表示に反映）
    fontDropdown.setValue(typeof fmt['font'] === 'string' ? fmt['font'] : '')

    // サイズ
    sizeInput.value = fontSizeLabel(fmt['size']).replace('px', '')

    // 太字/斜体（書式行の B / I ボタンの選択状態）
    boldBtn.classList.toggle('active', fmt['bold'] === true)
    italicBtn.classList.toggle('active', fmt['italic'] === true)

    // 文字色（swatch + hex + picker全て同期）
    const tc = typeof fmt['color'] === 'string' ? fmt['color'] : '#000000'
    const tcNorm = normalizeColor(tc)
    tcSwatch.style.background = tcNorm
    tcHex.value = tcNorm.toUpperCase()
    tcPicker.value = tcNorm

    // 背景色（swatch + hex + picker全て同期）
    const bg = typeof fmt['background'] === 'string' ? fmt['background'] : '#FFFFFF'
    const bgNorm = normalizeColor(bg)
    bgSwatch.style.background = bgNorm
    bgHex.value = bgNorm.toUpperCase()
    bgPicker.value = bgNorm

    // 配置
    const align = fmt['align']
    for (let i = 0; i < alignButtons.length; i++) {
      const expected = ALIGN_LABELS[i]?.value
      const btn = alignButtons[i]
      if (btn === undefined) continue
      const isActive =
        (expected === false && (align === undefined || align === false)) ||
        align === expected
      btn.classList.toggle('active', isActive)
    }

    // 書式ボタン
    ulBtn.classList.toggle('active', fmt['underline'] === true)
    stBtn.classList.toggle('active', fmt['strike'] === true)
    linkBtn.classList.toggle('active', fmt['link'] !== undefined && fmt['link'] !== false)

    // 位置・サイズ（選択テキストの最初の行ブロックの矩形を読み取る）
    if (r !== null) {
      const bounds = quill.getBounds(r.index, r.length)
      if (bounds !== null) {
        posXInput.value = String(Math.round(bounds.left))
        posYInput.value = String(Math.round(bounds.top))
        posWInput.value = String(Math.round(bounds.width))
        posHInput.value = String(Math.round(bounds.height))
      }
    }
  }

  quill.on('selection-change', (range: { index: number; length: number } | null) => {
    // selection-change のパラメータを直接使い、getSelection() の再取得遅延を回避する
    if (range !== null && range.length > 0) {
      lastKnownRange = range
    }
    refresh()
  })
  quill.on('text-change', () => refresh())
  // ブラウザの selectionchange イベントでも検知する（Quill が発火しないケースの補完）
  document.addEventListener('selectionchange', () => {
    const r = quill.getSelection()
    if (r !== null && r.length > 0) {
      lastKnownRange = r
      refresh()
    }
  })
  setTimeout(refresh, 100)

  // 指示101: 画像クリックで右パネルに詳細を表示
  quill.root.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      showImageMode(target as HTMLImageElement)
    } else if (target.tagName === 'VIDEO') {
      showVideoMode(target as HTMLVideoElement)
    } else {
      // 画像・動画以外をクリックしたら選択を解除
      if (selectedImage !== null || selectedVideo !== null) {
        selectedImage = null
        selectedVideo = null
        refresh()
      }
    }
  })

  // mousedown で Quill の選択を奪わないようにする
  panel.addEventListener('mousedown', (e) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    e.preventDefault()
  })

  return panel
}

/* ── builders ── */





/* ── 指示101: 画像プロパティパネル ── */





