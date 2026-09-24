/**
 * ステップの追加モーダル（下部バーの「+」＝青丸・企画書 §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** モーダル本体は採取した実DOM
 * `fragments/ab_tests__UID__articles__step-add-modal.portals.html`（ReactModal）を
 * そのまま土台にし、**挙動だけ**を後付けする。見た目は採取済み実CSS
 * `/clean/ab_tests__UID__articles/step-add-modal/cssom.css`（index.html が読み込む）が担保する。
 *
 * トリガーは下部バーの「+」ボタン（`_btnNewFunnel_rugej_13`・実DOMで確認）。
 *
 * 「作成」はモックに**ファネルステップ概念が無い**ので、押しても捏造せず未実装トーストにする。
 * キャンセル／背景／ESC で閉じる。カラー選択とラジオは採取物のマークアップのまま動かす。
 */
import rawModal from '../fragments/ab_tests__UID__articles__step-add-modal.portals.html?raw'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

/** 採取物の目印（実物のクラス／文言。書き換えていない） */
export const STEP_ADD_HOOK = {
  /** トリガー（下部バーの「+」） */
  trigger: '._btnNewFunnel_rugej_13',
  /** モーダル本体 */
  overlay: '.ReactModal__Overlay',
  /** カラー見本（クリックで active を移す） */
  colorSwatch: '._colorList_rugej_277',
  /** 選択中の見本に付くクラス */
  colorActive: '_active_rugej_66',
  /** ボタン文言 */
  cancel: 'キャンセル',
  create: '作成',
  /** ボタンの当たり判定 */
  button: '[class*="_btn_1bcs1_2"]',
} as const

/** 採取物のカラー見本（background-color の並び・実物のとおり） */
export const STEP_COLORS: readonly string[] = [
  'rgb(0, 0, 0)',
  'rgb(98, 54, 255)',
  'rgb(50, 197, 255)',
  'rgb(109, 212, 0)',
  'rgb(247, 181, 0)',
  'rgb(250, 116, 0)',
  'rgb(255, 0, 0)',
]

let isOpen = false

export interface StepAddDeps {
  /** 「作成」で新しいステップ（記事）を作る。name はモーダルの「ステップ名」 */
  /** color は選んだ見本の色（#rrggbb・無ければ空）。以前は選んでも送らず捨てていた（2026-09-24） */
  onCreate: (name: string, color: string) => Promise<void>
}

/**
 * 下部バーの「+」にステップ追加モーダルを配線する。
 * 土台にトリガーが居ることが前提（居なければ何も配線しない）。
 */
export function mountStepAddModal(root: HTMLElement, deps: StepAddDeps): void {
  const trigger = root.querySelector<HTMLElement>(STEP_ADD_HOOK.trigger)
  if (trigger === null) {
    console.warn('[step-add-modal] トリガー', STEP_ADD_HOOK.trigger, 'が土台に見つかりませんでした')
    return
  }
  if (trigger.dataset['cloneStepAddWired'] === 'true') return
  trigger.dataset['cloneStepAddWired'] = 'true'
  trigger.style.cursor = 'pointer'
  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    open(deps)
  })
}

function open(deps: StepAddDeps): void {
  if (isOpen) return
  const portal = openPortal(rawModal, STEP_ADD_HOOK.overlay, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('ステップ追加のマークアップが壊れています', 'error')
    return
  }
  isOpen = true

  bindBackdropClose(portal.root, portal.close)

  // カラー見本の選択（active クラスを移す・採取物のクラスだけ使う）
  const swatches = [...portal.root.querySelectorAll<HTMLElement>(STEP_ADD_HOOK.colorSwatch)]
  for (const swatch of swatches) {
    swatch.style.cursor = 'pointer'
    swatch.addEventListener('click', () => {
      for (const other of swatches) other.classList.remove(STEP_ADD_HOOK.colorActive)
      swatch.classList.add(STEP_ADD_HOOK.colorActive)
    })
  }

  const cancel = findByExactText(portal.root, STEP_ADD_HOOK.button, STEP_ADD_HOOK.cancel)
  cancel?.addEventListener('click', () => portal.close())

  const nameInput = portal.root.querySelector<HTMLInputElement>('input[name="name"]')
  const create = findByExactText(portal.root, STEP_ADD_HOOK.button, STEP_ADD_HOOK.create)
  create?.addEventListener('click', () => {
    const name = (nameInput?.value ?? '').trim() || '無題のステップ'
    const chosen = swatches.find((swatch) => swatch.classList.contains(STEP_ADD_HOOK.colorActive))
    const color = rgbToHex(chosen?.style.backgroundColor ?? '')
    portal.close()
    void deps.onCreate(name, color).catch((error: unknown) => toast((error as Error).message, 'error'))
  })
}

/** 見本の色（`rgb(98, 54, 255)`）を `#6236ff` にする。読めなければ空 */
export function rgbToHex(value: string): string {
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(value.trim())
  if (m === null) return ''
  return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`
}
