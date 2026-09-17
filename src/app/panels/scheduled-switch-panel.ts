/**
 * 配信の切り替え予約の画面（2026-09-16・本人の依頼）。
 *
 * エディタのVersion一覧の「日時を決めて切り替える」から開く。
 * 決めた日時（日本時間）に、そのステップの配信割合を指定した値へ切り替える。
 *   開始＝0%→100% ／ 停止＝0% ／ 切り替え＝片方を0%・もう片方を100%
 *
 * ⚠️ このシステムだけの機能（実物のSquadBeyondには無い）。
 * 日単位の出し分けは既存の「Versionオプション設定 → 日付別」でできる。これは日時ちょうど（分単位）の切り替え用。
 */
import { api, type ScheduledSwitch, type Version } from '../api.ts'
import { confirmCard, formCard } from '../dialog.ts'
import { T, el, toast } from '../ui.ts'
import { jstParts } from '../jst.ts'

const NOTE_STYLE = `font-size:12px;color:${T.sub};line-height:1.8`
const SECTION_STYLE = `font-size:12.5px;font-weight:700;color:${T.text};margin:14px 0 6px`

/** 'YYYY-MM-DDTHH:MM' を「9/30 23:59」に */
function shortWhen(value: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(value)
  return m === null ? value : `${Number(m[1])}/${Number(m[2])} ${m[3]}`
}

/** 今の日本時間を datetime-local の形で（過去を選べないようにする下限） */
function nowLocalValue(): string {
  const p = jstParts(new Date())
  // datetime-local は0埋めした形しか受け付けない（'2026-9-7T8:5' だと下限として無視される）
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

function ratiosText(sw: ScheduledSwitch): string {
  return sw.ratios.map((r) => `${r.name === '' ? '（消えたVersion）' : r.name} ${r.ratio}%`).join(' / ')
}

/** 予約1件ぶんの行（これからのものは取り消せる） */
function switchRow(sw: ScheduledSwitch, onCancel: (sw: ScheduledSwitch) => void): HTMLElement {
  const row = el('div', {
    style: 'display:flex;gap:8px;align-items:flex-start;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2)',
  })
  const label =
    sw.status === 'pending'
      ? `${shortWhen(sw.run_at)} に切り替え`
      : sw.status === 'done'
        ? `完了（${shortWhen(sw.done_at ?? sw.run_at)}）`
        : sw.status === 'failed'
          ? `実行できませんでした（${shortWhen(sw.done_at ?? sw.run_at)}）`
          : `取り消し（${shortWhen(sw.run_at)} の予約）`
  const text = el('div', { style: `min-width:0;font-size:12.5px;line-height:1.7;color:${sw.status === 'pending' ? T.text : T.sub}` }, [
    el('div', { text: label, style: 'font-weight:600' }),
    el('div', { text: ratiosText(sw) }),
    ...(sw.note === '' ? [] : [el('div', { text: sw.note, style: NOTE_STYLE })]),
  ])
  row.append(text)
  if (sw.status === 'pending') {
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = '取り消す'
    cancel.style.cssText = `flex-shrink:0;border:0;background:transparent;color:#C0392B;font:inherit;font-size:12px;cursor:pointer;padding:4px 0`
    cancel.addEventListener('click', () => onCancel(sw))
    row.append(cancel)
  }
  return row
}

export async function openScheduledSwitchPanel(ctx: { articleUid: string; versions: readonly Version[] }): Promise<void> {
  const versions = ctx.versions.filter((v) => v.archived !== true)
  let switches: ScheduledSwitch[] = []
  try {
    switches = (await api.scheduledSwitches(ctx.articleUid)).switches
  } catch (error) {
    toast((error as Error).message, 'error')
    return
  }

  // Versionが多いと縦に長くなるので、カードの中だけでスクロールさせる（画面からはみ出さない）
  const body = el('div', { style: 'display:flex;flex-direction:column;max-height:min(60vh,520px);overflow-y:auto' })
  body.append(
    el('div', {
      text:
        '決めた日時（日本時間）に、このステップの配信割合を下の値へ切り替えます。' +
        '開始は0%→100%、止めるなら0%、切り替えは片方を0%にします。合計は100%（全部止めるなら0%）。' +
        '日単位の出し分けは「Versionオプション設定 → 日付別」でもできます。※このシステムだけの機能です。',
      style: NOTE_STYLE,
    }),
  )

  // これまでの予約
  const list = el('div')
  const paintList = (): void => {
    list.replaceChildren()
    if (switches.length === 0) return
    list.append(el('div', { text: '予約', style: SECTION_STYLE }))
    for (const sw of switches) {
      list.append(
        switchRow(sw, (target) => {
          void confirmCard({
            title: '予約を取り消しますか？',
            message: `${shortWhen(target.run_at)} の切り替え（${ratiosText(target)}）を取り消します。`,
            submitLabel: '取り消す',
            danger: true,
          }).then(async (ok) => {
            if (!ok) return
            try {
              await api.cancelScheduledSwitch(target.uid)
              switches = (await api.scheduledSwitches(ctx.articleUid)).switches
              paintList()
              toast('予約を取り消しました')
            } catch (error) {
              toast((error as Error).message, 'error')
            }
          })
        }),
      )
    }
  }
  paintList()
  body.append(list)

  // 新しく予約する
  body.append(el('div', { text: '新しく予約する', style: SECTION_STYLE }))
  const when = document.createElement('input')
  when.type = 'datetime-local'
  when.className = 'sbd-input'
  when.min = nowLocalValue()
  body.append(el('div', { text: '切り替える日時（日本時間）', style: `${NOTE_STYLE};margin-bottom:4px` }), when)

  const inputs = new Map<string, HTMLInputElement>()
  const total = el('div', { style: `${NOTE_STYLE};margin-top:6px;text-align:right` })
  const paintTotal = (): void => {
    const sum = [...inputs.values()].reduce((a, i) => a + (Number(i.value) || 0), 0)
    total.textContent = `合計 ${sum}%`
    total.style.color = sum === 100 || sum === 0 ? T.sub : '#C0392B'
  }
  for (const version of versions) {
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '0'
    input.max = '100'
    input.step = '1'
    input.inputMode = 'numeric'
    input.className = 'sbd-input'
    input.style.width = '84px'
    input.value = String(version.distribution_ratio)
    input.addEventListener('input', paintTotal)
    inputs.set(version.uid, input)
    body.append(
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px' }, [
        el('span', { text: version.name, style: `font-size:13px;color:${T.text};min-width:0;overflow-wrap:anywhere` }),
        el('span', { style: 'display:flex;align-items:center;gap:4px;flex-shrink:0' }, [input, el('span', { text: '%', style: NOTE_STYLE })]),
      ]),
    )
  }
  paintTotal()
  body.append(total)

  const submitted = await formCard({
    title: '日時を決めて切り替える',
    body,
    submitLabel: '予約する',
    cancelLabel: '閉じる',
    onSubmit: async () => {
      if (when.value === '') return '切り替える日時を入れてください。'
      const ratios = [...inputs.entries()].map(([uid, input]) => ({
        version_uid: uid,
        ratio: Number(input.value),
      }))
      try {
        await api.createScheduledSwitch(ctx.articleUid, { run_at: when.value, ratios })
        return null
      } catch (error) {
        // 合計が合わない・過去の日時など、サーバーの理由をそのまま出す
        return (error as Error).message
      }
    },
  })
  if (submitted) toast(`${shortWhen(when.value)} に切り替えるよう予約しました`)
}
