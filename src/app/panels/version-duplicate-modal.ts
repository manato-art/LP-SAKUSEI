/**
 * 「Version複製」モーダル（版の「…」メニュー→「複製」で開く・企画書 §11 capture-and-rehydrate）。
 *
 * 実物は「複製」を押すと、複製個数（最大4）・リンク・head/bodyタグ・ステップの引き継ぎを選ぶ
 * ダークモーダルが出て、「複製する」で実行する。これまでのクローンは即複製していたので、
 * 採取した実モーダルを土台にして再現する。
 *
 * リンク／head&body／ステップの各オプションは、モックの複製が html/css をそのまま引き継ぐ挙動なので
 * 値は受け取るだけ（＝「引き継ぐ」相当）。複製個数だけ実際に効かせ、その回数だけ複製する。
 */
import rawModal from '../fragments/ab_tests__UID__articles__version-duplicate-modal.portals.html?raw'
import { api, type Version } from '../api.ts'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

export interface DuplicateDeps {
  getCurrentVersion: () => Version | null
  onDuplicated: (version: Version) => void
}

/**
 * 目印（採取物に実在するもの）。ダークテーマのボタンは `<button>` ではなく
 * `<div class="_btn_1bcs1_2 …">`。閉じるは data-test 属性が最も安定。
 */
const DUPLICATE_HOOK = {
  overlay: '.ReactModal__Overlay',
  button: '[class*="_btn_1bcs1_2"]',
  close: '[data-test="DuplicateModal-BtnClose"]',
  count: 'input[name="duplicateCount"]',
  submit: '複製する',
} as const

let isOpen = false

export function openDuplicateModal(deps: DuplicateDeps): void {
  if (isOpen) return
  const current = deps.getCurrentVersion()
  if (current === null) {
    toast('複製元のVersionが見つかりません', 'error')
    return
  }
  // 実物は ReactModal（ダークテーマ）。採取物には overlay/content が2重に入るので先頭だけ使う。
  const portal = openPortal(rawModal, DUPLICATE_HOOK.overlay, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('Version複製のマークアップが壊れています', 'error')
    return
  }
  isOpen = true

  // オーバーレイ（背景）クリックで閉じる
  bindBackdropClose(portal.root, portal.close)
  // ダークテーマのボタンは <div class="_btn_…">（<button> ではない）
  portal.root
    .querySelector<HTMLElement>(DUPLICATE_HOOK.close)
    ?.addEventListener('click', () => portal.close())

  const countInput = portal.root.querySelector<HTMLInputElement>(DUPLICATE_HOOK.count)
  const dupButton = findByExactText(portal.root, DUPLICATE_HOOK.button, DUPLICATE_HOOK.submit)
  dupButton?.addEventListener('click', () => {
    void runDuplicate(deps, current, countInput, portal.close)
  })
}

async function runDuplicate(
  deps: DuplicateDeps,
  current: Version,
  countInput: HTMLInputElement | null,
  close: () => void,
): Promise<void> {
  const raw = Number.parseInt(countInput?.value ?? '1', 10)
  const count = Number.isFinite(raw) ? Math.min(4, Math.max(1, raw)) : 1
  for (let i = 0; i < count; i += 1) {
    try {
      const { version } = await api.duplicateVersion(current.uid)
      deps.onDuplicated(version)
    } catch (error) {
      toast((error as Error).message, 'error')
      return
    }
  }
  toast(count === 1 ? '複製しました' : `${count}件複製しました`)
  close()
}
