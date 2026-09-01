/**
 * 入稿URL生成ツール（パラメータ付きURLビルダー・指示⑮）。
 * 基本情報タブの「パラメータ付きURLの発行」で開く。実本体の採取モーダルを土台に、
 * 「URLを生成」で配信URLへ utm パラメータ（＋連番）を付けた本数分のURLを生成して表示する。
 */
import rawModal from '../fragments/folders__UID__ab_tests__UID__edit__param-url-dialog.portals.html?raw'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

const HOOK = {
  overlay: '.ReactModal__Overlay',
  button: '[class*="_btn_1bcs1_2"]',
  close: '閉じる',
  build: 'URLを生成',
} as const

let isOpen = false

export function openParamUrlModal(baseUrl: string): void {
  if (isOpen) return
  const portal = openPortal(rawModal, HOOK.overlay, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('パラメータ付きURLのマークアップが壊れています', 'error')
    return
  }
  isOpen = true

  const backdrop = portal.root.querySelector<HTMLElement>('.MuiBackdrop-root')
  if (backdrop !== null) bindBackdropClose(backdrop, portal.close)
  else bindBackdropClose(portal.root, portal.close)
  findByExactText(portal.root, HOOK.button, HOOK.close)?.addEventListener('click', () => portal.close())

  const build = findByExactText(portal.root, HOOK.button, HOOK.build)
  build?.addEventListener('click', () => generate(portal.root, baseUrl))
}

interface ParamSpec {
  key: string
  value: string
  serial: boolean
}

function readParams(root: HTMLElement): ParamSpec[] {
  const specs: ParamSpec[] = []
  // クリエイティブパラメータ ＋ 任意パラメータ（採取物の name 規約: key_creative/value_creative, key_0/value_0…）
  for (const suffix of collectSuffixes(root)) {
    const key = root.querySelector<HTMLInputElement>(`input[name="key_${suffix}"]`)?.value.trim() ?? ''
    const value = root.querySelector<HTMLInputElement>(`input[name="value_${suffix}"]`)?.value.trim() ?? ''
    const serial =
      root.querySelector<HTMLInputElement>(`input[name="existsSerialNumber_${suffix}"]`)?.checked ?? false
    if (key !== '') specs.push({ key, value, serial })
  }
  return specs
}

/** name="key_XXX" の XXX を集める（creative と数字インデックス） */
function collectSuffixes(root: HTMLElement): string[] {
  const suffixes: string[] = []
  for (const input of root.querySelectorAll<HTMLInputElement>('input[name^="key_"]')) {
    const suffix = input.name.slice('key_'.length)
    if (suffix !== '' && !suffixes.includes(suffix)) suffixes.push(suffix)
  }
  return suffixes
}

function generate(root: HTMLElement, baseUrl: string): void {
  const count = clampCount(root.querySelector<HTMLInputElement>('input[name="count"]')?.value)
  const specs = readParams(root)
  if (specs.length === 0) {
    toast('パラメーター名を1つ以上入力してください', 'error')
    return
  }
  const urls: string[] = []
  for (let i = 1; i <= count; i += 1) {
    const query = specs
      .map((s) => `${encodeURIComponent(s.key)}=${encodeURIComponent(s.serial ? `${s.value}${i}` : s.value)}`)
      .join('&')
    urls.push(baseUrl + (baseUrl.includes('?') ? '&' : '?') + query)
  }
  showResults(root, urls)
}

function clampCount(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) ? Math.min(999, Math.max(1, n)) : 1
}

function showResults(root: HTMLElement, urls: readonly string[]): void {
  const dialog = root.querySelector<HTMLElement>('[role="dialog"]') ?? root
  let box = dialog.querySelector<HTMLElement>('[data-clone-param-results]')
  if (box === null) {
    box = document.createElement('div')
    box.setAttribute('data-clone-param-results', '')
    box.style.cssText =
      'margin:12px 16px;padding:12px;border:1px solid #ccc;border-radius:8px;background:#fff;' +
      'max-height:220px;overflow:auto;font-size:12px;font-family:monospace'
    dialog.append(box)
  }
  const copyAll = document.createElement('button')
  copyAll.type = 'button'
  copyAll.textContent = `${urls.length}件をコピー`
  copyAll.style.cssText =
    'margin-bottom:8px;padding:6px 14px;border:1px solid #2B7CFF;border-radius:6px;background:#fff;color:#2B7CFF;cursor:pointer;font-family:sans-serif'
  copyAll.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(urls.join('\n'))
      .then(() => toast(`${urls.length}件のURLをコピーしました`))
      .catch(() => toast('コピーに失敗しました', 'error'))
  })
  box.innerHTML = ''
  box.append(copyAll)
  for (const url of urls) {
    const line = document.createElement('div')
    line.textContent = url
    line.style.cssText = 'padding:3px 0;border-top:1px solid #eee;word-break:break-all'
    box.append(line)
  }
}
