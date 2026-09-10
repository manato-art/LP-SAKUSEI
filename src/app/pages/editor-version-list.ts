/**
 * Versionカードの一覧と、その上での操作（editor.ts から分離）。
 *
 * ここが受け持つのは「左のVersionパネルに何を並べ、押したら何が起きるか」:
 *   - カード1枚のDOMを組み立てる（採取カードのクローンではなく、実物準拠の構造を生成）
 *   - 一覧を描き直す / 通常一覧とアーカイブ一覧を切り替える
 *   - 名前・配信割合の編集、まとめてアーカイブ、復元
 *   - Versionを開く（loadVersion）と保存する（saveHtml）
 *
 * 依存は一方向にしてある: このファイルは editor.ts を import しない。
 */
import { api, type Version } from '../api.ts'
import { toast } from '../ui.ts'
import { setVersionListMode } from '../panels/version-actions.ts'
import { updateUrlBar } from '../panels/url-bar.ts'
import { mountVersionDotsMenu } from '../panels/version-dots-menu.ts'
import { refreshComparePreview, isComparePanelOpen } from '../panels/compare-mode.ts'
import type { EditorContext } from './editor-context.ts'
import { ACTIVE_CARD_CLASS, injectVersionCardCss } from './editor-styles.ts'
import { HOOK } from './editor-hooks.ts'
import { buildFullHtml, isEffectivelyEmptyHtml, restoreHeaderImage, splitHeaderFromHtml } from './editor-html.ts'
import { containWidgetStyles } from '../panels/widget-style-scope.ts'

/**
 * バージョンカードのDOM要素を一から組み立てる。
 * 採取テンプレートのクローンではなく、スクリーンショット準拠の構造を生成する。
 * wireVersionCard / wireArchivedCard が配線するための data-test 属性は全て保持する。
 */
