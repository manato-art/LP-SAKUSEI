/**
 * 集計期間ピッカー（beyondページ一覧のKPI集計期間・クローン独自UI）。
 *
 * 採取物には期間指定のUIが無い（押した先の画面を採取できていない）ため、実物の見た目を
 * 発明せず、最小限のポップオーバーとして作る。プリセットの数え方は推測せず
 * `report-period.ts` の `resolvePreset` に委ねる（解決できない `seven_days` は出さない）。
 */
import { resolvePreset, toDateKey, type DateRange } from '../pages/report-period.ts'

const CSS_ID = 'sb-period-picker-css'

/** 表示するプリセット（resolvePreset が解決できるものだけ） */
const PRESETS: readonly { value: string; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: 'last_three_days', label: '過去3日間' },
  { value: 'last_seven_days', label: '過去7日間' },
]

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .sb-pp-pop {
      position:fixed; z-index:100001; background:var(--sb-c-ffffff, #FFFFFF); border:1px solid var(--sb-c-e5e5ea, #E5E5EA);
      border-radius:8px; box-shadow:0 8px 28px rgba(0,0,0,.18); padding:14px;
      width:280px; box-sizing:border-box;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif; color:var(--sb-c-1a1a1a, #1A1A1A);
    }
    .sb-pp-presets { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
    .sb-pp-preset {
      font-size:12px; padding:5px 10px; border:1px solid var(--sb-c-e5e5ea, #E5E5EA); border-radius:14px;
      background:var(--sb-c-ffffff, #FFFFFF); cursor:pointer; font-family:inherit; color:var(--sb-c-333333, #333333);
    }
    .sb-pp-preset:hover { background:#f0f7ff; border-color:var(--sb-accent, #0091FF); color:var(--sb-accent, #0091FF); }
    .sb-pp-row { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
    .sb-pp-row label { font-size:11px; color:var(--sb-c-666666, #666666); width:34px; flex-shrink:0; }
    .sb-pp-row input {
      flex:1; min-width:0; height:28px; border:1px solid var(--sb-c-e5e5ea, #E5E5EA); border-radius:4px;
      padding:0 8px; font-size:12px; font-family:inherit; color:var(--sb-c-1a1a1a, #1A1A1A); background:var(--sb-c-ffffff, #FFFFFF);
    }
    .sb-pp-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
    .sb-pp-btn {
      font-size:12px; padding:6px 14px; border-radius:5px; cursor:pointer;
      border:1px solid var(--sb-c-e5e5ea, #E5E5EA); background:var(--sb-c-ffffff, #FFFFFF); color:var(--sb-c-333333, #333333); font-family:inherit;
    }
    .sb-pp-btn.primary { background:var(--sb-accent, #0091FF); border-color:var(--sb-accent, #0091FF); color:#FFFFFF; }
    .sb-pp-err { font-size:11px; color:#d32f2f; margin:6px 0 0; min-height:14px; }
  `
  document.head.append(s)
}

/** `集計期間：2026/09/08 〜 2026/09/08` の表記（採取物のラベル書式に合わせる） */
export function formatPeriodLabel(range: DateRange): string {
  const dot = (key: string): string => key.replace(/-/g, '/')
  return `集計期間：${dot(range.startDate)} 〜 ${dot(range.endDate)}`
}

/**
 * 期間ピッカーを開く。`onApply` は「適用」時にだけ呼ぶ（キャンセルでは呼ばない）。
 */
export function openPeriodPicker(
  anchor: HTMLElement,
  current: DateRange,
  onApply: (range: DateRange) => void,
): void {
  injectStyles()
  document.querySelector('.sb-pp-pop')?.remove()

  const pop = document.createElement('div')
  pop.className = 'sb-pp-pop'

  const presets = document.createElement('div')
  presets.className = 'sb-pp-presets'

  const startInput = document.createElement('input')
  startInput.type = 'date'
  startInput.value = current.startDate
  const endInput = document.createElement('input')
  endInput.type = 'date'
  endInput.value = current.endDate

  for (const p of PRESETS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sb-pp-preset'
    b.textContent = p.label
    b.addEventListener('click', () => {
      const r = resolvePreset(p.value)
      if (r === null) return
      startInput.value = r.startDate
      endInput.value = r.endDate
      err.textContent = ''
    })
    presets.append(b)
  }

  const mkRow = (labelText: string, input: HTMLInputElement): HTMLElement => {
    const row = document.createElement('div')
    row.className = 'sb-pp-row'
    const l = document.createElement('label')
    l.textContent = labelText
    row.append(l, input)
    return row
  }

  const err = document.createElement('p')
  err.className = 'sb-pp-err'

  const actions = document.createElement('div')
  actions.className = 'sb-pp-actions'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'sb-pp-btn'
  cancel.textContent = 'キャンセル'
  const apply = document.createElement('button')
  apply.type = 'button'
  apply.className = 'sb-pp-btn primary'
  apply.textContent = '適用'
  actions.append(cancel, apply)

  pop.append(presets, mkRow('開始', startInput), mkRow('終了', endInput), err, actions)
  document.body.append(pop)

  // アンカー直下に出す（画面外へはみ出さないよう右端で折り返す）
  const rect = anchor.getBoundingClientRect()
  const width = pop.offsetWidth
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  pop.style.left = `${left}px`
  pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - pop.offsetHeight - 8)}px`

  const close = (): void => {
    pop.remove()
    document.removeEventListener('mousedown', onOutside, true)
  }
  function onOutside(e: MouseEvent): void {
    const t = e.target as Node
    if (!pop.contains(t) && !anchor.contains(t)) close()
  }
  document.addEventListener('mousedown', onOutside, true)

  cancel.addEventListener('click', close)
  apply.addEventListener('click', () => {
    const startDate = startInput.value
    const endDate = endInput.value
    if (startDate === '' || endDate === '') {
      err.textContent = '開始日と終了日を入れてください'
      return
    }
    if (startDate > endDate) {
      err.textContent = '開始日が終了日より後になっています'
      return
    }
    close()
    onApply({ startDate, endDate })
  })
}

/** 既定期間のラベル（初期表示用） */
export function todayLabel(): string {
  const key = toDateKey(new Date())
  return formatPeriodLabel({ startDate: key, endDate: key })
}
