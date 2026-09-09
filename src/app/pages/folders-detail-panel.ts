/**
 * ページ一覧の右側に開く「詳細パネル」（folders.ts から分離）。
 *
 * 行をクリックすると開く、そのページ1件ぶんの詳細。
 * アコーディオンの開閉、鉛筆アイコンからのその場編集（名前・URL・CV条件など）、
 * お気に入りの星、値の書き戻しまでを受け持つ。
 *
 * 依存は一方向にしてある: このファイルは folders.ts を import しない。
 */
import { api, type AbTest } from '../api.ts'
import { T, button, el, toast } from '../ui.ts'
import { FOLDERS_HOOK } from './folders-substrate.ts'
import { openParamUrlModal } from '../panels/param-url-modal.ts'
import { openTrackingTagModal } from '../panels/tracking-tag-modal.ts'
import { openMetaLinkModal } from '../panels/meta-link-modal.ts'
import { AD_STATUS_LABELS, type PageContext } from './folders-shared.ts'

/**
 * 指示60→65: 詳細パネルの「閉じる »」ボタン。
 * パネル左端にタブ型で配置。クリックでパネルを畳む（非表示ではなく折り畳み）。
 * ページ行をホバー/クリックしたら再展開する。
 */
export function wireDetailPanelCloseButton(panel: HTMLElement): void {
  if (document.querySelector('[data-detail-close]') !== null) return

  // 親要素(.efy50tl23)が overflow:scroll のため、
  // その子要素はクリップされてしまう。
  // → grandparent(.efy50tl22, overflow:visible)にボタンを配置し、
  //   scrollParent の左端に合わせて突き出させる。
  const scrollParent = panel.parentElement
  if (scrollParent === null) return
  const grandparent = scrollParent.parentElement
  if (grandparent === null) return

  grandparent.style.position = 'relative'

  const closeBtn = document.createElement('button')
  closeBtn.setAttribute('data-detail-close', 'true')
  closeBtn.textContent = '閉じる »'
  closeBtn.style.cssText = [
    'position:absolute',
    'top:50%',
    'transform:translateY(-50%)',
    'z-index:10',
    'padding:8px 6px',
    'border:1px solid #ccc',
    'border-right:none',
    'border-radius:4px 0 0 4px',
    'background:#fff',
    'color:#666',
    'font-size:11px',
    `font-family:${T.font}`,
    'cursor:pointer',
    'white-space:nowrap',
    'writing-mode:vertical-rl',
    'text-orientation:mixed',
    'letter-spacing:2px',
    'transition:background 0.15s',
    'box-shadow:-2px 0 4px rgba(0,0,0,.08)',
    'display:none',
  ].join(';')

  // scrollParent の左端にボタンの右端を合わせる位置を計算
  const updatePosition = (): void => {
    const spLeft = scrollParent.offsetLeft
    closeBtn.style.left = `${spLeft - closeBtn.offsetWidth}px`
  }

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = '#f0f0f0'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = '#fff'
  })
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    // 畳む: scrollParent を幅0にする
    scrollParent.style.minWidth = '0'
    scrollParent.style.width = '0'
    scrollParent.style.overflow = 'hidden'
    scrollParent.style.padding = '0'
    scrollParent.style.borderLeft = 'none'
    scrollParent.setAttribute('data-collapsed', 'true')
    closeBtn.style.display = 'none'
  })

  grandparent.append(closeBtn)

  // scrollParent のホバーで表示/非表示
  scrollParent.addEventListener('mouseenter', () => {
    if (scrollParent.getAttribute('data-collapsed') !== 'true') {
      closeBtn.style.display = 'block'
      updatePosition()
    }
  })
  scrollParent.addEventListener('mouseleave', () => {
    // ボタンにマウスが移動した場合は閉じない
    setTimeout(() => {
      if (!closeBtn.matches(':hover')) closeBtn.style.display = 'none'
    }, 50)
  })
  closeBtn.addEventListener('mouseleave', () => {
    if (!scrollParent.matches(':hover')) closeBtn.style.display = 'none'
  })
}
/**
 * 指示65: 畳まれた詳細パネルを再展開する。
 * ページ行のホバー/クリックで呼ばれる。
 */