function buildVersionCardEl(version: Version, isCurrent: boolean): HTMLElement {
  injectVersionCardCss()

  const card = document.createElement('div')
  card.dataset['articleUid'] = version.uid
  card.setAttribute('data-id', String(version.id))
  card.style.cursor = 'pointer'

  const inner = document.createElement('div')
  inner.setAttribute('data-test', 'ArticleList-CurrentArticle')
  inner.className = `_currentVersion_vc${isCurrent ? ` ${ACTIVE_CARD_CLASS}` : ''}`

  // ── Row 1: Version名 + バッジ ──
  const nameRow = document.createElement('div')
  nameRow.className = 'sb-vc-name-row'

  const nameInput = document.createElement('input')
  nameInput.setAttribute('data-test', 'ArticleList-InputMemo')
  nameInput.value = version.name
  nameInput.className = 'sb-vc-name'

  const badge = document.createElement('span')
  badge.setAttribute('data-version-badge', 'true')
  badge.className = `sb-vc-badge ${isCurrent ? 'sb-vc-badge--editing' : 'sb-vc-badge--saved'}`
  badge.textContent = isCurrent ? '編集中' : '保存済み'

  nameRow.append(nameInput, badge)

  // ── Row 2: 配信割合（SB実物準拠: アイコン+説明 / −数値%+ / プリセットセレクト+保存） ──
  const ratioRow = document.createElement('div')
  ratioRow.className = 'sb-vc-ratio-row'

  // Row 2-1: アイコン + タイトル + 説明
  const ratioHeader = document.createElement('div')
  ratioHeader.className = 'sb-vc-ratio-header'

  const ratioIcon = document.createElement('span')
  ratioIcon.className = 'sb-vc-ratio-icon'
  ratioIcon.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="19" r="1.5" fill="#fff" stroke="none"/>' +
    '<path d="M8.5 15.5a5 5 0 0 1 7 0"/><path d="M5.5 12.5a9 9 0 0 1 13 0"/></svg>'

  const ratioHeadText = document.createElement('div')
  ratioHeadText.className = 'sb-vc-ratio-headtext'
  const ratioTitle = document.createElement('div')
  ratioTitle.className = 'sb-vc-ratio-title'
  ratioTitle.textContent = '配信割合'
  // 指示152: 「配信される割合を調整できます。」の説明文は表示しない。
  ratioHeadText.append(ratioTitle)
  ratioHeader.append(ratioIcon, ratioHeadText)

  // Row 2-2: −/数値/%/+ コントロール（ratioInput は非表示のまま値の正とし、表示は ratioDisplay が担う）
  const ratioControl = document.createElement('div')
  ratioControl.className = 'sb-vc-ratio-control'

  const ratioInput = document.createElement('input')
  ratioInput.setAttribute('data-test', 'ArticleList-DeriveryRateForm')
  ratioInput.type = 'number'
  ratioInput.value = String(version.distribution_ratio)
  ratioInput.className = 'sb-vc-ratio-input'

  const downBtn = document.createElement('button')
  downBtn.setAttribute('data-test', 'ArticleList-DeriveryDownRateForm')
  downBtn.type = 'button'
  downBtn.className = 'sb-vc-ratio-btn sb-vc-ratio-btn--minus'
  downBtn.textContent = '−'

  const ratioDisplay = document.createElement('span')
  ratioDisplay.className = 'sb-vc-ratio-display'
  ratioDisplay.textContent = String(version.distribution_ratio)

  const pct = document.createElement('span')
  pct.className = 'sb-vc-ratio-pct'
  pct.textContent = '%'

  const upBtn = document.createElement('button')
  upBtn.setAttribute('data-test', 'ArticleList-DeriveryUpRateForm')
  upBtn.type = 'button'
  upBtn.className = 'sb-vc-ratio-btn sb-vc-ratio-btn--plus'
  upBtn.textContent = '+'

  // プリセットのドロップダウン
  const ratioSelect = document.createElement('select')
  ratioSelect.className = 'sb-vc-ratio-select'
  const ratioPresets = [10, 50, 100] // 指示150
  for (const preset of ratioPresets) {
    const option = document.createElement('option')
    option.value = String(preset)
    option.textContent = `${preset}%`
    ratioSelect.append(option)
  }
  if (ratioPresets.includes(version.distribution_ratio)) {
    ratioSelect.value = String(version.distribution_ratio)
  }

  // −1%+ / プルダウン を1行にまとめる（保存状態は下部タイムスタンプで表示）
  ratioControl.append(downBtn, ratioDisplay, pct, upBtn, ratioSelect)

  ratioRow.append(ratioHeader, ratioControl, ratioInput)

  // ── サムネイル ──
  const thumb = document.createElement('div')
  thumb.setAttribute('data-version-thumb', 'true')
  thumb.className = 'sb-vc-thumb'
  const rawHtml = version.html || ''
  // ヘッダー画像コメントを<img>タグに展開してサムネイルに含める
  const { headerSrc, body: thumbBody } = splitHeaderFromHtml(rawHtml)
  const thumbHtml = (headerSrc !== null ? `<img src="${headerSrc}" style="display:block;width:100%;object-fit:cover">` : '') + thumbBody
  if (thumbHtml.includes('background') || thumbHtml.includes('img')) {
    const LP_W = 640
    const THUMB_H = 80
    const THUMB_SCALE = 210 / LP_W
    const preview = document.createElement('div')
    preview.style.cssText = `position:absolute;top:0;left:0;width:${LP_W}px;height:${Math.round(THUMB_H / THUMB_SCALE)}px;transform:scale(${THUMB_SCALE});transform-origin:top left;pointer-events:none;overflow:hidden`
    preview.innerHTML = thumbHtml
    // Widget の <style> はこのサムネイルの中だけに効かせる（そのまま置くと編集画面全体に効いていた）
    containWidgetStyles(preview, 'lp')
    thumb.append(preview)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'sb-vc-thumb-placeholder'
    placeholder.textContent = 'プレビュー'
    thumb.append(placeholder)
  }

  // ── タイムスタンプ + NEW ──
  const meta = document.createElement('div')
  meta.setAttribute('data-version-meta', 'true')
  meta.className = 'sb-vc-meta'
  meta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  const timeText = document.createElement('span')
  const updatedAt = (version as unknown as Record<string, unknown>)['updated_at']
  // updated_at は UNIXタイムスタンプ（秒）= number。string の場合はISO。
  if (typeof updatedAt === 'number' && updatedAt > 0) {
    timeText.textContent = relativeTime(new Date(updatedAt * 1000).toISOString()) + 'に保存'
  } else if (typeof updatedAt === 'string') {
    timeText.textContent = relativeTime(updatedAt) + 'に保存'
  } else {
    timeText.textContent = '保存済み'
  }
  meta.append(timeText)

  // ── ⋮ ドットメニュー（meta行の右端） ──
  const metaSpacer = document.createElement('div')
  metaSpacer.style.flex = '1'
  const dotsArea = document.createElement('div')
  dotsArea.className = '_articleButtons_1xibh_160 sb-vc-dots-area'
  const dotsBtn = document.createElement('button')
  dotsBtn.type = 'button'
  dotsBtn.className = 'css-3tls8'
  dotsBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
  dotsArea.append(dotsBtn)
  meta.append(metaSpacer, dotsArea)

  // ── コンテンツラッパー（選択モードのチェックボックス挿入先） ──
  const content = document.createElement('div')
  content.className = '_abTestArticleContent_vc'
  content.append(nameRow, ratioRow, thumb, meta)

  inner.append(content)
  card.append(inner)
  return card
}
/** ISO 日時文字列を相対表現に変換する */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  return `${days}日前`
}
export function loadVersion(ctx: EditorContext, uid: string): void {
  const v = ctx.versions.find((x) => x.uid === uid)
  if (v === undefined) return

  // 指示72: バージョン切り替え中のローディング表示
  const contentWrapper = ctx.root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  let overlay: HTMLElement | null = null
  if (contentWrapper !== null) {
    overlay = document.createElement('div')
    overlay.setAttribute('data-version-loading', 'true')
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:100',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(255,255,255,.7)',
    ].join(';')
    overlay.innerHTML = `<div style="text-align:center">
      <div style="width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#4A90D9;border-radius:50%;animation:sbspin .7s linear infinite;margin:0 auto"></div>
      <div style="margin-top:8px;font-size:13px;color:#666">バージョン切り替え中...</div>
    </div>`
    if (getComputedStyle(contentWrapper).position === 'static') {
      contentWrapper.style.position = 'relative'
    }
    contentWrapper.append(overlay)
  }

  // 重い DOM 更新をマクロタスクに回してオーバーレイを先に描画させる
  setTimeout(() => {
    ctx.currentUid = uid
    // ヘッダー画像とQuill本文を分離
    const { headerSrc, body } = splitHeaderFromHtml(v.html)
    ctx.quill.root.innerHTML = body
    // ヘッダー画像を復元
    if (headerSrc !== null) {
      restoreHeaderImage(ctx.root, headerSrc)
    }
    renderVersionList(ctx)
    overlay?.remove()
    // URLバーを新しい Version UID で更新
    const urlBarEl = ctx.root.querySelector<HTMLElement>('[data-url-bar]')
    if (urlBarEl !== null) {
      updateUrlBar(urlBarEl, {
        testUrl: `${location.origin}/preview/${uid}`,
        // 配信URLはABテスト単位なのでVersion切替では変わらない
      })
    }
    // 比較パネルが開いていればプレビューも更新
    if (isComparePanelOpen()) refreshComparePreview(v.html)
  }, 50)
}
/** カードの「…」トリガー（採取物のクラス） */
const DOTS_MENU_TRIGGER = 'button.css-3tls8'
/**
 * Versionパネルのカードを ctx.versions から**1枚ずつ描き直す**。
 * 採取物には現在Versionのカードが1枚しか無いので、それを雛形にVersionの数だけ複製して並べる。
 * これが無いと、複製/追加したVersionのカードが下に増えない（＝ユーザー報告の不具合）。
 */
