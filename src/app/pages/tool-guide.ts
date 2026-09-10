/**
 * ツール各画面の上に出す「この画面でできること」の帯。
 *
 * 初見の人が画面を開いたとき、空の3ペインや空の一覧だけが出ると
 * 何から始めればいいのか分からない。1行の説明と手順をここで出す。
 *
 * 一度閉じたら次からは出さない（毎回同じ説明を読まされない）。
 * 覚えておくのはこのブラウザだけ・使う人ごと。読めなくても画面は普通に動く。
 */

/** 手順の1ステップ。`done` が真なら済んだ扱いにして薄く出す。 */
export interface GuideStep {
  label: string
  done?: boolean
}

export interface GuideOptions {
  /** 閉じた状態を覚えるための名前（ツールごとに変える） */
  id: string
  /** 何をする画面かの1行 */
  summary: string
  steps: GuideStep[]
  /** 右端に出す補助リンク（別画面へ渡したいときだけ） */
  action?: { label: string; onClick: () => void }
}

const STORAGE_PREFIX = 'lp-sakusei:tool-guide:'

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === 'closed'
  } catch {
    // プライベートウィンドウなど、保存が使えない環境では毎回出す（それで困らない）
    return false
  }
}

function dismiss(id: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, 'closed')
  } catch {
    // 覚えられなくても閉じる動作自体は成立する
  }
}

/** 帯を作る。閉じられていれば null（呼び出し側は append しない）。 */
export function buildToolGuide(options: GuideOptions): HTMLElement | null {
  injectStyles()
  if (isDismissed(options.id)) return null

  const box = el('div', 'tg-box')
  const head = el('div', 'tg-head')
  head.append(el('span', 'tg-icon', 'i'), el('span', 'tg-summary', options.summary))

  if (options.action !== undefined) {
    const a = el('button', 'tg-action', options.action.label) as HTMLButtonElement
    a.type = 'button'
    a.addEventListener('click', options.action.onClick)
    head.append(a)
  }

  const close = el('button', 'tg-close', '×') as HTMLButtonElement
  close.type = 'button'
  close.title = '次から表示しない'
  close.addEventListener('click', () => {
    dismiss(options.id)
    box.remove()
  })
  head.append(close)

  const steps = el('div', 'tg-steps')
  for (const [i, s] of options.steps.entries()) {
    const step = el('span', `tg-step${s.done === true ? ' done' : ''}`)
    step.append(el('span', 'tg-num', String(i + 1)), el('span', 'tg-label', s.label))
    steps.append(step)
  }

  box.append(head, steps)
  return box
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function injectStyles(): void {
  if (document.getElementById('tg-css') !== null) return
  const s = document.createElement('style')
  s.id = 'tg-css'
  s.textContent = `
    .tg-box{background:#f4f8fd;border:1px solid #d8e6f7;border-radius:6px;
      padding:10px 14px;margin-bottom:12px;flex-shrink:0}
    .tg-head{display:flex;flex-direction:row;align-items:center;gap:8px}
    .tg-icon{width:16px;height:16px;border-radius:50%;background:var(--sb-accent,#0091FF);
      color:var(--sb-accent-ink,#fff);font-size:11px;font-weight:700;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-style:italic}
    .tg-summary{flex:1;font-size:12px;color:#334;line-height:1.6}
    .tg-action{border:1px solid var(--sb-accent,#0091FF);background:#fff;
      color:var(--sb-accent,#0091FF);border-radius:4px;padding:4px 12px;font-size:11px;
      cursor:pointer;white-space:nowrap}
    .tg-close{border:none;background:none;color:#9aa;font-size:15px;cursor:pointer;
      padding:0 2px;line-height:1}
    .tg-steps{display:flex;flex-direction:row;flex-wrap:wrap;gap:16px;margin-top:8px;
      padding-left:24px}
    .tg-step{display:flex;flex-direction:row;align-items:center;gap:6px}
    .tg-step.done{opacity:.45}
    .tg-num{width:16px;height:16px;border-radius:50%;border:1px solid var(--sb-accent,#0091FF);
      color:var(--sb-accent,#0091FF);font-size:10px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center}
    .tg-step.done .tg-num{background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#fff)}
    .tg-label{font-size:11.5px;color:#445}
  `
  document.head.append(s)
}
