/**
 * 「別のbeyondページへのVersion複製」モーダル（版の「…」→「別のbeyondページに複製」・指示⑮）。
 *
 * 採取した実モーダル（ReactModalダーク・複製先beyondページ選択＋リンク/head&body/ステップの引き継ぎ）を
 * 土台にし、複製先セレクトを**モックの実beyondページ**で埋め直す。「複製する」で対象記事へVersionを複製。
 */
import rawModal from '../fragments/ab_tests__UID__articles__duplicate-to-other-modal.portals.html?raw'
import { api, type Version } from '../api.ts'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

export interface DuplicateToOtherDeps {
  /** いま開いている beyondページ（複製元）。複製先候補から除く */
  abTestUid: string
  getCurrentVersion: () => Version | null
  /** 複製後の後処理（任意・同ページ内でないので通常は一覧再取得は不要） */
  onDuplicated?: (version: Version) => void
}

const HOOK = {
  overlay: '.ReactModal__Overlay',
  close: '[data-test="DuplicateToOtherModal-BtnClose"]',
  destination: '[data-test="DuplicateToOtherModal-DestinationAbTestUidSelect"]',
  button: '[class*="_btn_1bcs1_2"]',
  submit: '複製する',
} as const

let isOpen = false

export function openDuplicateToOtherModal(deps: DuplicateToOtherDeps): void {
  if (isOpen) return
  const current = deps.getCurrentVersion()
  if (current === null) {
    toast('複製元のVersionが見つかりません', 'error')
    return
  }
  const portal = openPortal(rawModal, HOOK.overlay, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('別ページ複製のマークアップが壊れています', 'error')
    return
  }
  isOpen = true

  const backdrop = portal.root.querySelector<HTMLElement>('.MuiBackdrop-root')
  if (backdrop !== null) bindBackdropClose(backdrop, portal.close)
  else bindBackdropClose(portal.root, portal.close)
  portal.root.querySelector<HTMLElement>(HOOK.close)?.addEventListener('click', () => portal.close())

  const select = portal.root.querySelector<HTMLSelectElement>(HOOK.destination)
  void fillDestinations(select, deps.abTestUid)

  const submit = findByExactText(portal.root, HOOK.button, HOOK.submit)
  submit?.addEventListener('click', () => {
    void runDuplicateToOther(deps, current, select, portal.close)
  })
}

/** 複製先セレクトを、モックの他beyondページで埋め直す（自分自身は除く） */
async function fillDestinations(select: HTMLSelectElement | null, selfUid: string): Promise<void> {
  if (select === null) return
  try {
    const { ab_tests } = await api.abTests()
    const others = ab_tests.filter((t) => t.uid !== selfUid)
    select.innerHTML = ''
    const head = document.createElement('option')
    head.value = ''
    head.textContent = '選択してください'
    select.append(head)
    for (const test of others) {
      const option = document.createElement('option')
      option.value = test.uid
      option.textContent = test.title
      select.append(option)
    }
    if (others.length === 0) head.textContent = '複製先のbeyondページがありません'
  } catch {
    // 取得失敗時は採取物のまま（複製時に検証する）
  }
}

async function runDuplicateToOther(
  deps: DuplicateToOtherDeps,
  current: Version,
  select: HTMLSelectElement | null,
  close: () => void,
): Promise<void> {
  const targetAbTestUid = select?.value ?? ''
  if (targetAbTestUid === '') {
    toast('複製先のbeyondページを選んでください', 'error')
    return
  }
  try {
    const { articles } = await api.articles(targetAbTestUid)
    const articleUid = articles[0]?.uid
    if (articleUid === undefined) {
      toast('複製先のbeyondページに記事がありません', 'error')
      return
    }
    const { version } = await api.duplicateVersionToArticle(current.uid, articleUid)
    deps.onDuplicated?.(version)
    const label = select?.selectedOptions[0]?.textContent ?? '別ページ'
    toast(`${label} へ複製しました`)
    close()
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}
