/**
 * 中間ページ（redirect_pages）＝
 * `/folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages`（指示⑮ フロー総点検）。
 *
 * エディタ上部右の3番目のアイコン（中間ページ）から来る画面。実本体（許可経路）で
 * 「中間ページを追加」後の**詳細画面**を採取し（一覧＋設定フォーム）、土台にして挙動を付ける:
 *   - 中間ページ一覧をモックから描く（作成した分が増える）
 *   - 「中間ページを追加」→ モックに作成 → 一覧に追加して選択
 *   - 設定フォーム（中間ページ名 / リファラー設定 / リダイレクト先 / リダイレクト時間）を選んだページに束ね、
 *     「中間ページ設定を保存する」で更新
 *   - 中間ページリンクのコピー / 中間ページの削除
 */
import substrate from '../fragments/folders__UID__ab_tests__UID__redirect_pages__detail.html?raw'
import { api, type RedirectPage, type RedirectPageTag } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { applyBeyondTopBar, wireBeyondBack } from './beyond-topbar.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { applyLightTheme } from './report-dom.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'

const HOOK = {
  left: '[class*="_left_1tjuv"]',
  item: '[class*="_redirectPage_1tjuv_1"]',
  itemTitle: '[class*="_title_1tjuv"]',
  addButton: '[class*="_newRedirectPage_1tjuv"]',
  active: '_active_1tjuv_41',
  save: '[class*="_save_1tjuv"]',
  nameInput: 'input[name="name"]',
  urlInput: 'input[name="redirect_url"]',
  timeInput: 'input[name="redirect_time"]',
  referrerSelect: 'select[name="referrer_type"]',
  copyButton: '[class*="_copy_ga7j8"]',
  linkInput: '[class*="_wrapper_ga7j8"] input[readonly]',
  deleteButton: '[class*="_destroy_1tjuv"]',
  /** 「タグ発火条件設定」の説明（前方一致のURL例を、選んでいる中間ページのURLにする） */
  description: '[class*="_description_1tjuv"]',
  /** 中間ページタグ設定の「HEAD」「BODY」 */
  tagChip: '[class*="_tagWrapper_1tjuv"] [class*="_tag_dolrq"]',
} as const

/** 採取物の「前方一致で発火させる場合 https://…」の書き出し */
const PREFIX_MATCH_LABEL = '前方一致で発火させる場合 '

export async function renderRedirectPages(
  container: HTMLElement,
  ids: { folderUid: string; abTestUid: string },
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  const [{ ab_test }, { folders }] = await Promise.all([api.abTest(ids.abTestUid), api.folders()])
  if (generation !== undefined && isStale(generation)) return

  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null
  const folderUid = folder?.uid ?? ids.folderUid

  container.style.cssText = 'flex:1;min-width:0'
  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(substrate)
  container.append(root)

  applyBeyondTopBar(root, {
    pageName: ab_test.title,
    folderName: folder?.name ?? '',
    adStatus: ab_test.ad_status,
  })
  wireBeyondNavAnchors(root, { abTestUid: ids.abTestUid, folderUid })
  wireAbTestTabs(root, ids.abTestUid, folderUid)
  setupHorizTabs(root, 'redirect', { abTestUid: ids.abTestUid, folderUid })
  // 指示86: navWrapper の親に flex-column を設定し、採取CSSのレイアウト干渉を防ぐ
  const navWrapper86 = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
  if (navWrapper86?.parentElement !== null && navWrapper86?.parentElement !== undefined) {
    navWrapper86.parentElement.style.display = 'flex'
    navWrapper86.parentElement.style.flexDirection = 'column'
    navWrapper86.parentElement.style.background = 'var(--sb-c-ffffff, #FFFFFF)'
  }
  setupBreadcrumb(root, folder?.name ?? '', ab_test.title, folder?.uid)
  wireBeyondBack(root, folderUid)
  applyLightTheme(root)
  // 指示116: 中間ページの input/select はテーマクラスが無い Emotion 直指定なので個別に白基調化
  // _field_1tjuv_135 が !important なので setProperty で上書きする
  for (const el of root.querySelectorAll<HTMLElement>(
    'input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), select',
  )) {
    el.style.setProperty('background', '#f5f5f5', 'important')
    el.style.setProperty('background-color', '#f5f5f5', 'important')
    el.style.setProperty('color', '#333', 'important')
    el.style.setProperty('border', '1px solid #d0d0d0', 'important')
  }
  // 指示119: CSS Module のダーク背景を白基調に上書き
  applyRedirectPagesWhiteTheme(root)

  // 一覧項目の雛形を控える（採取物の1件目をクリーンにクローン）
  const template = root.querySelector<HTMLElement>(HOOK.item)?.cloneNode(true) as HTMLElement | undefined
  await renderList(root, ids.abTestUid, template ?? null)

  root.querySelector<HTMLElement>(HOOK.addButton)?.addEventListener('click', () => {
    void addAndSelect(root, ids.abTestUid, template ?? null)
  })
}

