/**
 * 広告費の取り込み（CSV貼り付け・2026-09-15）。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの機能（本人の依頼）。
 * 実物は広告アカウントを繋いで自動で取り込むが、こちらはMeta以外の媒体に繋げられないため、
 * Google / Yahoo / X などの管理画面から落とした日別の実績を貼り付けて入れる。
 * 採取した画面には手を入れず、その**下に足す**（実物のUIは変えない）。
 *
 * 入れた値は Meta連携と同じ置き場所（日別の媒体実績）に**上書き**で入る。
 * 同じ日を入れ直しても二重計上しない。
 */
import { T, el, toast } from '../ui.ts'
import { api, type AbTest } from '../api.ts'
import { parseAdCostCsv } from './ad-cost-csv.ts'

const SAMPLE = `日付,配信金額,表示回数,クリック,CV
2026-09-15,12000,4500,180,6
2026-09-16,9800,3900,150,4`

/** 見出しと説明 */
function heading(): HTMLElement {
  const box = el('div', { style: 'margin-bottom:14px' })
  box.append(
    el('div', {
      text: '広告費の取り込み（CSV）',
      style: `font-size:16px;font-weight:700;color:${T.text};margin-bottom:6px`,
    }),
    el('div', {
      text:
        '※このシステムだけの機能です（実物にはありません）。Meta以外の媒体は連携できないため、' +
        '各媒体の管理画面から落とした日別の実績を貼り付けて入れます。' +
        '入れると配信金額・CPA・MCPA・ROAS・ROI がレポートに出ます。',
      style: `font-size:12px;color:${T.sub};line-height:1.8`,
    }),
  )
  return box
}

/** beyondページの選択 */
function pageSelect(pages: readonly AbTest[]): HTMLSelectElement {
  const select = document.createElement('select')
  select.style.cssText = `padding:8px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font};min-width:220px;max-width:100%`
  for (const page of pages) {
    const option = document.createElement('option')
    option.value = page.uid
    option.textContent = page.title
    select.append(option)
  }
  return select
}

/**
 * 採取した画面の下に、取り込みの一式を足す。
 * @param host 差し込み先（採取物のルート）
 */
export async function mountAdCostImport(host: HTMLElement): Promise<void> {
  let pages: AbTest[] = []
  try {
    pages = (await api.abTests()).ab_tests
  } catch {
    // 取れなければ案内だけ出す
  }

  const section = el('div', {
    style: `margin:24px 16px 40px;padding:20px;background:${T.surface};border:1px solid var(--sb-c-e6e6e6, #E6E6E6);border-radius:10px;font-family:${T.font}`,
  })
  section.append(heading())

  if (pages.length === 0) {
    section.append(
      el('div', {
        text: 'beyondページがまだありません。ページを作ってから取り込んでください。',
        style: `font-size:13px;color:${T.sub}`,
      }),
    )
    host.append(section)
    return
  }

  const select = pageSelect(pages)
  const row = el('div', {
    style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px',
  })
  row.append(el('span', { text: '入れ先', style: `font-size:12px;color:${T.sub}` }), select)
  section.append(row)

  const area = document.createElement('textarea')
  area.rows = 6
  area.placeholder = SAMPLE
  area.spellcheck = false
  area.style.cssText = `width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.7;resize:vertical`
  section.append(area)

  const hint = el('div', {
    text:
      '1行目は見出し（日付・配信金額が必須。表示回数・クリック・CVは任意）。' +
      'スプレッドシートからそのまま貼り付けられます。同じ日を入れ直すと上書きします。',
    style: `font-size:11px;color:${T.sub};margin:6px 0 12px;line-height:1.7`,
  })
  section.append(hint)

  const actions = el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' })
  const run = document.createElement('button')
  run.type = 'button'
  run.textContent = '取り込む'
  run.style.cssText = `padding:9px 18px;border:none;border-radius:6px;background:var(--sb-accent, #0091FF);color:#FFF;cursor:pointer;font-size:13px;font-family:${T.font}`
  const sample = document.createElement('button')
  sample.type = 'button'
  sample.textContent = '書き方の例を入れる'
  sample.style.cssText = `padding:9px 14px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;background:${T.surface};color:${T.text};cursor:pointer;font-size:13px;font-family:${T.font}`
  sample.addEventListener('click', () => {
    area.value = SAMPLE
    area.focus()
  })
  const result = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.8` })
  actions.append(run, sample)
  section.append(actions, result)

  run.addEventListener('click', () => {
    const parsed = parseAdCostCsv(area.value)
    if (parsed.rows.length === 0) {
      result.textContent = parsed.errors.join(' ') || '取り込める行がありませんでした。'
      toast('取り込める行がありませんでした', 'error')
      return
    }
    run.disabled = true
    void api
      .importAdCosts(select.value, parsed.rows)
      .then(({ days }) => {
        // 落とした行があれば隠さずに伝える（入ったつもりで数字が合わない事故を防ぐ）
        const dropped = parsed.errors.length === 0 ? '' : ` 読めなかった行: ${parsed.errors.join(' ')}`
        result.textContent = `${days}日ぶんを取り込みました。${dropped}`
        toast(`${days}日ぶんの広告費を取り込みました`)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '取り込みに失敗しました'
        result.textContent = message
        toast(message, 'error')
      })
      .finally(() => {
        run.disabled = false
      })
  })

  host.append(section)
}
