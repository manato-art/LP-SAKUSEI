/**
 * 分割テストの「URLパラメータ条件」設定（split-test-settings.ts から分離）。
 *
 * `utm_source=fb` のような条件を、完全一致 / 前方一致 / 後方一致 / 部分一致で指定する。
 */

import { api, type Version } from '../api.ts'
import { toast } from '../ui.ts'
/** 「パラメーター別」表記を「流入元別」に置き換える（サブナビのラベルと本文見出し）。 */
export function renameParamTab(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (el.children.length === 0 && (el.textContent ?? '').trim() === 'パラメーター別') {
      el.textContent = '流入元別'
    }
  }
}
export function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
}
const MATCH_OPTIONS: readonly [string, string][] = [
  ['exact', '完全に一致'],
  ['prefix', '〜で始まる'],
  ['suffix', '〜で終わる'],
  ['contains', '〜を含む'],
]
/**
 * 流入元別（旧・パラメーター別）: 採取物の1入力欄を「パラメータ名 / 条件 / 値 ＋ プレビュー」の
 * 分かりやすい3項目UIに置き換え、版ごとに param_rules を保存する。
 */
export function wireParamRow(row: HTMLElement, version: Version): void {
  const input = row.querySelector<HTMLInputElement>('input[placeholder*="utm"], input[placeholder*="xxx"]')
  const host = input?.closest<HTMLElement>('.MuiFormControl-root') ?? input?.parentElement ?? null
  if (host === null) return

  const rule = version.param_rules?.[0] ?? { name: 'utm_creative', match: 'exact' as const, value: '' }

  const editor = document.createElement('div')
  editor.setAttribute('data-clone-param-editor', '')
  editor.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px 14px;background:var(--sb-c-ffffff, #FFFFFF);' +
    'border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:8px'

  const fields = document.createElement('div')
  fields.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end'
  const field = (labelText: string, el: HTMLElement): HTMLElement => {
    const wrap = document.createElement('label')
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;font-size:11px;color:#8A94A6'
    const lb = document.createElement('span')
    lb.textContent = labelText
    wrap.append(lb, el)
    return wrap
  }
  const inputStyle = 'padding:7px 10px;border:1px solid #d6dae1;border-radius:6px;font-size:13px'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = rule.name
  nameInput.placeholder = 'utm_creative'
  nameInput.style.cssText = inputStyle
  const matchSel = document.createElement('select')
  matchSel.style.cssText = `${inputStyle};cursor:pointer`
  for (const [v, l] of MATCH_OPTIONS) {
    const o = document.createElement('option')
    o.value = v
    o.textContent = l
    if (v === rule.match) o.selected = true
    matchSel.append(o)
  }
  const valInput = document.createElement('input')
  valInput.type = 'text'
  valInput.value = rule.value
  valInput.placeholder = 'summer'
  valInput.style.cssText = inputStyle
  fields.append(field('パラメータ名', nameInput), field('条件', matchSel), field('値', valInput))

  const preview = document.createElement('div')
  preview.style.cssText = 'font-size:12px;color:var(--sb-c-5b6577, #5B6577)'
  const renderPreview = (): void => {
    const n = nameInput.value.trim() || 'utm_creative'
    const v = valInput.value.trim()
    const note =
      { exact: '', prefix: '（で始まる）', suffix: '（で終わる）', contains: '（を含む）' }[matchSel.value] ?? ''
    preview.innerHTML =
      v === ''
        ? '<span style="color:#AAAAAA">値を入れると、その広告リンクから来た人にこのVersionを表示します（未入力なら常に表示）</span>'
        : `→ <b>?${escapeText(n)}=${escapeText(v)}</b>${note} で来た人にこのVersionを表示`
  }
  const saveRule = (): void => {
    const n = nameInput.value.trim()
    const v = valInput.value.trim()
    const rules = v === '' ? [] : [{ name: n, match: matchSel.value, value: v }]
    void api.setVersionTargeting(version.uid, { param_rules: rules }).then(() => toast('流入元の条件を保存しました'))
  }
  for (const el of [nameInput, valInput]) {
    el.addEventListener('input', renderPreview)
    el.addEventListener('blur', saveRule)
  }
  matchSel.addEventListener('change', () => {
    renderPreview()
    saveRule()
  })
  renderPreview()

  editor.append(fields, preview)
  host.replaceWith(editor)
}