async function addAndSelect(
  root: HTMLElement,
  abTestUid: string,
  template: HTMLElement | null,
): Promise<void> {
  try {
    const { redirect_page } = await api.addRedirectPage(abTestUid)
    await renderList(root, abTestUid, template, redirect_page.uid)
    toast('中間ページを追加しました')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

/** 一覧を描き直し、selectedUid（無ければ先頭）を選択状態にする */
async function renderList(
  root: HTMLElement,
  abTestUid: string,
  template: HTMLElement | null,
  selectedUid?: string,
): Promise<void> {
  const left = root.querySelector<HTMLElement>(HOOK.left)
  const addButton = root.querySelector<HTMLElement>(HOOK.addButton)
  if (left === null) return
  for (const item of left.querySelectorAll<HTMLElement>(HOOK.item)) item.remove()

  const { redirect_pages } = await api.redirectPages(abTestUid)
  const target = selectedUid ?? redirect_pages[0]?.uid

  for (const page of redirect_pages) {
    const item = (template?.cloneNode(true) as HTMLElement | undefined) ?? fallbackItem()
    item.dataset['redirectUid'] = page.uid
    const title = item.querySelector<HTMLElement>(HOOK.itemTitle)
    if (title !== null) title.textContent = page.name
    item.classList.toggle(HOOK.active, page.uid === target)
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      // 選び直すたびに一覧を取り直す（タグを足したり消したりしたあとでも、最新のタグカードを出す）
      void renderList(root, abTestUid, template, page.uid)
    })
    if (addButton !== null) left.insertBefore(item, addButton)
    else left.append(item)
  }

  const selected = redirect_pages.find((p) => p.uid === target) ?? null
  bindForm(root, selected)
  wireSave(root, abTestUid, template)
  wireDelete(root, abTestUid, template)
  wireCopyLink(root)
  wireTagChips(root)
}

/** 設定フォームを選択中の中間ページに束ねる（未選択なら空にする） */
function bindForm(root: HTMLElement, page: RedirectPage | null): void {
  const name = root.querySelector<HTMLInputElement>(HOOK.nameInput)
  const url = root.querySelector<HTMLInputElement>(HOOK.urlInput)
  const time = root.querySelector<HTMLInputElement>(HOOK.timeInput)
  const referrer = root.querySelector<HTMLSelectElement>(HOOK.referrerSelect)
  const linkInput = root.querySelector<HTMLInputElement>(HOOK.linkInput)

  if (name !== null) name.value = page?.name ?? ''
  if (url !== null) url.value = page?.url ?? ''
  if (time !== null) time.value = String(page?.redirect_time ?? 0.4)
  if (referrer !== null) referrer.value = page?.referrer_type ?? 'version'
  root.dataset['cloneSelectedRedirect'] = page?.uid ?? ''

  // 中間ページリンク（採取物と同じ形の実パス。開くとサーバーがリダイレクト先へ移動させる）。
  // sbrp / sbrpuid はタグの発火条件に使う目印。
  if (linkInput !== null && page !== null) {
    linkInput.value = `${location.origin}/redirect_pages/${page.uid}?sbrp=true&sbrpuid=${page.uid}`
  } else if (linkInput !== null) {
    linkInput.value = ''
  }
  // 「前方一致で発火させる場合」の例は、選んでいる中間ページのURLにする（採取物のままだと架空のURLが出る）
  const prefixNote = [...root.querySelectorAll<HTMLElement>(HOOK.description)].find((el) =>
    (el.textContent ?? '').startsWith(PREFIX_MATCH_LABEL),
  )
  if (prefixNote !== undefined && page !== null) {
    prefixNote.textContent = `${PREFIX_MATCH_LABEL}${location.origin}/redirect_pages/${page.uid}`
  }
  renderTagCards(root, page)
}