export function renderVersionList(ctx: EditorContext): void {
  const list = ctx.root.querySelector<HTMLElement>(HOOK.versionList)
  if (list === null) return
  const addButton = list.querySelector<HTMLElement>(HOOK.addVersion)
  for (const card of list.querySelectorAll<HTMLElement>(HOOK.versionRow)) card.remove()
  // 前回の「さらに読み込む」を除去（再描画のたびに作り直す）
  list.querySelector('.sb-vc-load-more')?.remove()

  const archivedMode = ctx.listMode === 'archived'
  const shown = ctx.versions.filter((v) => (archivedMode ? v.archived === true : v.archived !== true))
  // アーカイブ一覧では「Version追加」を隠す（実物どおり・追加は通常一覧の操作）
  if (addButton !== null) addButton.style.display = archivedMode ? 'none' : ''

  if (archivedMode && shown.length === 0) {
    const empty = document.createElement('div')
    empty.dataset['articleUid'] = '__empty__'
    empty.style.cssText = 'padding:24px 12px;color:#888;font-size:13px;line-height:1.8'
    empty.textContent = 'アーカイブされたVersionはありません。'
    if (addButton !== null) list.insertBefore(empty, addButton)
    else list.append(empty)
    return
  }

  for (const version of shown) {
    const isCurrent = version.uid === ctx.currentUid
    const card = buildVersionCardEl(version, isCurrent)
    if (archivedMode) wireArchivedCard(ctx, card, version)
    else wireVersionCard(ctx, card, version)
    if (addButton !== null) list.insertBefore(card, addButton)
    else list.append(card)
  }
  // 通常モードのみ: カード一覧末尾に「さらに読み込む」を挿入
  if (!archivedMode) {
    const loadMore = document.createElement('div')
    loadMore.className = 'sb-vc-load-more'
    const plus = document.createElement('span')
    plus.textContent = '+'
    plus.style.cssText = 'font-size:16px;font-weight:700;color:#999'
    const label = document.createElement('span')
    label.textContent = 'Versionを追加'
    label.style.cssText = 'font-size:13px;color:#666'
    loadMore.append(plus, label)
    loadMore.addEventListener('click', async () => {
      try {
        await saveHtml(ctx)
        const { version } = await api.addVersion(ctx.articleUid)
        ctx.versions = [...ctx.versions, version]
        toast(`${version.name} を追加しました`)
        loadVersion(ctx, version.uid)
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    })
    list.append(loadMore)
  }
  applySelectionMode(ctx, list)
}
/** Versionパネル上部（選択モードでは「キャンセル / アーカイブする」を差し込む） */
const ARTICLES_TOP = '[class*="_abTestArticlesTop"]'
const CARD_CONTENT = '[class*="_abTestArticleContent"]'
/**
 * 「選択してアーカイブする」モードの見た目と挙動（指示⑮）。
 * 実物どおり: 上部を「キャンセル / アーカイブする」に、各カードにチェックボックスを足す。
 * 通常ヘッダ（Version▼等）は innerHTML を壊さず display で退避し、配線を失わない。
 * アーカイブは配信割合1以上を1件は残すサーバーガードが効く。
 */
function applySelectionMode(ctx: EditorContext, list: HTMLElement): void {
  const top = ctx.root.querySelector<HTMLElement>(ARTICLES_TOP)
  // 前回の選択ヘッダを消し、通常ヘッダの退避を解除する
  ctx.root.querySelector('[data-clone-selheader]')?.remove()
  if (top !== null) {
    for (const child of [...top.children]) (child as HTMLElement).style.removeProperty('display')
  }
  if (!ctx.selectionMode || top === null) return

  // 通常ヘッダを退避（配線は残る）し、選択ヘッダを差し込む
  for (const child of [...top.children]) (child as HTMLElement).style.display = 'none'
  const selHeader = document.createElement('div')
  selHeader.setAttribute('data-clone-selheader', '')
  selHeader.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;font-size:13px'
  selHeader.innerHTML =
    '<div data-clone-sel-cancel style="cursor:pointer;color:var(--sb-accent, #0091FF)">キャンセル</div>' +
    '<div data-clone-sel-bulk style="cursor:pointer;color:#bbb;pointer-events:none">アーカイブする</div>'
  top.prepend(selHeader)

  const bulk = selHeader.querySelector<HTMLElement>('[data-clone-sel-bulk]')
  selHeader.querySelector<HTMLElement>('[data-clone-sel-cancel]')?.addEventListener('click', () => {
    ctx.selectionMode = false
    renderVersionList(ctx)
  })

  const selected = new Set<string>()
  const syncBulk = (): void => {
    if (bulk === null) return
    const on = selected.size > 0
    bulk.style.color = on ? '#E5573F' : '#bbb'
    bulk.style.pointerEvents = on ? 'auto' : 'none'
  }
  for (const card of list.querySelectorAll<HTMLElement>(HOOK.versionRow)) {
    const uid = card.dataset['articleUid']
    const content = card.querySelector<HTMLElement>(CARD_CONTENT)
    if (uid === undefined || content === null) continue
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.setAttribute('data-test', 'ArticleList-ArticleCheckBox')
    checkbox.value = uid
    checkbox.style.cssText = 'margin-right:8px;cursor:pointer'
    content.prepend(checkbox)
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(uid)
      else selected.delete(uid)
      syncBulk()
    })
  }
  bulk?.addEventListener('click', () => {
    if (selected.size > 0) void bulkArchive(ctx, [...selected])
  })
}
/** 選択したVersionをまとめてアーカイブ（配信割合1以上を1件残すガードは各リクエストで効く） */
async function bulkArchive(ctx: EditorContext, uids: readonly string[]): Promise<void> {
  let failed = 0
  for (const uid of uids) {
    try {
      const { version } = await api.archiveVersion(uid)
      ctx.versions = ctx.versions.map((v) => (v.uid === version.uid ? version : v))
    } catch {
      failed += 1
    }
  }
  ctx.selectionMode = false
  const archived = uids.length - failed
  toast(
    failed > 0
      ? `${archived}件アーカイブ（${failed}件は配信割合1以上を残すため不可）`
      : `${archived}件アーカイブしました`,
  )
  const next = ctx.versions.find((v) => v.archived !== true)
  if (next !== undefined) loadVersion(ctx, next.uid)
  else renderVersionList(ctx)
}
/** アーカイブ一覧のカード: 名前/割合を表示し、「復元」でアーカイブ解除して通常一覧へ戻す（指示⑮） */
function wireArchivedCard(ctx: EditorContext, card: HTMLElement, version: Version): void {
  card.dataset['articleUid'] = version.uid
  card.setAttribute('data-id', String(version.id))
  card.querySelector<HTMLElement>(HOOK.currentVersion)?.classList.remove(ACTIVE_CARD_CLASS)
  const name = card.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = card.querySelector<HTMLInputElement>(HOOK.ratio)
  if (name !== null) {
    name.value = version.name
    name.readOnly = true
  }
  if (ratio !== null) {
    ratio.value = String(version.distribution_ratio)
    ratio.readOnly = true
  }
  // 「…」トリガーは隠し、更新ボタンを「復元」に置き換える
  card.querySelector<HTMLElement>(DOTS_MENU_TRIGGER)?.style.setProperty('display', 'none')
  const restore = findUpdateButton(card)
  if (restore !== null) {
    restore.textContent = '復元'
    restore.addEventListener('click', (event) => {
      event.stopPropagation()
      void api.unarchiveVersion(version.uid).then((res) => {
        ctx.versions = ctx.versions.map((v) => (v.uid === version.uid ? res.version : v))
        toast(`${res.version.name} を復元しました`)
        ctx.listMode = 'active'
        setVersionListMode(ctx.root, 'active')
        loadVersion(ctx, res.version.uid)
      })
    })
  }
}
/** 1枚のVersionカードに操作（名前/配信割合/更新/「…」/クリック切替）を配線する */
export function wireVersionCard(ctx: EditorContext, card: HTMLElement, version: Version): void {
  // このカードが表す最新のVersion（保存のたびに新しいオブジェクトへ差し替える＝イミュータブル・§12）。
  let model = version
  const isCurrent = model.uid === ctx.currentUid

  const name = card.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = card.querySelector<HTMLInputElement>(HOOK.ratio)

  // 指示㉘: 非選択カードでは名前入力のクリックをカードへ通す（pointer-events:none）。
  // 名前編集は切替後に行う（実物と同じ「まず選択」動線）。
  if (name !== null && !isCurrent) name.style.pointerEvents = 'none'

  // 表示用の大きい数値(span)は ratioInput(非表示・値の正)の値をミラーする。
  const ratioDisplay = card.querySelector<HTMLElement>('.sb-vc-ratio-display')
  const ratioSelect = card.querySelector<HTMLSelectElement>('.sb-vc-ratio-select')
  const syncRatioDisplay = (): void => {
    if (ratio === null || ratioDisplay === null) return
    ratioDisplay.textContent = ratio.value
  }

  const save = async (): Promise<void> => {
    const nextName = name !== null && name.value !== model.name ? name.value : null
    const nextRatio =
      ratio !== null && Number(ratio.value) !== model.distribution_ratio ? Number(ratio.value) : null
    if (nextName === null && nextRatio === null) return
    try {
      let updated = model
      if (nextName !== null) {
        await api.saveVersion(model.uid, { name: nextName })
        updated = { ...updated, name: nextName }
      }
      if (nextRatio !== null) {
        const res = await api.setRatio(model.uid, nextRatio)
        updated = { ...updated, distribution_ratio: res.version.distribution_ratio }
        if (ratio !== null) ratio.value = String(res.version.distribution_ratio)
        syncRatioDisplay()
        // 2バージョン時の自動調整: サーバーが調整した他カードのUIを更新
        if (res.adjusted_siblings) {
          for (const sib of res.adjusted_siblings) {
            ctx.versions = ctx.versions.map((v) =>
              v.uid === sib.uid ? { ...v, distribution_ratio: sib.distribution_ratio } : v,
            )
            const sibCard = ctx.root.querySelector<HTMLElement>(`[data-article-uid="${sib.uid}"]`)
            if (sibCard === null) continue
            const sibRatio = sibCard.querySelector<HTMLInputElement>(HOOK.ratio)
            const sibDisplay = sibCard.querySelector<HTMLElement>('.sb-vc-ratio-display')
            const sibSelect = sibCard.querySelector<HTMLSelectElement>('.sb-vc-ratio-select')
            if (sibRatio !== null) sibRatio.value = String(sib.distribution_ratio)
            if (sibDisplay !== null) sibDisplay.textContent = String(sib.distribution_ratio)
            if (sibSelect !== null) sibSelect.value = String(sib.distribution_ratio)
          }
        }
      }
      model = updated
      ctx.versions = ctx.versions.map((v) => (v.uid === updated.uid ? updated : v))
      toast('更新しました')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  name?.addEventListener('change', () => void save())
  ratio?.addEventListener('change', () => void save())
  card.querySelector(HOOK.ratioUp)?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ratio === null) return
    ratio.value = String(Math.min(100, Number(ratio.value) + 1))
    syncRatioDisplay()
    void save()
  })
  card.querySelector(HOOK.ratioDown)?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ratio === null) return
    ratio.value = String(Math.max(0, Number(ratio.value) - 1))
    syncRatioDisplay()
    void save()
  })
  // プリセットのドロップダウン: 選択値を ratioInput に反映し、change を発火して save() に流す。
  // click は card 側の「クリックでVersion切替」に拾われるとドロップダウン操作が壊れるため止める。
  ratioSelect?.addEventListener('click', (event) => event.stopPropagation())
  ratioSelect?.addEventListener('change', () => {
    if (ratio === null || ratioSelect === null) return
    ratio.value = ratioSelect.value
    syncRatioDisplay()
    ratio.dispatchEvent(new Event('change'))
  })
  // 指示151: 数値をダブルクリックすると、その場で直接入力できる（0〜100にクランプ、Enter/離脱で確定）。
  if (ratioDisplay !== null && ratio !== null) {
    ratioDisplay.style.cursor = 'text'
    ratioDisplay.title = 'ダブルクリックで直接入力'
    ratioDisplay.addEventListener('dblclick', (event) => {
      event.stopPropagation()
      ratioDisplay.contentEditable = 'true'
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ratioDisplay)
      sel?.removeAllRanges()
      sel?.addRange(range)
      ratioDisplay.focus()
    })
    ratioDisplay.addEventListener('click', (event) => {
      if (ratioDisplay.isContentEditable) event.stopPropagation()
    })
    const commitRatioEdit = (): void => {
      if (!ratioDisplay.isContentEditable) return
      ratioDisplay.contentEditable = 'false'
      const n = Math.max(0, Math.min(100, parseInt(ratioDisplay.textContent ?? '', 10) || 0))
      ratio.value = String(n)
      syncRatioDisplay()
      void save()
    }
    ratioDisplay.addEventListener('blur', commitRatioEdit)
    ratioDisplay.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitRatioEdit() // blur に頼らずその場で確定（環境差で blur が発火しないことがある）
        ratioDisplay.blur()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        ratioDisplay.contentEditable = 'false'
        syncRatioDisplay()
        ratioDisplay.blur()
      }
    })
  }
  // 保存ボタンの配線
  const saveBtn = findUpdateButton(card)
  if (saveBtn !== null) {
    saveBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      void save()
    })
  }

  // 選択モードでは「…」を隠し、カードクリックでの切替もしない（チェックボックス操作のみ）。
  if (ctx.selectionMode) {
    card.querySelector<HTMLElement>(DOTS_MENU_TRIGGER)?.style.setProperty('display', 'none')
  }

  // カードのクリックでVersionを切り替える（入力欄・ボタン・スピナー・「…」上は除く）。
  card.style.cursor = 'pointer'
  card.addEventListener('click', (event) => {
    if (ctx.selectionMode) return
    const target = event.target as HTMLElement
    if (target.closest('input, button, ._articleButtons_1xibh_160') !== null) return
    if (target.closest(HOOK.ratioUp) !== null || target.closest(HOOK.ratioDown) !== null) return
    if (model.uid === ctx.currentUid) return
    void saveHtml(ctx).then(() => loadVersion(ctx, model.uid))
  })

  // このカードの「…」メニューは**このVersion**を対象にする。
  mountVersionDotsMenu(card, {
    abTestUid: ctx.abTestUid,
    getCurrentVersion: () => model,
    onDuplicated: (created) => {
      ctx.versions = [...ctx.versions, created]
      // 追加分のカードが下に増える。複製先へ切り替える。
      loadVersion(ctx, created.uid)
    },
    onArchived: (archived) => {
      ctx.versions = ctx.versions.map((v) =>
        v.uid === archived.uid ? { ...v, archived: true } : v,
      )
      const next = ctx.versions.find((v) => v.archived !== true)
      if (next !== undefined) loadVersion(ctx, next.uid)
      else renderVersionList(ctx)
    },
    onDeleted: (deleted) => {
      // 一覧から取り除き、残りの先頭（非アーカイブ）へ切り替える。
      ctx.versions = ctx.versions.filter((v) => v.uid !== deleted.uid)
      const next = ctx.versions.find((v) => v.archived !== true) ?? ctx.versions[0]
      if (next !== undefined) loadVersion(ctx, next.uid)
      else renderVersionList(ctx)
    },
    onSelectArchiveMode: () => {
      ctx.selectionMode = true
      renderVersionList(ctx)
    },
  })
}
/** カード内の保存ボタンを探す（data属性→文言フォールバック） */
export function findUpdateButton(card: HTMLElement): HTMLElement | null {
  // data-save-btn 属性で探す（指示62で付与）
  const marked = card.querySelector<HTMLElement>('[data-save-btn]')
  if (marked !== null) return marked
  // フォールバック: 旧テキスト「更新」で探す（初回配線前）
  const buttons = card.querySelectorAll<HTMLElement>('._articleButtons_1xibh_160 button')
  for (const button of buttons) {
    if ((button.textContent ?? '').trim().startsWith('更新')) return button
  }
  return null
}
export async function saveHtml(ctx: EditorContext): Promise<void> {
  if (ctx.currentUid === '') return
  const html = buildFullHtml(ctx)
  const v = ctx.versions.find((x) => x.uid === ctx.currentUid)
  // 🚨データ損失防止: いま中身のあるVersionを「空」で上書きしない。
  const bodyOnly = splitHeaderFromHtml(html).body
  if (v !== undefined && isEffectivelyEmptyHtml(bodyOnly) && !isEffectivelyEmptyHtml(splitHeaderFromHtml(v.html).body)) {
    console.warn(
      '[editor] 空の本文で既存Versionを上書きしようとしたため保存を中止しました:',
      ctx.currentUid,
    )
    return
  }
  await api.saveVersion(ctx.currentUid, { html })
  if (v !== undefined) v.html = html
}
