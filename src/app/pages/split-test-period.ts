/**
 * 分割テストの「配信期間」設定（split-test-settings.ts から分離）。
 *
 * 開始日・終了日と、時間帯の帯（24時間のタイムライン）を編集する。
 */

import { api, type Version } from '../api.ts'
/**
 * 時間別/日付別: 行内の追加ボタン（時間設定を追加 / ＋AddBoxIcon）を機能させ、
 * 「開始〜終了（＋配信する/しない）」の行を足せるようにして、版ごとに time_ranges / date_periods を保存する。
 */
export function wirePeriodRow(row: HTMLElement, version: Version, kind: 'time' | 'date'): void {
  const addBtn =
    kind === 'time'
      ? [...row.querySelectorAll<HTMLElement>('button')].find((b) => (b.textContent ?? '').includes('時間設定を追加')) ?? null
      : row.querySelector<SVGElement>('svg[data-testid="AddBoxIcon"]')?.closest<HTMLElement>('button, [role="button"], a') ??
        (row.querySelector<SVGElement>('svg[data-testid="AddBoxIcon"]')?.parentElement as HTMLElement | null)

  const list = document.createElement('div')
  list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:8px 0 4px'
  ;(addBtn?.closest<HTMLElement>('.css-1q0mywx') ?? row).append(list)

  const collectAndSave = (): void => {
    const editors = [...list.querySelectorAll<HTMLElement>('[data-period-editor]')]
    if (kind === 'time') {
      const ranges = editors
        .map((e) => ({
          from: e.querySelector<HTMLInputElement>('[data-from]')?.value ?? '',
          to: e.querySelector<HTMLInputElement>('[data-to]')?.value ?? '',
        }))
        .filter((r) => r.from !== '' || r.to !== '')
      void api.setVersionTargeting(version.uid, { time_ranges: ranges })
    } else {
      const periods = editors
        .map((e) => ({
          from: e.querySelector<HTMLInputElement>('[data-from]')?.value ?? '',
          to: e.querySelector<HTMLInputElement>('[data-to]')?.value ?? '',
          mode: (e.querySelector<HTMLSelectElement>('[data-mode]')?.value as 'on' | 'off') ?? 'on',
        }))
        .filter((p) => p.from !== '' || p.to !== '')
      void api.setVersionTargeting(version.uid, { date_periods: periods })
    }
  }

  const addEditor = (initial?: { from?: string; to?: string; mode?: string }): void => {
    list.append(buildPeriodEditor(kind, initial, collectAndSave))
  }

  const existing =
    kind === 'time' ? version.time_ranges ?? [] : version.date_periods ?? []
  for (const it of existing) addEditor(it)

  if (addBtn !== null) {
    addBtn.style.cursor = 'pointer'
    addBtn.addEventListener('click', (event) => {
      event.preventDefault()
      addEditor()
    })
  }
}
/** 配信期間の編集行を1つ作る（time=開始〜終了 / date=開始〜終了＋配信する/しない＋削除）。 */
function buildPeriodEditor(
  kind: 'time' | 'date',
  initial: { from?: string; to?: string; mode?: string } | undefined,
  onChange: () => void,
): HTMLElement {
  const editor = document.createElement('div')
  editor.setAttribute('data-period-editor', kind)
  editor.style.cssText =
    'display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:var(--sb-c-ffffff, #FFFFFF);' +
    'border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:8px;font-size:13px;color:var(--sb-c-333333, #333333)'

  const mk = (attr: string, value: string): HTMLInputElement => {
    const i = document.createElement('input')
    i.type = kind === 'time' ? 'time' : 'date'
    i.setAttribute(attr, '')
    i.value = value
    i.style.cssText = 'padding:6px 8px;border:1px solid #d6dae1;border-radius:6px;font-size:13px'
    i.addEventListener('change', onChange)
    return i
  }
  const from = mk('data-from', initial?.from ?? '')
  const to = mk('data-to', initial?.to ?? '')
  const tilde = document.createElement('span')
  tilde.textContent = '〜'

  if (kind === 'time') {
    // 指示139: 24時間タイムラインをドラッグ&ドロップで範囲選択できるようにする。
    // 選択した範囲は from/to の時刻入力へ反映し（逆も同期）、保存する。
    editor.style.flexDirection = 'column'
    editor.style.alignItems = 'stretch'
    const timeline = buildHourTimeline(from, to, onChange)
    const inputRow = document.createElement('div')
    inputRow.setAttribute('data-time-input-row', '')
    inputRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap'
    inputRow.append(from, tilde, to)
    editor.append(timeline.el, inputRow)
    // input を手で変えたらタイムラインへ反映
    from.addEventListener('change', timeline.sync)
    to.addEventListener('change', timeline.sync)
  } else {
    editor.append(from, tilde, to)
  }

  if (kind === 'date') {
    const mode = document.createElement('select')
    mode.setAttribute('data-mode', '')
    mode.style.cssText = 'padding:6px 8px;border:1px solid #d6dae1;border-radius:6px;font-size:13px;cursor:pointer'
    for (const [v, l] of [['on', '配信する'], ['off', '配信しない']]) {
      const o = document.createElement('option')
      o.value = v!
      o.textContent = l!
      if (v === (initial?.mode ?? 'on')) o.selected = true
      mode.append(o)
    }
    mode.addEventListener('change', onChange)
    editor.append(mode)
  }

  const del = document.createElement('button')
  del.type = 'button'
  del.textContent = '削除'
  del.style.cssText =
    'margin-left:auto;padding:6px 12px;border:1px solid #f0b4b4;border-radius:6px;background:var(--sb-c-ffffff, #FFFFFF);' +
    'color:#d64545;font-size:12px;cursor:pointer'
  del.addEventListener('click', () => {
    editor.remove()
    onChange()
  })
  // 時間別は縦積みなので、削除ボタンは入力行に入れる（下に間延びさせない）
  const delTarget =
    kind === 'time' ? editor.querySelector<HTMLElement>('[data-time-input-row]') ?? editor : editor
  delTarget.append(del)
  return editor
}
/**
 * 指示139: 24時間タイムライン（ドラッグ&ドロップで時間帯を選択）。
 * セルを押し込んで横へドラッグすると開始〜終了の時間帯が選べ、from/to の時刻入力へ反映する。
 * from/to を手入力したときは `sync()` でタイムラインの塗りを合わせる。
 */
