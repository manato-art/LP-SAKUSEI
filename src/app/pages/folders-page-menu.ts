/**
 * ページ行の「···」メニュー（2026-09-24・folders-page-list.ts から分離）。
 *
 * 以前は フォルダ移動 / 別フォルダへ複製 / beyondページ複製 が「未実装」のトーストを出すだけで、
 * お気に入りは「フォルダ単位です」と断るだけ、「ステータスを終了にする」はサーバーが黙って捨てていた。
 *
 *   フォルダ移動       … 別のフォルダ（または「フォルダなし」）へ移す
 *   別フォルダへ複製   … 別のフォルダ（または「フォルダなし」）に写しを作る
 *   beyondページ複製  … 同じフォルダに写しを作る（数字は写さない）
 *   ステータスを終了にする … 確認してから。配信ステータスは配信を止めない（記録と絞り込み用）
 *   beyondページを削除 … 配信URLが開けなくなることを書いて、赤い確認を出してから
 *
 * お気に入りは項目ごと外した（お気に入りはフォルダに付けるもので、ページには無い）。
 */
import type { AbTest } from '../api.ts'
import { pageListApi } from '../api-page-list.ts'
import { chooseCard, confirmCard } from '../dialog.ts'
import { T, el, toast } from '../ui.ts'
import { UNFILED_FOLDER_NAME } from '../../shared/unfiled-folder.ts'
import type { PageContext } from './folders-shared.ts'
import { deliveryUrlFor } from './basic-info-form.ts'

/** 保存したあと、一覧をサーバーの値で描き直す（絞り込み・並び・検索はそのまま残る） */
function redrawList(): void {
  dispatchEvent(new HashChangeEvent('hashchange'))
}

const UNFILED_CHOICE = 'unfiled'

/** 行き先のフォルダを選ぶ。いまのフォルダは出さない。取り消しは undefined */
async function chooseFolder(
  title: string,
  message: string,
  abTest: AbTest,
  context: PageContext,
): Promise<number | null | undefined> {
  const options = [
    ...context.folders
      .filter((f) => f.id !== abTest.folder_id)
      .map((f) => ({ value: String(f.id), label: f.name })),
    ...(abTest.folder_id === null
      ? []
      : [{ value: UNFILED_CHOICE, label: UNFILED_FOLDER_NAME, hint: 'どのフォルダにも入れない' }]),
  ]
  if (options.length === 0) {
    toast('ほかにフォルダがありません。先にフォルダを作ってください', 'error')
    return undefined
  }
  const picked = await chooseCard({ title, message, options })
  if (picked === null) return undefined
  return picked === UNFILED_CHOICE ? null : Number(picked)
}

function folderName(folderId: number | null, context: PageContext): string {
  if (folderId === null) return UNFILED_FOLDER_NAME
  return context.folders.find((f) => f.id === folderId)?.name ?? 'フォルダ'
}

async function moveToFolder(abTest: AbTest, context: PageContext): Promise<void> {
  const target = await chooseFolder('フォルダ移動', `「${abTest.title}」をどのフォルダへ移しますか？`, abTest, context)
  if (target === undefined) return
  try {
    await pageListApi.move(abTest.uid, target)
    toast(`「${folderName(target, context)}」へ移しました`)
    redrawList()
  } catch (error) {
    toast(`移せませんでした: ${(error as Error).message}`, 'error')
  }
}

async function duplicate(abTest: AbTest, context: PageContext, toOtherFolder: boolean): Promise<void> {
  const target = toOtherFolder
    ? await chooseFolder(
        '別フォルダへ複製',
        `「${abTest.title}」の写しをどのフォルダに作りますか？（PV・CVなどの数字は写しません）`,
        abTest,
        context,
      )
    : abTest.folder_id
  if (target === undefined) return
  try {
    const { ab_test } = await pageListApi.duplicate(abTest.uid, target)
    toast(`「${ab_test.title}」を${toOtherFolder ? `「${folderName(target, context)}」に` : ''}作りました`)
    redrawList()
  } catch (error) {
    toast(`複製できませんでした: ${(error as Error).message}`, 'error')
  }
}

