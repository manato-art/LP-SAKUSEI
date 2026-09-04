/**
 * 「Version複製」モーダル（版の「…」メニュー→「複製」で開く）。
 *
 * 指示76: 実物の最新UIに合わせたライトテーマカード。
 * - ヘッダ: キャンセル | Version複製 | 複製（青ボタン）
 * - リンク設定: ドロップダウン（【残す】全てのページ内URL）
 * - 複製数: ドロップダウン（1〜4、※最大4件まで）
 * - ✅ Versionのhead/bodyタグを引き継ぐ（チェックボックス）
 * - ✅ ステップを引き継ぐ（チェックボックス）
 *
 * リンク／head&body／ステップの各オプションは、モックの複製が html/css をそのまま引き継ぐ挙動なので
 * 値は受け取るだけ（＝「引き継ぐ」相当）。複製個数だけ実際に効かせ、その回数だけ複製する。
 */
import { api, type Version } from '../api.ts'
import { toast } from '../ui.ts'

export interface DuplicateDeps {
  getCurrentVersion: () => Version | null
  onDuplicated: (version: Version) => void
}

let isOpen = false

/** CSS を一度だけ注入する */
function injectStyles(): void {
  if (document.getElementById('sb-dup-modal-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-dup-modal-css'
  style.textContent = `
    .sb-dup-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    }
    .sb-dup-card {
      background: #fff; border-radius: 12px; width: 420px; max-width: calc(100vw - 32px);
      box-shadow: 0 4px 24px rgba(0,0,0,0.14);
      overflow: hidden;
    }
    /* ── ヘッダ ── */
    .sb-dup-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px;
    }
    .sb-dup-cancel {
      color: #666; font-size: 14px; cursor: pointer; background: none; border: none;
      padding: 0; font-family: inherit;
    }
    .sb-dup-cancel:hover { color: #333; }
    .sb-dup-title {
      font-size: 16px; font-weight: 700; color: #1a1a1a;
      position: absolute; left: 50%; transform: translateX(-50%);
    }
    .sb-dup-submit {
      background: #4A8DF8; color: #fff; font-size: 14px; font-weight: 600;
      border: none; border-radius: 8px; padding: 8px 22px; cursor: pointer;
      font-family: inherit;
    }
    .sb-dup-submit:hover { background: #3B7DE8; }
    .sb-dup-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    /* ── 区切り線 ── */
    .sb-dup-divider { height: 1px; background: #E5E5EA; margin: 0; }
    /* ── ボディ ── */
    .sb-dup-body { padding: 20px; }
    .sb-dup-field { margin-bottom: 18px; }
    .sb-dup-field:last-child { margin-bottom: 0; }
    .sb-dup-label {
      display: block; font-size: 13px; color: #8E8E93; margin-bottom: 6px;
    }
    .sb-dup-label-note { font-size: 12px; color: #AEAEB2; margin-left: 4px; }
    /* ── ドロップダウン ── */
    .sb-dup-select-wrap {
      position: relative;
    }
    .sb-dup-select {
      width: 100%; appearance: none; -webkit-appearance: none;
      background: #F2F2F7; border: none; border-radius: 10px;
      padding: 13px 40px 13px 16px; font-size: 15px; color: #1a1a1a;
      font-family: inherit; cursor: pointer; outline: none;
    }
    .sb-dup-select:focus { box-shadow: 0 0 0 2px rgba(74,141,248,0.3); }
    .sb-dup-chevron {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: #8E8E93; font-size: 12px;
    }
    /* ── チェックボックス ── */
    .sb-dup-check {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 0; cursor: pointer; user-select: none;
    }
    .sb-dup-check-box {
      flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid #D1D1D6; background: #fff;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, border-color 0.15s;
    }
    .sb-dup-check-box.checked {
      background: #4A8DF8; border-color: #4A8DF8;
    }
    .sb-dup-check-box svg { opacity: 0; transition: opacity 0.15s; }
    .sb-dup-check-box.checked svg { opacity: 1; }
    .sb-dup-check-text { font-size: 15px; color: #1a1a1a; }
  `
  document.head.append(style)
}

const CHECKMARK_SVG = `<svg width="12" height="10" viewBox="0 0 12 10" fill="none">
  <path d="M1 5L4.5 8.5L11 1.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

/** チェックボックス行を生成する（純粋DOM） */
function createCheckbox(labelText: string, defaultChecked: boolean): {
  row: HTMLElement
  isChecked: () => boolean
} {
  const row = document.createElement('label')
  row.className = 'sb-dup-check'

  const box = document.createElement('span')
  box.className = `sb-dup-check-box${defaultChecked ? ' checked' : ''}`
  box.innerHTML = CHECKMARK_SVG

  const text = document.createElement('span')
  text.className = 'sb-dup-check-text'
  text.textContent = labelText

  let checked = defaultChecked
  row.addEventListener('click', (e) => {
    e.preventDefault()
    checked = !checked
    box.classList.toggle('checked', checked)
  })

  row.append(box, text)
  return { row, isChecked: () => checked }
}

/** ドロップダウン付きフィールドを生成する */
function createSelectField(
  label: string,
  note: string,
  options: readonly { readonly value: string; readonly text: string }[],
): { field: HTMLElement; select: HTMLSelectElement } {
  const field = document.createElement('div')
  field.className = 'sb-dup-field'

  const lbl = document.createElement('label')
  lbl.className = 'sb-dup-label'
  lbl.textContent = label
  if (note !== '') {
    const sp = document.createElement('span')
    sp.className = 'sb-dup-label-note'
    sp.textContent = note
    lbl.append(sp)
  }

  const wrap = document.createElement('div')
  wrap.className = 'sb-dup-select-wrap'

  const select = document.createElement('select')
  select.className = 'sb-dup-select'
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.text
    select.append(o)
  }

  const chevron = document.createElement('span')
  chevron.className = 'sb-dup-chevron'
  chevron.textContent = '▼'

  wrap.append(select, chevron)
  field.append(lbl, wrap)
  return { field, select }
}

export function openDuplicateModal(deps: DuplicateDeps): void {
  if (isOpen) return
  const current = deps.getCurrentVersion()
  if (current === null) {
    toast('複製元のVersionが見つかりません', 'error')
    return
  }
  isOpen = true
  injectStyles()

  // ── オーバーレイ ──
  const overlay = document.createElement('div')
  overlay.className = 'sb-dup-overlay'

  const close = (): void => {
    if (!isOpen) return
    isOpen = false
    document.removeEventListener('keydown', onKey)
    overlay.remove()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  // ── カード ──
  const card = document.createElement('div')
  card.className = 'sb-dup-card'
  card.addEventListener('click', (e) => e.stopPropagation())

  // ── ヘッダ ──
  const header = document.createElement('div')
  header.className = 'sb-dup-header'
  header.style.position = 'relative'

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'sb-dup-cancel'
  cancelBtn.textContent = 'キャンセル'
  cancelBtn.addEventListener('click', close)

  const title = document.createElement('span')
  title.className = 'sb-dup-title'
  title.textContent = 'Version複製'

  const submitBtn = document.createElement('button')
  submitBtn.className = 'sb-dup-submit'
  submitBtn.textContent = '複製'

  header.append(cancelBtn, title, submitBtn)

  // ── 区切り線 ──
  const divider = document.createElement('div')
  divider.className = 'sb-dup-divider'

  // ── ボディ ──
  const body = document.createElement('div')
  body.className = 'sb-dup-body'

  // リンク設定
  const { field: linkField } = createSelectField('リンク設定', '', [
    { value: 'leave_links', text: '【残す】全てのページ内URL' },
    { value: 'remove_links', text: '【削除】全てのページ内URL' },
    { value: 'remove_tracking_links', text: '【削除】トラッキングリンクだけ' },
  ] as const)

  // 複製数
  const { field: countField, select: countSelect } = createSelectField(
    '複製数',
    '※最大4件まで',
    [
      { value: '1', text: '1' },
      { value: '2', text: '2' },
      { value: '3', text: '3' },
      { value: '4', text: '4' },
    ] as const,
  )

  // チェックボックス
  const headBody = createCheckbox('Versionのhead/bodyタグを引き継ぐ', true)
  const step = createCheckbox('ステップを引き継ぐ', true)

  const checkField1 = document.createElement('div')
  checkField1.className = 'sb-dup-field'
  checkField1.append(headBody.row)

  const checkField2 = document.createElement('div')
  checkField2.className = 'sb-dup-field'
  checkField2.append(step.row)

  body.append(linkField, countField, checkField1, checkField2)
  card.append(header, divider, body)
  overlay.append(card)
  document.body.append(overlay)

  // ── 複製ボタン ──
  submitBtn.addEventListener('click', () => {
    submitBtn.disabled = true
    void runDuplicate(deps, current, countSelect, close)
  })
}

async function runDuplicate(
  deps: DuplicateDeps,
  current: Version,
  countSelect: HTMLSelectElement,
  close: () => void,
): Promise<void> {
  const raw = Number.parseInt(countSelect.value, 10)
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
