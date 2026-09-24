/**
 * 異常のお知らせの設定（2026-09-15・本人の依頼）。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの機能。
 * アカウント設定 → 通知設定 の下に置く（通知の設定はここに集まっているため）。
 *
 * 見張るのは2つだけ:
 *  - CVが止まった（決めた時間ずっと0件。**もともと来ていたページだけ**）
 *  - その日のCPAが上限を超えた
 * どちらもSlack・チャットワーク・LINEへ1通送る。送り先を決めるまでは鳴らさない。
 * 同じページの同じ理由は1日1通まで（2026-09-15に1時間に1回から変更・LINEの無料枠が月200通のため）。
 *
 * 送り先は**何件でも**持てる（「チャットワークとLINEにも飛ばしたい」＝1つでは足りない）。
 * 1行ぶんの中身はタスク画面と同じ部品を使い回す（設定手順・テスト送信もそのまま使える）。
 */
import { T, el, toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { api, type AlertSettings } from '../api.ts'
import { buildNotifyTarget, type NotifyDestination } from '../panels/notify-target.ts'
import { savedTargets } from './alert-targets.ts'
import { buildAlertTestBlock } from './alert-test-block.ts'
import { ensureTaskFormCss } from './task-create.ts'

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

  // 送り先の部品はタスク画面のクラス（.tc-*）で描かれているので、その見た目を先に入れる
  ensureTaskFormCss()

  const section = el('div', { style: 'margin-top:28px' })
  section.append(
    el('div', {
      text: '異常のお知らせ',
      style: `font-size:16px;font-weight:700;color:${T.text};margin-bottom:6px`,
    }),
    el('div', {
      text:
        '※このシステムだけの機能です（実物にはありません）。' +
        'CVが止まったこと・CPAが跳ねたことを見張って、Slack・チャットワーク・LINEへ1通送ります。' +
        '同じページの同じ理由は1日1通までです。送り先を決めるまでは鳴りません。',
      style: `font-size:12px;color:${T.sub};line-height:1.8;margin-bottom:8px`,
    }),
  )

  const testBlock = buildAlertTestBlock()

  /** 変えたらすぐ保存する（保存ボタンを押し忘れて鳴らない、を避ける） */
  const save = (patch: Partial<AlertSettings>): void => {
    void api
      .updateAlertSettings(patch)
      .then((out) => {
        settings = out.settings
        toast('異常のお知らせの設定を保存しました')
        // 入切や送り先が変わると「いま見張っている対象」も変わる
        testBlock.refresh()
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

  // リンク切れ（2026-09-16）
  const linkCheck = document.createElement('input')
  linkCheck.type = 'checkbox'
  linkCheck.checked = settings.link_check
  linkCheck.style.cssText = 'width:18px;height:18px;cursor:pointer'
  linkCheck.addEventListener('change', () => save({ link_check: linkCheck.checked }))
  section.append(
    row(
      'リンクが開けなくなったら知らせる',
      '配信中のページの計測リンク（カート・申込フォーム・ASPなど）を10分おきに確かめます。' +
        '開けなかったら1分後にもう一度確かめ、2回続けて開けなければ知らせます。' +
        'ボット対策で門前払いされた（403など）だけのときは知らせません。' +
        '確かめるときはボットと名乗り、中身を読まない方法（HEAD）で見るので、ASPのクリック数には数えられにくくしています。',
      linkCheck,
    ),
  )

  // 送り先（何件でも）
  const list = el('div', { style: 'display:flex;flex-direction:column;gap:14px' })
  const rows: { host: HTMLElement; target: () => NotifyDestination | null }[] = []

  /** 今ならんでいる送り先をまとめて保存する。決まりきっていない行は入れない。 */
  const saveTargets = (): void => {
    const notify = rows
      .map((r) => r.target())
      .filter((t): t is NotifyDestination => t !== null)
      .map((t) => ({ service: t.service, destination_id: t.id }))
    save({ notify })
  }

  const addRow = (initial: NotifyDestination | null): void => {
    const host = el('div', {
      style: 'display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap',
    })
    // 「通知しない」は出さない。送らないなら行ごと消すほうが分かりやすい。
    const built = buildNotifyTarget({ initial, allowNone: false, onChange: saveTargets })
    const targetEl = built.el
    targetEl.style.flex = '1 1 260px'
    targetEl.style.minWidth = '0'
    const remove = el('button', { class: 'tc-link', text: '消す' })
    remove.style.marginTop = '9px'
    const entry = { host, target: built.target }
    remove.addEventListener('click', () => {
      void (async () => {
        const ok = await confirmCard({
          title: '送り先を消します',
          message: 'この送り先を、異常のお知らせの送り先から外します。',
          detail: '消すとすぐに保存され、この送り先には異常のお知らせが届かなくなります。',
          submitLabel: '消す',
          danger: true,
        })
        if (!ok) return
        rows.splice(rows.indexOf(entry), 1)
        host.remove()
        saveTargets()
      })()
    })
    host.append(targetEl, remove)
    rows.push(entry)
    list.append(host)
  }

  for (const saved of savedTargets(settings.notify)) addRow(saved)

  const addButton = el('button', { class: 'tc-link', text: '＋ 送り先を追加' })
  addButton.addEventListener('click', () => addRow(null))

  const notifyBlock = el('div', { style: 'padding:16px 0' })
  notifyBlock.append(
    el('div', { text: '送り先', style: LABEL_STYLE }),
    el('div', {
      text:
        'Slack・チャットワーク・LINEへ送れます。いくつでも足せます（チャットワークとLINEの両方、など）。' +
        'まだ繋いでいないサービスを選ぶと、その場に手順が出ます。',
      style: `${NOTE_STYLE};margin-bottom:12px`,
    }),
    list,
    addButton,
  )
  section.append(notifyBlock)

  // テスト（見本を送る・いま見張っている対象）
  section.append(testBlock.el)

  content.append(section)
}