function wireSave(root: HTMLElement, abTestUid: string, template: HTMLElement | null): void {
  const save = root.querySelector<HTMLElement>(HOOK.save)
  if (save === null || save.dataset['cloneSaveWired'] === 'true') return
  save.dataset['cloneSaveWired'] = 'true'
  save.style.cursor = 'pointer'
  save.addEventListener('click', () => {
    const uid = root.dataset['cloneSelectedRedirect'] ?? ''
    if (uid === '') {
      toast('中間ページを選択してください', 'error')
      return
    }
    const name = root.querySelector<HTMLInputElement>(HOOK.nameInput)?.value ?? ''
    const url = root.querySelector<HTMLInputElement>(HOOK.urlInput)?.value ?? ''
    const time = Number(root.querySelector<HTMLInputElement>(HOOK.timeInput)?.value ?? '0.4')
    const referrerType = root.querySelector<HTMLSelectElement>(HOOK.referrerSelect)?.value ?? 'version'
    void api
      .updateRedirectPage(uid, {
        name,
        url,
        redirect_time: Number.isFinite(time) ? time : 0.4,
        referrer_type: referrerType,
      })
      .then(() => renderList(root, abTestUid, template, uid))
      .then(() => toast('中間ページ設定を保存しました'))
      .catch((error: unknown) => toast((error as Error).message, 'error'))
  })
}

/**
 * 中間ページタグ設定のタグカード（2026-09-11 に SquadBeyond 本体の中間ページ設定で採取した実マークアップ）。
 * CSS は採取物の cssom.css にあるクラスをそのまま使う。
 */
const TAG_CARD = {
  card: '_tag_u9uou_1',
  titleWrapper: '_tagTitleWrapper_u9uou_7',
  title: '_tagTitle_u9uou_7',
  destroy: '_destroy_u9uou_22',
  input: '_inputText_o4ifl_1 _full_o4ifl_14 _field_1tjuv_135 ',
  textarea: '_base_1yavp_1 _full_1yavp_17 _resizeVertical_1yavp_20 _field_1tjuv_135 ',
} as const

/** 入力が止まってから保存するまでの待ち（本体も、入力するとその場で保存される） */
const TAG_SAVE_DELAY_MS = 600

type TagValues = { name: string; body: string }

/** 押した「HEAD」「BODY」がどちらか */
function chipProperty(chip: HTMLElement): 'head' | 'body' {
  return (chip.textContent ?? '').trim().toLowerCase() === 'body' ? 'body' : 'head'
}

/**
 * 入力が止まったら保存し、欄から離れたらすぐ保存する。
 * 閉じていないタグなどで保存できなかったときは、欄から離れたときにだけ知らせる（入力の途中で何度も出さない）。
 */
function tagAutosaver(pageUid: string, tag: RedirectPageTag): (values: TagValues, immediate: boolean) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let saved = JSON.stringify({ name: tag.name, body: tag.body })
  const save = (values: TagValues, notify: boolean): void => {
    const next = JSON.stringify(values)
    if (next === saved) return
    void api.updateRedirectPageTag(pageUid, tag.id, values).then(
      () => {
        saved = next
      },
      (error: unknown) => {
        if (notify) toast((error as Error).message, 'error')
      },
    )
  }
  return (values, immediate) => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (immediate) save(values, true)
    else timer = setTimeout(() => save(values, false), TAG_SAVE_DELAY_MS)
  }
}

/** タグカードを1枚作る（タグ名＋JavaScript・右上に削除）。値は value / textContent に入れ、HTMLとして解釈させない */
function createTagCard(pageUid: string, tag: RedirectPageTag): HTMLElement {
  const card = document.createElement('div')
  card.className = TAG_CARD.card
  card.dataset['tagId'] = String(tag.id)

  const titleWrapper = document.createElement('div')
  titleWrapper.className = TAG_CARD.titleWrapper
  const title = document.createElement('div')
  title.className = TAG_CARD.title
  title.textContent = tag.name
  const destroy = document.createElement('div')
  destroy.className = TAG_CARD.destroy
  titleWrapper.append(title, destroy)

  const nameLabel = document.createElement('label')
  nameLabel.textContent = 'タグ名'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.name = 'title'
  nameInput.className = TAG_CARD.input
  nameInput.placeholder = 'タグ名を入力してください'
  nameInput.value = tag.name

  const bodyLabel = document.createElement('label')
  bodyLabel.textContent = 'JavaScript'
  const bodyArea = document.createElement('textarea')
  bodyArea.name = 'body'
  bodyArea.placeholder = '<script></script>'
  bodyArea.className = TAG_CARD.textarea
  bodyArea.rows = 5
  bodyArea.value = tag.body

  const autosave = tagAutosaver(pageUid, tag)
  const values = (): TagValues => ({ name: nameInput.value, body: bodyArea.value })
  nameInput.addEventListener('input', () => {
    title.textContent = nameInput.value
    autosave(values(), false)
  })
  bodyArea.addEventListener('input', () => autosave(values(), false))
  nameInput.addEventListener('blur', () => autosave(values(), true))
  bodyArea.addEventListener('blur', () => autosave(values(), true))

  destroy.addEventListener('click', () => {
    void confirmCard({
      title: 'このタグを削除しますか？',
      message: 'この中間ページを開いたときに、このタグは動かなくなります。',
      detail: '削除すると元に戻せません。',
      submitLabel: '削除する',
      danger: true,
    }).then((ok) => {
      if (!ok) return
      void api.deleteRedirectPageTag(pageUid, tag.id).then(
        () => {
          card.remove()
          toast('タグを削除しました')
        },
        (error: unknown) => toast((error as Error).message, 'error'),
      )
    })
  })

  card.append(titleWrapper, nameLabel, nameInput, bodyLabel, bodyArea)
  return card
}