export function expandDetailPanel(body: HTMLElement): void {
  // scrollParent (.efy50tl23) が畳まれているかを確認
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  if (panel === null) return
  const scrollParent = panel.parentElement
  if (scrollParent === null || scrollParent.getAttribute('data-collapsed') !== 'true') return

  scrollParent.removeAttribute('data-collapsed')
  scrollParent.style.minWidth = ''
  scrollParent.style.width = ''
  scrollParent.style.overflow = ''
  scrollParent.style.padding = ''
  scrollParent.style.borderLeft = ''
  // 閉じるボタンは再びホバーで表示されるよう非表示に戻す
  const closeBtn = scrollParent.parentElement?.querySelector<HTMLElement>('[data-detail-close]')
  if (closeBtn !== null && closeBtn !== undefined) closeBtn.style.display = 'none'
}
/**
 * 指示64: 詳細パネルのセクションヘッダー（URL情報・beyondページ情報・配信情報）に色をつける。
 */
export function colorSectionHeaders(panel: HTMLElement): void {
  const headers = panel.querySelectorAll<HTMLElement>('.ej6u9q11')
  for (const header of headers) {
    header.style.background = '#F5F7FA'
    header.style.padding = '8px 12px'
    header.style.borderRadius = '0'
    header.style.borderBottom = '1px solid #E3E6EA'
    header.style.borderTop = '1px solid #E3E6EA'
    header.style.color = '#555'
    header.style.fontSize = '12px'
    header.style.fontWeight = '600'
  }
}
/**
 * 右の詳細パネル（採取した実マークアップ）の操作を配線する。
 * - 「パラメータ付きURLの発行」→ クローンのURL発行モーダル（実物と同じ入力項目）。
 * - 「コピー」→ 配信URLをクリップボードへ。
 * パネルの各値は採取物のまま（見た目は実物どおり）。
 */
export function wireRealDetailPanel(body: HTMLElement, context: PageContext): void {
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  if (panel === null) return

  // 指示60: ホバー時のみ「閉じる >>」ボタンを表示
  wireDetailPanelCloseButton(panel)

  const baseUrl = paramUrlBase(panel, context)

  // 採取フラグメント内の配信URLリンク（テキスト・href とも旧形式 /ab/ のまま）を実パス /lp/ へ書き換える。
  // context.abTests はフォルダ未選択時に空なので、UID に依存せずテキストを置換する。
  for (const deliveryLink of panel.querySelectorAll<HTMLAnchorElement>('a[href*="/ab/"]')) {
    const oldHref = deliveryLink.getAttribute('href') ?? ''
    const newHref = oldHref.replace('/ab/', '/lp/')
    deliveryLink.setAttribute('href', newHref)
    const oldText = (deliveryLink.textContent ?? '').trim()
    deliveryLink.textContent = oldText.replace('/ab/', '/lp/')
    deliveryLink.removeAttribute('target')
  }

  const paramButton = findByText(panel, 'パラメータ付きURLの発行')
  if (paramButton !== null) {
    paramButton.style.cursor = 'pointer'
    paramButton.addEventListener('click', () => openParamUrlModal(baseUrl))

    // 外部LP計測タグの発行（クローン独自機能）。別アカウントで配信中のLPに貼ると、その
    // PV/クリックをこの beyondページのレポートへ計上できる。URL/計測系の並びに置く。
    // 採取物のボタンを複製して見た目を合わせる（cloneNode(false)=属性だけ引き継ぐ）。
    const alreadyAdded = paramButton.parentElement?.querySelector('[data-tracking-tag-btn]') ?? null
    if (alreadyAdded === null) {
      const tagButton = paramButton.cloneNode(false) as HTMLElement
      tagButton.setAttribute('data-tracking-tag-btn', 'true')
      tagButton.textContent = '外部LP計測タグを発行'
      tagButton.style.cursor = 'pointer'
      tagButton.style.marginTop = '8px'
      // 配線時ではなくクリック時に「今パネルが見ているLP」を引く（先頭LP固定にしない）
      tagButton.addEventListener('click', () => {
        const current = currentPanelAbTest(panel, context)
        openTrackingTagModal(
          current === null ? baseUrl : `${location.origin}/lp/${current.uid}`,
        )
      })
      paramButton.insertAdjacentElement('afterend', tagButton)

      // Meta広告連携（媒体実績の取り込み）。配信金額/IMP/媒体Click/媒体CV はここから入る。
      const metaButton = paramButton.cloneNode(false) as HTMLElement
      metaButton.setAttribute('data-meta-link-btn', 'true')
      metaButton.textContent = 'Meta広告を連携'
      metaButton.style.cursor = 'pointer'
      metaButton.style.marginTop = '8px'
      metaButton.addEventListener('click', () => {
        const current = currentPanelAbTest(panel, context)
        if (current === null) {
          toast('beyondページを選んでから押してください', 'error')
          return
        }
        openMetaLinkModal(current.uid, current.title)
      })
      tagButton.insertAdjacentElement('afterend', metaButton)
    }
  }

  for (const copy of panel.querySelectorAll<HTMLElement>('[aria-label="コピー"]')) {
    copy.addEventListener('click', (event) => {
      event.stopPropagation()
      void navigator.clipboard?.writeText(baseUrl).then(
        () => toast('配信URLをコピーしました'),
        () => toast('コピーできませんでした', 'error'),
      )
    })
  }

  // 鉛筆アイコン（data-testid="pencil-icon"）→ インライン編集
  wirePencilIcons(panel, context)

  // ヘッダーのページ名鉛筆（パネル外にある）を配線
  wireHeaderPencil(body, context)

  // 折りたたみセクション（URL情報・beyondページ情報・配信情報）のアコーディオン開閉
  wireAccordionSections(panel)

  // 指示64: セクションヘッダーに色をつける
  colorSectionHeaders(panel)
}
/**
 * ヘッダーのページ名鉛筆（パネル外にある `.efy50tl4` 内の pencil-icon）を配線する。
 * クリック → ページ名のテキストが input に変わり、Enter/blur で API 更新。
 */
