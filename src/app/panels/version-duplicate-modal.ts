/**
 * 「Version複製」モーダル（版の「…」メニュー→「複製」で開く）。
 *
 * 指示76: 実物の最新UIに合わせたライトテーマカード。
 * - ヘッダ: キャンセル | Version複製 | 複製（青ボタン）
 * - リンク設定: ドロップダウン（【残す】全てのページ内URL）
 * - 複製数: ドロップダウン（1〜4、※最大4件まで）
 *
 * 2026-09-24 全体点検13: 以前はリンク設定・「head/bodyタグを引き継ぐ」「ステップを引き継ぐ」を受け取るだけで、
 * どれを選んでも変わらなかった。リンク設定はサーバーで効かせる（全部外す／計測付きだけ外す）。
 * タグはステップ（記事）ごとの設定で、複製は同じステップの中に作るので、引き継ぐ・引き継がないの違いが無い。
 * 選んでも何も起きない2つのチェックは置かない。
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
      background: var(--sb-c-ffffff, #FFFFFF); border-radius: 12px; width: 420px; max-width: calc(100vw - 32px);
      box-shadow: 0 4px 24px rgba(0,0,0,0.14);
      overflow: hidden;
    }
    /* ── ヘッダ ── */
    .sb-dup-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px;
    }
    .sb-dup-cancel {
      color: var(--sb-c-666666, #666666); font-size: 14px; cursor: pointer; background: none; border: none;
      padding: 0; font-family: inherit;
    }
    .sb-dup-cancel:hover { color: var(--sb-c-333333, #333333); }
    .sb-dup-title {
      font-size: 16px; font-weight: 700; color: var(--sb-c-1a1a1a, #1A1A1A);
      position: absolute; left: 50%; transform: translateX(-50%);
    }
    .sb-dup-submit {
      background: #4A8DF8; color: #FFFFFF; font-size: 14px; font-weight: 600;
      border: none; border-radius: 8px; padding: 8px 22px; cursor: pointer;
      font-family: inherit;
    }
    .sb-dup-submit:hover { background: #3B7DE8; }
    .sb-dup-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    /* ── 区切り線 ── */
    .sb-dup-divider { height: 1px; background: var(--sb-c-e5e5ea, #E5E5EA); margin: 0; }
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
      background: var(--sb-c-f2f2f7, #F2F2F7); border: none; border-radius: 10px;
      padding: 13px 40px 13px 16px; font-size: 15px; color: var(--sb-c-1a1a1a, #1A1A1A);
      font-family: inherit; cursor: pointer; outline: none;
    }
    .sb-dup-select:focus { box-shadow: 0 0 0 2px rgba(74,141,248,0.3); }
    .sb-dup-chevron {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: #8E8E93; font-size: 12px;
    }
  `
  document.head.append(style)
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
  const { field: linkField, select: linkSelect } = createSelectField('リンク設定', '', [
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

  // タグはステップの設定なので、同じステップに作る複製では「引き継ぐ」必要が無いことを書いておく
  const note = document.createElement('div')
  note.className = 'sb-dup-field'
  note.style.cssText = 'font-size:12px;color:var(--sb-c-8a8a8e, #8A8A8E);line-height:1.6'
  note.textContent = '複製は同じステップの中に作ります。タグ設定（head/body）はステップごとの設定なので、そのまま使われます。'

  body.append(linkField, countField, note)
  card.append(header, divider, body)
  overlay.append(card)
  document.body.append(overlay)

  // ── 複製ボタン ──
  submitBtn.addEventListener('click', () => {
    submitBtn.disabled = true
    void runDuplicate(deps, current, countSelect, linkModeOf(linkSelect.value), close)
  })
}

type LinkMode = 'leave_links' | 'remove_links' | 'remove_tracking_links'
const linkModeOf = (value: string): LinkMode =>
  value === 'remove_links' || value === 'remove_tracking_links' ? value : 'leave_links'

async function runDuplicate(
  deps: DuplicateDeps,
  current: Version,
  countSelect: HTMLSelectElement,
  linkMode: LinkMode,
  close: () => void,
): Promise<void> {
  const raw = Number.parseInt(countSelect.value, 10)
  const count = Number.isFinite(raw) ? Math.min(4, Math.max(1, raw)) : 1
  for (let i = 0; i < count; i += 1) {
    try {
      const { version } = await api.duplicateVersion(current.uid, linkMode)
      deps.onDuplicated(version)
    } catch (error) {
      toast((error as Error).message, 'error')
      return
    }
  }
  toast(count === 1 ? '複製しました' : `${count}件複製しました`)
  close()
}