async function finishStatus(abTest: AbTest): Promise<void> {
  const ok = await confirmCard({
    title: '配信ステータスを終了にする',
    message: `「${abTest.title}」の配信ステータスを「終了」にします。`,
    detail: '配信ステータスは記録と一覧の絞り込みに使うもので、配信は止まりません（LPはこれまでどおり表示されます）。',
    submitLabel: '終了にする',
  })
  if (!ok) return
  try {
    await pageListApi.setStatus(abTest.uid, 'finished')
    toast('配信ステータスを終了にしました')
    redrawList()
  } catch (error) {
    toast(`配信ステータスを変えられませんでした: ${(error as Error).message}`, 'error')
  }
}

async function removePage(abTest: AbTest, context: PageContext): Promise<void> {
  const url = deliveryUrlFor(context.folder?.domain, location.origin, abTest.uid) ?? `${location.origin}/lp/${abTest.uid}`
  const ok = await confirmCard({
    title: 'beyondページを削除',
    message: `「${abTest.title}」を削除します。`,
    detail:
      `配信URL（${url}）は開けなくなります。広告のリンク先にしている場合、その広告からは表示されなくなります。` +
      'Version・ステップ・ポップアップ・中間ページ・計測した数字もすべて消え、元に戻せません。',
    submitLabel: '削除する',
    danger: true,
  })
  if (!ok) return
  try {
    await pageListApi.remove(abTest.uid)
    toast(`「${abTest.title}」を削除しました`)
    redrawList()
  } catch (error) {
    toast(`削除できませんでした: ${(error as Error).message}`, 'error')
  }
}

let pageMoreMenuEl: HTMLElement | null = null

export function openPageMoreMenu(anchor: HTMLElement, abTest: AbTest, context: PageContext): void {
  if (pageMoreMenuEl !== null) {
    pageMoreMenuEl.remove()
    pageMoreMenuEl = null
    return
  }

  const menu = el('div', {
    style: [
      'position:fixed;z-index:9999',
      `background:${T.surface};border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.15)',
      'min-width:180px;padding:4px 0',
      `font-family:${T.font};font-size:13px`,
    ].join(';'),
  })
  menu.setAttribute('role', 'menu')

  const items: { label: string; danger?: boolean; action: () => void }[] = [
    { label: 'フォルダ移動', action: () => void moveToFolder(abTest, context) },
    { label: '別フォルダへ複製', action: () => void duplicate(abTest, context, true) },
    { label: 'beyondページ複製', action: () => void duplicate(abTest, context, false) },
    ...(abTest.ad_status === 'finished'
      ? []
      : [{ label: 'ステータスを終了にする', action: () => void finishStatus(abTest) }]),
    { label: 'beyondページを削除', danger: true, action: () => void removePage(abTest, context) },
  ]

  for (const item of items) {
    const row = el('div', {
      text: item.label,
      style: `padding:10px 16px;cursor:pointer;color:${item.danger === true ? '#D93025' : T.text};white-space:nowrap`,
    })
    row.setAttribute('role', 'menuitem')
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,0,0,.04)' })
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })
    row.addEventListener('click', (e) => {
      e.stopPropagation()
      menu.remove()
      pageMoreMenuEl = null
      item.action()
    })
    menu.append(row)
  }

  const rect = anchor.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.right = `${window.innerWidth - rect.right}px`
  document.body.append(menu)
  pageMoreMenuEl = menu

  requestAnimationFrame(() => {
    const close = (): void => {
      menu.remove()
      if (pageMoreMenuEl === menu) pageMoreMenuEl = null
      document.removeEventListener('click', close)
    }
    document.addEventListener('click', close)
  })
}