function buildHourTimeline(
  from: HTMLInputElement,
  to: HTMLInputElement,
  onChange: () => void,
): { el: HTMLElement; sync: () => void } {
  const pad = (n: number): string => String(n).padStart(2, '0')

  const wrap = document.createElement('div')
  wrap.style.cssText = 'width:100%;user-select:none'

  const strip = document.createElement('div')
  strip.style.cssText =
    'display:grid;grid-template-columns:repeat(24,1fr);height:34px;border:1px solid #d6dae1;' +
    'border-radius:8px;overflow:hidden;background:var(--sb-c-ffffff, #FFFFFF)'

  const cells: HTMLElement[] = []
  for (let h = 0; h < 24; h += 1) {
    const cell = document.createElement('div')
    cell.dataset['hour'] = String(h)
    cell.style.cssText =
      'border-right:1px solid var(--sb-c-eef0f3, #EEF0F3);cursor:pointer;transition:background .08s;' +
      (h % 6 === 0 ? 'border-left:1px solid #cfd4dc;' : '')
    cells.push(cell)
    strip.append(cell)
  }

  // 目盛り（0/6/12/18/24）
  const scale = document.createElement('div')
  scale.style.cssText =
    'display:grid;grid-template-columns:repeat(24,1fr);font-size:10px;color:#8A94A6;margin-top:2px'
  for (let h = 0; h < 24; h += 1) {
    const t = document.createElement('div')
    t.style.cssText = 'text-align:left;transform:translateX(-50%)'
    t.textContent = h % 6 === 0 ? String(h) : ''
    scale.append(t)
  }
  // 末尾の24
  const end24 = document.createElement('div')
  end24.style.cssText = 'position:relative;height:0'
  const end24Label = document.createElement('span')
  end24Label.style.cssText = 'position:absolute;right:0;top:-14px;font-size:10px;color:#8A94A6'
  end24Label.textContent = '24'
  end24.append(end24Label)

  // 現在塗られている範囲（finalize で使う。style文字列比較は不安定なので変数で持つ）
  let curLo = -1
  let curHi = -1
  const paint = (lo: number, hi: number): void => {
    const a = Math.min(lo, hi)
    const b = Math.max(lo, hi)
    curLo = a
    curHi = b
    cells.forEach((c, i) => {
      c.style.background = i >= a && i <= b ? '#f0960a' : '#fff'
    })
  }

  // from/to → セル範囲
  const parseHour = (v: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v)
    return m ? parseInt(m[1] as string, 10) : null
  }
  const sync = (): void => {
    const f = parseHour(from.value)
    const t = parseHour(to.value)
    const tMin = /^(\d{1,2}):(\d{2})$/.exec(to.value)
    if (f === null || t === null) {
      cells.forEach((c) => (c.style.background = 'var(--sb-c-ffffff, #FFFFFF)'))
      return
    }
    // to は「その時刻まで」なので、分が00なら1時間手前までを塗る（例 09:00〜12:00 → 9,10,11）
    const min = tMin ? parseInt(tMin[2] as string, 10) : 0
    let hi = to.value === '23:59' ? 23 : min === 0 ? t - 1 : t
    if (hi < f) hi = f
    if (hi > 23) hi = 23
    paint(f, hi)
  }

  // ドラッグ選択
  let anchor = -1
  const finalize = (): void => {
    if (curLo < 0 || curHi < 0) return
    from.value = `${pad(curLo)}:00`
    to.value = curHi >= 23 ? '23:59' : `${pad(curHi + 1)}:00`
    onChange()
  }
  const onMove = (e: MouseEvent): void => {
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const cell = target?.closest<HTMLElement>('[data-hour]')
    if (cell !== null && cell !== undefined && strip.contains(cell)) {
      paint(anchor, parseInt(cell.dataset['hour'] as string, 10))
    }
  }
  const onUp = (): void => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    finalize()
  }
  strip.addEventListener('mousedown', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-hour]')
    if (cell === null) return
    e.preventDefault()
    anchor = parseInt(cell.dataset['hour'] as string, 10)
    paint(anchor, anchor)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  wrap.append(strip, scale, end24)
  sync()
  return { el: wrap, sync }
}