export function wireHeaderPencil(body: HTMLElement, context: PageContext): void {
  const abTest = context.abTests[0]
  if (abTest === undefined) return

  // パネル外のすべての鉛筆を探し、パネル内に無いものを対象にする
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  const allPencils = body.querySelectorAll<SVGElement>('[data-testid="pencil-icon"]')
  for (const pencilSvg of allPencils) {
    if (panel !== null && panel.contains(pencilSvg)) continue
    // ヘッダーの鉛筆 → ページ名の編集
    const clickTarget = pencilSvg.closest<HTMLElement>('.css-fbr94v') ?? (pencilSvg.parentElement as HTMLElement)
    clickTarget.style.cursor = 'pointer'
    clickTarget.addEventListener('click', (e) => {
      e.stopPropagation()
      openInlineEdit(pencilSvg, { key: 'title', type: 'text' }, abTest.uid)
    })
  }
}
/**
 * 詳細パネルの折りたたみセクション（ej6u9q12）を配線する。
 * ヘッダー（ej6u9q11）をクリックでコンテンツ（ej6u9q10）をトグルし、
 * 矢印アイコン（arrow-down-icon）を回転させる。
 */
export function wireAccordionSections(panel: HTMLElement): void {
  const sections = panel.querySelectorAll<HTMLElement>('.ej6u9q12')
  for (const section of sections) {
    const header = section.querySelector<HTMLElement>('.ej6u9q11')
    const content = section.querySelector<HTMLElement>('.ej6u9q10')
    if (header === null || content === null) continue

    const arrow = header.querySelector<SVGElement>('[data-testid="arrow-down-icon"]')
    let isOpen = true  // 初期状態は開いている（採取物のまま）

    header.style.cursor = 'pointer'
    header.addEventListener('click', () => {
      isOpen = !isOpen
      content.style.display = isOpen ? '' : 'none'
      if (arrow !== null) {
        arrow.style.transition = 'transform 0.2s ease'
        arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'
      }
    })
  }
}
/**
 * 詳細パネルの鉛筆アイコン（7個）をインライン編集に配線する。
 * 実物: ページ名 / 配信ステータス / 配信タイプ / 広告媒体 / コンバージョンポイント / コンバージョン単価 / 計測方法
 *
 * 鉛筆をクリック → 値テキストが input/select に変わる → 確定で PUT /ab_tests/:uid → DOM更新。
 */
