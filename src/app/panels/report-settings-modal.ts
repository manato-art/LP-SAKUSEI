/**
 * レポート設定（レポート／ヒートマップの歯車から開く「表示するパラメータ」）。
 *
 * 見た目は採取した実モーダルそのまま
 * （`capture/clean/ab_tests__UID__reports/report-settings-modal/`）。
 * 表は utm_medium / utm_source / utm_term / utm_content / utm_id / utm_campaign の6行で、
 * 列は クリエイティブ / Branch Operation / ヒートマップ / メモ。
 *
 * 採取した画面には**保存ボタンが1つも無い**（採取物にボタン要素ゼロを確認）ので、
 * 触った時点で保存する。トグルは押した瞬間、メモは離れたときに送る。
 */
import rawModal from '../fragments/ab_tests__UID__reports__report-settings-modal.portals.html?raw'
import { api, type ParameterScope } from '../api.ts'
import { toast } from '../ui.ts'
import { bindBackdropClose, openPortal } from './portal.ts'

const HOOK = {
  overlay: '.ReactModal__Overlay',
  close: '[class*="_closeButton_wn8sv_"]',
  row: 'tbody tr',
  nameCell: '[class*="_nameCell_"]',
  toggle: '[class*="_toggleSwitchWrapper_"]',
  memo: 'textarea[name="description"]',
} as const

/** 採取CSSにある2つの状態（`._toggleSwitchWrapper_bq5w4_1 ._unchecked_bq5w4_5` ほか） */
const CHECKED_CLASS = '_checked_bq5w4_4'
const UNCHECKED_CLASS = '_unchecked_bq5w4_5'

/** 列の並び（採取した thead の順）。メモは別扱い。 */
type ScopeColumn = 'creative' | 'branch_operation' | 'heatmap'
const COLUMNS: readonly ScopeColumn[] = ['creative', 'branch_operation', 'heatmap']

let isOpen = false

/** トグル1つの見た目を状態に合わせる（クラス名は採取CSSのものをそのまま使う） */
function paintToggle(toggle: HTMLElement, on: boolean): void {
  const inner = toggle.firstElementChild
  if (inner === null) return
  inner.classList.toggle(CHECKED_CLASS, on)
  inner.classList.toggle(UNCHECKED_CLASS, !on)
}

function readToggle(toggle: HTMLElement): boolean {
  return toggle.firstElementChild?.classList.contains(CHECKED_CLASS) === true
}

export function openReportSettingsModal(abTestUid: string): void {
  if (isOpen) return
  const portal = openPortal(rawModal, HOOK.overlay, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('レポート設定のマークアップが壊れています', 'error')
    return
  }
  isOpen = true
  bindBackdropClose(portal.root, portal.close)
  portal.root.querySelector<HTMLElement>(HOOK.close)?.addEventListener('click', () => portal.close())

  const rows = [...portal.root.querySelectorAll<HTMLElement>(HOOK.row)]
  /** 1行送る。返ってきた値で塗り直さない（押した手応えを優先し、失敗だけ知らせる） */
  const save = (patch: Partial<ParameterScope> & { name: string }): void => {
    void api.saveParameterScopes(abTestUid, [patch]).catch(() => {
      toast('レポート設定を保存できませんでした', 'error')
    })
  }

  void api
    .parameterScopes(abTestUid)
    .then(({ parameter_scopes }) => {
      for (const row of rows) {
        const name = (row.querySelector(HOOK.nameCell)?.textContent ?? '').trim()
        const saved = parameter_scopes.find((s) => s.name === name)
        if (saved === undefined) continue
        const toggles = [...row.querySelectorAll<HTMLElement>(HOOK.toggle)]
        toggles.forEach((toggle, i) => {
          const column = COLUMNS[i]
          if (column === undefined) return
          paintToggle(toggle, saved[column])
          toggle.setAttribute('style', 'cursor:pointer')
          toggle.addEventListener('click', () => {
            const next = !readToggle(toggle)
            paintToggle(toggle, next)
            save({ name, [column]: next })
          })
        })
        const memo = row.querySelector<HTMLTextAreaElement>(HOOK.memo)
        if (memo === null) continue
        memo.value = saved.description
        memo.addEventListener('blur', () => save({ name, description: memo.value }))
      }
    })
    .catch(() => {
      toast('レポート設定を読み込めませんでした', 'error')
    })
}