/**
 * 選んでいる中間ページのタグカードを、HEAD / BODY それぞれの下に並べ直す。
 * 同じ中間ページを描き直すとき（設定の保存・同じ項目をもう一度押す）は、今のカードを残す
 * （入力中や保存待ちの内容を、取り直した一覧の古い値で上書きしないため）。
 */
function renderTagCards(root: HTMLElement, page: RedirectPage | null): void {
  const pageUid = page?.uid ?? ''
  if (root.dataset['cloneTagCardsFor'] === pageUid) return
  root.dataset['cloneTagCardsFor'] = pageUid
  for (const old of root.querySelectorAll<HTMLElement>(`.${TAG_CARD.card}`)) old.remove()
  if (page === null) return
  for (const chip of root.querySelectorAll<HTMLElement>(HOOK.tagChip)) {
    const property = chipProperty(chip)
    for (const tag of (page.tags ?? []).filter((t) => t.document_property === property)) {
      chip.parentElement?.append(createTagCard(page.uid, tag))
    }
  }
}

/** 中間ページタグ設定の「HEAD」「BODY」を押すと、名前の無いタグを1件足してカードを出す（本体と同じ） */
function wireTagChips(root: HTMLElement): void {
  for (const chip of root.querySelectorAll<HTMLElement>(HOOK.tagChip)) {
    if (chip.dataset['cloneTagWired'] === 'true') continue
    chip.dataset['cloneTagWired'] = 'true'
    chip.addEventListener('click', () => {
      const uid = root.dataset['cloneSelectedRedirect'] ?? ''
      if (uid === '') {
        toast('中間ページを選択してください', 'error')
        return
      }
      void api.addRedirectPageTag(uid, chipProperty(chip)).then(
        ({ tag }) => {
          const card = createTagCard(uid, tag)
          chip.parentElement?.append(card)
          card.querySelector<HTMLInputElement>('input[name="title"]')?.focus()
        },
        (error: unknown) => toast((error as Error).message, 'error'),
      )
    })
  }
}

/** 中間ページリンクのコピーボタンを配線する */
function wireCopyLink(root: HTMLElement): void {
  const copyBtn = root.querySelector<HTMLElement>(HOOK.copyButton)
  if (copyBtn === null || copyBtn.dataset['cloneCopyWired'] === 'true') return
  copyBtn.dataset['cloneCopyWired'] = 'true'
  copyBtn.style.cursor = 'pointer'
  copyBtn.addEventListener('click', () => {
    const linkInput = root.querySelector<HTMLInputElement>(HOOK.linkInput)
    const url = linkInput?.value ?? ''
    if (url === '') {
      toast('コピーするリンクがありません', 'error')
      return
    }
    void navigator.clipboard?.writeText(url).then(
      () => toast('中間ページリンクをコピーしました'),
      () => toast('コピーに失敗しました', 'error'),
    )
  })
}

/** 中間ページを削除ボタンを配線する */
function wireDelete(root: HTMLElement, abTestUid: string, template: HTMLElement | null): void {
  const deleteBtn = root.querySelector<HTMLElement>(HOOK.deleteButton)
  if (deleteBtn === null || deleteBtn.dataset['cloneDeleteWired'] === 'true') return
  deleteBtn.dataset['cloneDeleteWired'] = 'true'
  deleteBtn.style.cursor = 'pointer'
  deleteBtn.addEventListener('click', () => {
    const uid = root.dataset['cloneSelectedRedirect'] ?? ''
    if (uid === '') {
      toast('中間ページを選択してください', 'error')
      return
    }
    void confirmCard({
      title: 'この中間ページを削除しますか？',
      message: 'この中間ページを経由していたリンクは、行き先が無くなります。',
      detail: '削除すると元に戻せません。',
      submitLabel: '削除する',
      danger: true,
    }).then((ok) => {
      if (!ok) return
      void api.deleteRedirectPage(uid).then(
        () => {
          toast('中間ページを削除しました')
          void renderList(root, abTestUid, template)
        },
        (err: unknown) => toast((err as Error).message, 'error'),
      )
    })
  })
}