export function wirePencilIcons(panel: HTMLElement, context: PageContext): void {
  const abTest = context.abTests[0]
  if (abTest === undefined) return

  const pencils = [...panel.querySelectorAll<SVGElement>('[data-testid="pencil-icon"]')]

  /**
   * 配信情報セクション内の鉛筆の順番（パネル内のみ。ヘッダーのページ名鉛筆は
   * パネル外なのでここには含まない — 含めると全フィールドが1つずれる）。
   */
  const fields: PencilField[] = [
    { key: 'ad_status', type: 'select', options: ['準備中', '配信中', '停止中', '終了'] },
    { key: 'delivery_type', type: 'select', options: ['同一URL配信', '異なるURL配信'] },
    { key: 'media_id', type: 'text', readonly: true },
    { key: 'conversion_condition', type: 'select', options: ['クリック', 'アクセス'] },
    { key: 'conversion_unit_price', type: 'text', inputType: 'number' },
    { key: 'affiliate_service_provider', type: 'text', readonly: true },
  ]

  for (let i = 0; i < pencils.length && i < fields.length; i++) {
    const pencilSvg = pencils[i] as SVGElement
    const field = fields[i] as PencilField
    const clickTarget = pencilSvg.closest<HTMLElement>('.css-fbr94v') ?? (pencilSvg as unknown as HTMLElement)
    clickTarget.style.cursor = 'pointer'
    clickTarget.addEventListener('click', (e) => {
      e.stopPropagation()
      openInlineEdit(pencilSvg, field, abTest.uid)
    })
  }
}
export interface PencilField {
  key: string
  type: 'text' | 'select'
  options?: readonly string[]
  inputType?: string
  readonly?: boolean
}
/**
 * 鉛筆アイコンの横に小さなポップオーバーを出してインライン編集する。
 * テキスト → input, セレクト → select を表示。保存で API 呼び出し → DOM 更新。
 */
