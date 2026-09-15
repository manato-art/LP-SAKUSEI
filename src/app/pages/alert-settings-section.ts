/**
 * 異常のお知らせの設定（2026-09-15・本人の依頼）。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの機能。
 * アカウント設定 → 通知設定 の下に置く（通知の設定はここに集まっているため）。
 *
 * 見張るのは2つだけ:
 *  - CVが止まった（決めた時間ずっと0件。**もともと来ていたページだけ**）
 *  - その日のCPAが上限を超えた
 * どちらもSlack・チャットワークへ1通送る。送り先を決めるまでは鳴らさない。
 */
import { T, el, toast } from '../ui.ts'
import { api, type AlertSettings } from '../api.ts'

const LABEL_STYLE = `font-size:14px;font-weight:500;color:${T.text}`
const NOTE_STYLE = `font-size:12px;color:${T.sub};margin-top:2px;line-height:1.7`

/** 数値の入力欄（1つの設定ぶん） */
function numberField(
  value: number,
  opts: { min: number; max?: number; suffix: string },
  onChange: (value: number) => void,
): HTMLElement {
  const wrap = el('div', { style: 'display:flex;align-items:center;gap:6px' })
  const input = document.createElement('input')
  input.type = 'number'
  input.value = String(value)
  input.min = String(opts.min)
  if (opts.max !== undefined) input.max = String(opts.max)
  input.style.cssText = `width:110px;padding:7px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font}`
  input.addEventListener('change', () => {
    const next = Number(input.value)
    if (!Number.isFinite(next)) return
    onChange(next)
  })
  wrap.append(input, el('span', { text: opts.suffix, style: `font-size:12px;color:${T.sub}` }))
  return wrap
}

/** 1行（説明＋操作） */
function row(label: string, note: string, control: HTMLElement): HTMLElement {
  const line = el('div', {
    style:
      'display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);flex-wrap:wrap',
  })
  line.append(
    el('div', { style: 'min-width:0;flex:1 1 220px' }, [
      el('div', { text: label, style: LABEL_STYLE }),
      el('div', { text: note, style: NOTE_STYLE }),
    ]),
    control,
  )
  return line
}

/** 異常のお知らせの設定を描く */
export async function mountAlertSettings(content: HTMLElement): Promise<void> {
  let settings: AlertSettings
  try {
    settings = (await api.alertSettings()).settings
  } catch {
    content.append(
      el('div', {
        text: '異常のお知らせの設定を取得できませんでした。',
        style: `font-size:13px;color:${T.sub};margin-top:24px`,
      }),
    )
    return
  }

  const section = el('div', { style: 'margin-top:28px' })
  section.append(
    el('div', {
      text: '異常のお知らせ',
      style: `font-size:16px;font-weight:700;color:${T.text};margin-bottom:6px`,
    }),
    el('div', {
      text:
        '※このシステムだけの機能です（実物にはありません）。' +
        'CVが止まったこと・CPAが跳ねたことを見張って、Slackまたはチャットワークへ1通送ります。' +
        '送り先を決めるまでは鳴りません。',
      style: `font-size:12px;color:${T.sub};line-height:1.8;margin-bottom:8px`,
    }),
  )

  /** 変えたらすぐ保存する（保存ボタンを押し忘れて鳴らない、を避ける） */
  const save = (patch: Partial<AlertSettings>): void => {
    void api
      .updateAlertSettings(patch)
      .then((out) => {
        settings = out.settings
        toast('異常のお知らせの設定を保存しました')
      })
      .catch((error: unknown) => {
        toast(error instanceof Error ? error.message : '保存に失敗しました', 'error')
      })
  }

  // 入／切
  const enabled = document.createElement('input')
  enabled.type = 'checkbox'
  enabled.checked = settings.enabled
  enabled.style.cssText = 'width:18px;height:18px;cursor:pointer'
  enabled.addEventListener('change', () => save({ enabled: enabled.checked }))
  section.append(row('お知らせを使う', '切っているあいだは何も送りません。', enabled))

  // CVが止まった
  section.append(
    row(
      'CVが止まったら知らせる',
      'この時間ずっとCVが0件なら知らせます。もともとCVが来ていないページは知らせません（止まったのではないため）。',
      numberField(settings.cv_silent_hours, { min: 1, max: 72, suffix: '時間' }, (value) =>
        save({ cv_silent_hours: value }),
      ),
    ),
  )

  // CPAの上限
  section.append(
    row(
      'CPAが上限を超えたら知らせる',
      'その日のCPAがこの金額を超えたら知らせます。0にすると見ません。',
      numberField(settings.cpa_limit, { min: 0, suffix: '円' }, (value) =>
        save({ cpa_limit: value }),
      ),
    ),
  )

  // 送り先
  const service = document.createElement('select')
  service.style.cssText = `padding:7px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font}`
  for (const [value, label] of [
    ['slack', 'Slack'],
    ['chatwork', 'チャットワーク'],
  ] as const) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    service.append(option)
  }
  service.value = settings.notify?.service ?? 'slack'
  const destination = document.createElement('input')
  destination.type = 'text'
  destination.placeholder = 'チャンネルID / ルームID'
  destination.value = settings.notify?.destination_id ?? ''
  destination.style.cssText = `width:200px;max-width:100%;padding:7px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font}`
  const applyNotify = (): void => {
    const id = destination.value.trim()
    // 空にしたら「送らない」。半端な設定で鳴らないより、はっきり止める。
    save({ notify: id === '' ? null : { service: service.value as 'slack' | 'chatwork', destination_id: id } })
  }
  service.addEventListener('change', applyNotify)
  destination.addEventListener('change', applyNotify)
  const notifyBox = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' })
  notifyBox.append(service, destination)
  section.append(row('送り先', '外部連携でつないだSlack・チャットワークへ送ります。空にすると送りません。', notifyBox))

  content.append(section)
}