/** 雛形が採れないときの最小の一覧項目 */
function fallbackItem(): HTMLElement {
  const item = document.createElement('div')
  item.className = '_redirectPage_1tjuv_1'
  item.innerHTML = '<div class="_title_1tjuv_23"></div>'
  return item
}

/**
 * 指示119: 中間ページの CSS Module ダーク背景を白基調にインライン上書きする。
 * Emotion css-* はなく CSS Modules の固定クラスなので applyLightTheme では変換できない。
 */
function applyRedirectPagesWhiteTheme(root: HTMLElement): void {
  // 左パネル（一覧サイドバー）
  const left = root.querySelector<HTMLElement>('[class*="_left_1tjuv"]')
  if (left !== null) {
    left.style.backgroundColor = 'var(--sb-c-f5f6f8, #F5F6F8)'
    left.style.borderRadius = '10px 0 0 10px'
  }
  // 左パネル内の各項目
  for (const item of root.querySelectorAll<HTMLElement>('[class*="_redirectPage_1tjuv_1"]')) {
    item.style.color = 'var(--sb-c-333333, #333333)'
  }
  // アクティブ項目
  for (const active of root.querySelectorAll<HTMLElement>('[class*="_active_1tjuv"]')) {
    active.style.backgroundColor = 'var(--sb-c-ffffff, #FFFFFF)'
  }
  // 右パネル（設定フォーム）
  const right = root.querySelector<HTMLElement>('[class*="_right_1tjuv"]')
  if (right !== null) {
    right.style.backgroundColor = 'var(--sb-c-ffffff, #FFFFFF)'
    right.style.color = 'var(--sb-c-333333, #333333)'
    right.style.borderRadius = '0 10px 10px 0'
    right.style.border = '1px solid #e5e5ea'
    right.style.borderLeft = 'none'
  }
  // 追加ボタン
  const addBtn = root.querySelector<HTMLElement>('[class*="_newRedirectPage_1tjuv"]')
  if (addBtn !== null) {
    addBtn.style.backgroundColor = '#fff3e0'
    addBtn.style.color = '#e68a00'
  }
  // ラベル・見出しテキスト
  for (const label of root.querySelectorAll<HTMLElement>(
    '[class*="_right_1tjuv"] label, [class*="_right_1tjuv"] p, [class*="_right_1tjuv"] h2, [class*="_right_1tjuv"] h3, [class*="_right_1tjuv"] span, [class*="_right_1tjuv"] div',
  )) {
    if (label.style.color === '') label.style.color = 'var(--sb-c-333333, #333333)'
  }
  // 保存ボタン
  const saveBtn = root.querySelector<HTMLElement>('[class*="_save_1tjuv"]')
  if (saveBtn !== null) {
    saveBtn.style.backgroundColor = '#f0960a'
    saveBtn.style.color = '#fff'
  }
  // 削除ボタン（暗赤 rgb(103,52,53) → 明赤背景に）
  const deleteBtn = root.querySelector<HTMLElement>('[class*="_destroy_1tjuv"]')
  if (deleteBtn !== null) {
    deleteBtn.style.backgroundColor = '#fce4e4'
    deleteBtn.style.color = '#d32f2f'
    deleteBtn.style.border = '1px solid #f5c6c6'
  }
  // _field_1tjuv_135 が !important なので setProperty で念押し上書き
  for (const field of root.querySelectorAll<HTMLElement>('[class*="_field_1tjuv"]')) {
    field.style.setProperty('background-color', '#f5f5f5', 'important')
    field.style.setProperty('color', '#333', 'important')
    field.style.setProperty('border', '1px solid #d0d0d0', 'important')
    field.style.setProperty('border-radius', '6px', 'important')
  }
  // セクションタイトル（h2/h3）
  for (const heading of root.querySelectorAll<HTMLElement>('[class*="_right_1tjuv"] h2, [class*="_right_1tjuv"] h3, [class*="_sectionTitle_1tjuv"]')) {
    heading.style.setProperty('color', '#333', 'important')
  }
}