export function openInlineEdit(
  pencilSvg: SVGElement,
  field: PencilField,
  abTestUid: string,
): void {
  // 既存のポップオーバーがあれば閉じる
  document.querySelector('.sb-inline-edit')?.remove()

  // 現在の表示値を取得（鉛筆の隣のテキスト）
  const valueContainer = findValueContainer(pencilSvg)
  const currentText = valueContainer !== null ? (valueContainer.textContent ?? '').trim() : ''

  // 読み取り専用のフィールドは基本情報ページへ遷移
  if (field.readonly === true) {
    toast('この項目は基本情報ページで編集できます')
    return
  }

  // ポップオーバーを作成
  const popover = el('div', {
    style: [
      'z-index:1200',
      `background:${T.surface};border:1px solid #DDD;border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.12);padding:12px 16px',
      `min-width:220px;font-family:${T.font}`,
    ].join(';'),
  })
  popover.classList.add('sb-inline-edit')

  let inputEl: HTMLInputElement | HTMLSelectElement

  if (field.type === 'select' && field.options !== undefined) {
    const sel = document.createElement('select')
    sel.style.cssText = `width:100%;padding:6px 8px;font-size:13px;border:1px solid #CCC;border-radius:4px;font-family:${T.font}`
    for (const opt of field.options) {
      const o = document.createElement('option')
      o.value = opt
      o.textContent = opt
      if (opt === currentText) o.selected = true
      sel.append(o)
    }
    inputEl = sel
  } else {
    const inp = document.createElement('input')
    inp.type = field.inputType ?? 'text'
    inp.value = currentText === '-' ? '' : currentText
    inp.style.cssText = `width:100%;padding:6px 8px;font-size:13px;border:1px solid #CCC;border-radius:4px;font-family:${T.font};box-sizing:border-box`
    inputEl = inp
  }

  const btnRow = el('div', { style: 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end' })
  const cancelBtn = button('キャンセル')
  cancelBtn.style.cssText += ';padding:4px 12px;font-size:12px;background:#F5F5F5;color:#333'
  const saveBtn = button('保存')
  saveBtn.style.cssText += ';padding:4px 12px;font-size:12px'

  cancelBtn.addEventListener('click', () => popover.remove())
  saveBtn.addEventListener('click', () => {
    const newValue = inputEl.value.trim()
    if (newValue === '') {
      toast('値を入力してください', 'error')
      return
    }
    saveBtn.textContent = '保存中…'
    saveBtn.setAttribute('disabled', '')

    const body = buildPatchBody(field.key, newValue)
    void api.updateAbTest(abTestUid, body).then(
      () => {
        popover.remove()
        // DOM上の表示テキストを更新
        if (valueContainer !== null) {
          valueContainer.textContent = newValue
        }
        toast('更新しました')
      },
      (err: Error) => {
        saveBtn.textContent = '保存'
        saveBtn.removeAttribute('disabled')
        toast(`更新に失敗しました: ${err.message}`, 'error')
      },
    )
  })

  // Enter で保存
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      saveBtn.click()
    }
    if (e.key === 'Escape') popover.remove()
  }) as EventListener)

  btnRow.append(cancelBtn, saveBtn)
  popover.append(inputEl, btnRow)

  // 鉛筆の位置に fixed ポップオーバーで表示
  const anchor = pencilSvg.closest<HTMLElement>('.css-fbr94v') ?? (pencilSvg as unknown as HTMLElement)
  const rect = anchor.getBoundingClientRect()
  popover.style.position = 'fixed'
  popover.style.top = `${rect.bottom + 4}px`
  popover.style.right = `${window.innerWidth - rect.right}px`
  document.body.append(popover)

  // フォーカス
  inputEl.focus()
  if (inputEl instanceof HTMLInputElement) inputEl.select()

  // 外側クリックで閉じる
  const onOutsideClick = (ev: MouseEvent): void => {
    if (!popover.contains(ev.target as Node)) {
      popover.remove()
      document.removeEventListener('mousedown', onOutsideClick)
    }
  }
  setTimeout(() => document.addEventListener('mousedown', onOutsideClick), 0)
}
/** 鉛筆SVGの隣にある値テキストの要素を探す */
export function findValueContainer(pencilSvg: SVGElement): HTMLElement | null {
  // パターン1: 鉛筆が <dd> 内にある → <dd> の中で SVG/div.css-fbr94v 以外のテキストノード
  const dd = pencilSvg.closest('dd')
  if (dd !== null) {
    // dd内の直接テキストか、pencilの前にあるspan/div
    for (const child of dd.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
        // テキストノードをspanで囲んで返す
        const span = document.createElement('span')
        span.textContent = (child.textContent ?? '').trim()
        child.replaceWith(span)
        return span
      }
      if (child instanceof HTMLElement && !child.classList.contains('css-fbr94v') && child.tagName !== 'svg') {
        return child
      }
    }
  }
  // パターン2: ページ名 → 鉛筆の前の兄弟要素
  const parent = (pencilSvg.closest('.css-fbr94v') ?? pencilSvg).parentElement
  if (parent !== null) {
    for (const child of parent.children) {
      if (child !== pencilSvg.closest('.css-fbr94v') && child !== pencilSvg && child instanceof HTMLElement) {
        const text = (child.textContent ?? '').trim()
        if (text !== '') return child
      }
    }
  }
  return null
}
/** フィールドキーに応じて、PUT /ab_tests/:uid に送る部分更新ボディを作る */
export function buildPatchBody(key: string, value: string): Record<string, unknown> {
  switch (key) {
    case 'title': return { title: value }
    case 'ad_status': {
      const map: Record<string, string> = { '準備中': 'prepared', '配信中': 'delivered', '停止中': 'stopping', '終了': 'finished' }
      return { ad_status: map[value] ?? value }
    }
    case 'delivery_type': return { delivery_type: value }
    case 'conversion_condition': return { conversion_condition: value.toLowerCase() === 'アクセス' ? 'access' : 'click' }
    case 'conversion_unit_price': return { conversion_unit_price: Number(value) || 0 }
    default: return { [key]: value }
  }
}
/**
 * 詳細パネルが今表示している beyondページ。パネルはホバー/クリックで対象が変わるので、
 * 配線時ではなく**クリック時**にここを見る（先頭LP固定だと別のLPに紐付いてしまう）。
 * `updateDetailPanelForAbTest` が data 属性に現在の対象を書いている。
 */
