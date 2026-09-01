/**
 * 中間ページ（redirect_pages）＝
 * `/folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages`（指示⑮ フロー総点検）。
 *
 * エディタ上部右の3番目のアイコン（中間ページ）から来る画面。実本体（許可経路）で
 * 「中間ページを追加」後の**詳細画面**を採取し（一覧＋設定フォーム）、土台にして挙動を付ける:
 *   - 中間ページ一覧をモックから描く（作成した分が増える）
 *   - 「中間ページを追加」→ モックに作成 → 一覧に追加して選択
 *   - 設定フォーム（中間ページ名 / リダイレクト先 / リダイレクト時間）を選んだページに束ね、
 *     「中間ページ設定を保存する」で更新
 */
import substrate from '../fragments/folders__UID__ab_tests__UID__redirect_pages__detail.html?raw'
import { api, type RedirectPage } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { applyBeyondTopBar, wireBeyondBack } from './beyond-topbar.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { wireAbTestTabs } from './tab-nav.ts'

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
} as const

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
  wireBeyondBack(root, folderUid)

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
      for (const other of left.querySelectorAll<HTMLElement>(HOOK.item)) {
        other.classList.toggle(HOOK.active, other === item)
      }
      bindForm(root, page)
    })
    if (addButton !== null) left.insertBefore(item, addButton)
    else left.append(item)
  }

  const selected = redirect_pages.find((p) => p.uid === target) ?? null
  bindForm(root, selected)
  wireSave(root, abTestUid, template)
}

/** 設定フォームを選択中の中間ページに束ねる（未選択なら空にする） */
function bindForm(root: HTMLElement, page: RedirectPage | null): void {
  const name = root.querySelector<HTMLInputElement>(HOOK.nameInput)
  const url = root.querySelector<HTMLInputElement>(HOOK.urlInput)
  const time = root.querySelector<HTMLInputElement>(HOOK.timeInput)
  if (name !== null) name.value = page?.name ?? ''
  if (url !== null) url.value = page?.url ?? ''
  if (time !== null) time.value = String(page?.redirect_time ?? 0.4)
  root.dataset['cloneSelectedRedirect'] = page?.uid ?? ''
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
    void api
      .updateRedirectPage(uid, { name, url, redirect_time: Number.isFinite(time) ? time : 0.4 })
      .then(() => renderList(root, abTestUid, template, uid))
      .then(() => toast('中間ページ設定を保存しました'))
      .catch((error: unknown) => toast((error as Error).message, 'error'))
  })
}

/** 雛形が採れないときの最小の一覧項目 */
function fallbackItem(): HTMLElement {
  const item = document.createElement('div')
  item.className = '_redirectPage_1tjuv_1'
  item.innerHTML = '<div class="_title_1tjuv_23"></div>'
  return item
}