export function currentPanelAbTest(
  panel: HTMLElement,
  context: PageContext,
): { uid: string; title: string } | null {
  const uid = panel.dataset['abTestUid'] ?? ''
  if (uid !== '') {
    const found = context.abTests.find((t) => t.uid === uid)
    return { uid, title: found?.title ?? panel.dataset['abTestTitle'] ?? '' }
  }
  const first = context.abTests[0]
  return first === undefined ? null : { uid: first.uid, title: first.title }
}
export function paramUrlBase(panel: HTMLElement, context: PageContext): string {
  const current = currentPanelAbTest(panel, context)
  if (current !== null) return `${location.origin}/lp/${current.uid}`
  const shown = Array.from(panel.querySelectorAll<HTMLElement>('a, div')).find((node) =>
    /^\/(?:ab|lp)\//.test((node.textContent ?? '').trim()),
  )
  const path = (shown?.textContent ?? '/lp/UID').trim().replace(/^\/ab\//, '/lp/')
  return `${location.origin}${path}`
}
/** 子孫から、指定文字列と完全一致するテキストだけを持つ最小要素を探す（アイコン等を巻き込まない）。 */
export function findByText(root: HTMLElement, text: string): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('div, button, span, a'))
  return (
    nodes.find(
      (node) => (node.textContent ?? '').trim() === text && node.children.length <= 1,
    ) ?? null
  )
}
/** UNIXタイムスタンプ（秒）を「2026年8月31日 19時27分」形式に変換 */
export function formatAbsoluteTime(ts: number | undefined): string {
  if (ts === undefined || ts === 0) return '-'
  const d = new Date(ts * 1000)
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${mo}月${day}日 ${h}時${mi}分`
}
/** editor_version を表示名に変換 */
export function editorTypeName(v: number): string {
  if (v === 2) return 'beyondエディター'
  if (v === 3) return 'HTMLエディター'
  return '-'
}
/** conversion_condition を表示名に変換 */
export function conversionConditionName(c: string | undefined): string {
  if (c === 'click') return 'クリック'
  if (c === 'access') return 'アクセス'
  return '-'
}
export function updateDetailPanelForAbTest(body: HTMLElement, abTest: AbTest, context: PageContext): void {
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  if (panel === null) return
  // 計測タグ発行 / Meta連携がクリック時に「今どのLPを見ているか」を引けるようにする
  panel.dataset['abTestUid'] = abTest.uid
  panel.dataset['abTestTitle'] = abTest.title

  // ── ヘッダーのページ名（パネル外の見出し） ──
  const headerTitle = body.querySelector<HTMLElement>('.efy50tl4 .efy50tl3')
  if (headerTitle !== null) {
    // テキストだけ差し替え（鉛筆アイコン等は残す）
    const textNode = [...headerTitle.childNodes].find(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
    )
    if (textNode !== undefined && textNode !== null) textNode.textContent = abTest.title
    else {
      const existing = headerTitle.querySelector<HTMLElement>(':not(.css-fbr94v):not(svg)')
      if (existing !== null) existing.textContent = abTest.title
    }
  }

  // ── パネル内の値を更新 ──
  // 配信URL
  const deliveryLinks = panel.querySelectorAll<HTMLAnchorElement>('a')
  for (const link of deliveryLinks) {
    const href = link.getAttribute('href') ?? ''
    if (/\/(?:ab|lp)\//.test(href)) {
      const newPath = `/lp/${abTest.uid}`
      link.setAttribute('href', newPath)
      link.textContent = newPath
    }
  }

  // ── beyondページ情報セクション ──
  const genreDd = findDdByDtText(panel, '商品ジャンル')
  if (genreDd !== null) {
    const genres = abTest.product_genres
    setDdText(genreDd, genres !== undefined && genres.length > 0 ? genres.join(', ') : '-')
  }

  const createdDd = findDdByDtText(panel, '作成日')
  if (createdDd !== null) setDdText(createdDd, formatAbsoluteTime(abTest.created_at))

  const updatedDd = findDdByDtText(panel, '更新')
  if (updatedDd !== null) setDdText(updatedDd, formatAbsoluteTime(abTest.updated_at))

  const editorDd = findDdByDtText(panel, '編集タイプ')
  if (editorDd !== null) setDdText(editorDd, editorTypeName(abTest.editor_version))

  // relation_counts から Version数/ポップアップ数/中間ページ数を取得
  const rc = context.relationCounts.find((r) => r.id === abTest.id)
  const versionDd = findDdByDtText(panel, 'バージョン数')
  if (versionDd !== null) setDdText(versionDd, String(rc?.versions_count ?? 0))

  const popupDd = findDdByDtText(panel, 'ポップアップ数')
  if (popupDd !== null) setDdText(popupDd, String(rc?.exit_popups_count ?? 0))

  const redirectDd = findDdByDtText(panel, '中間ページ数')
  if (redirectDd !== null) setDdText(redirectDd, String(rc?.funnel_steps_count ?? 0))

  // ── 配信情報セクション ──
  const status = AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status
  const statusDd = findDdByDtText(panel, '配信ステータス')
  if (statusDd !== null) setDdText(statusDd, status)

  const deliveryTypeDd = findDdByDtText(panel, '配信タイプ')
  if (deliveryTypeDd !== null) setDdText(deliveryTypeDd, abTest.delivery_type ?? '同一URL配信')

  const mediaDd = findDdByDtText(panel, '広告媒体')
  if (mediaDd !== null) setDdText(mediaDd, abTest.media?.name ?? '-')

  const cvPointDd = findDdByDtText(panel, 'コンバージョンポイント')
  if (cvPointDd !== null) setDdText(cvPointDd, conversionConditionName(abTest.conversion_setting?.conversion_condition))

  const cvPriceDd = findDdByDtText(panel, 'コンバージョン単価')
  if (cvPriceDd !== null) {
    const price = abTest.conversion_unit_price
    setDdText(cvPriceDd, price !== undefined && price > 0 ? `¥${price.toLocaleString()}` : '-')
  }

  const measureDd = findDdByDtText(panel, '計測方法')
  if (measureDd !== null) setDdText(measureDd, abTest.affiliate_service_provider ?? '-')

  // フォルダドメイン
  const folder = context.folder
  if (folder !== null) {
    const domainDd = findDdByDtText(panel, 'フォルダドメイン')
    if (domainDd !== null) {
      const nameSpan = domainDd.querySelector<HTMLElement>('span, div, p')
      if (nameSpan !== null) nameSpan.textContent = `${folder.name.toLowerCase().replace(/\s+/g, '-')}.example.test`
    }
  }

  // ページ名の「サンプル施策NNN」部分
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    const text = (node.textContent ?? '').trim()
    if (/^サンプル施策\d+$/.test(text)) {
      node.textContent = abTest.title
    }
    node = walker.nextNode()
  }
}
/** dt のテキストが一致する次の dd を返す */
export function findDdByDtText(panel: HTMLElement, dtText: string): HTMLElement | null {
  const dts = panel.querySelectorAll('dt')
  for (const dt of dts) {
    if ((dt.textContent ?? '').trim() === dtText) {
      const dd = dt.nextElementSibling
      if (dd instanceof HTMLElement && dd.tagName === 'DD') return dd
    }
  }
  return null
}
/** dd の中のテキストを更新（鉛筆アイコン等は残す） */
export function setDdText(dd: HTMLElement, text: string): void {
  for (const child of dd.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
      child.textContent = text
      return
    }
    if (child instanceof HTMLElement && !child.classList.contains('css-fbr94v') && child.tagName !== 'svg') {
      const inner = child.querySelector('span, p, div')
      if (inner !== null) { inner.textContent = text; return }
      if (child.children.length === 0) { child.textContent = text; return }
    }
  }
  // fallback: テキストノードを作って先頭に追加
  const textNode = document.createTextNode(text)
  dd.prepend(textNode)
}
/** 星アイコンの見た目をお気に入り状態に合わせて変える。 */
export function updateStarAppearance(starBtn: HTMLElement, isFavorite: boolean): void {
  const svg = starBtn.querySelector('svg')
  if (svg === null) return
  const path = svg.querySelector('path')
  if (path === null) return
  if (isFavorite) {
    // 塗りつぶし（ブランド色）
    path.setAttribute('fill', 'var(--sb-accent, #0091FF)')
    path.setAttribute('stroke', 'var(--sb-accent, #0091FF)')
  } else {
    // 線だけ（既定）— stroke を残さないと星が透明になる
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#999')
    path.setAttribute('stroke-width', '1')
  }
}
