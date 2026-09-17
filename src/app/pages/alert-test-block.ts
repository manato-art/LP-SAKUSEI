/**
 * 異常のお知らせの「テスト」（2026-09-17・本人の依頼「これのテストしたい」）。
 *
 *  - 見本を送る: CV停止・CPA超え・リンク切れ・予約実行の4種類を「テスト」と明記して1通送る。
 *    本番のページや数字には触れない。お知らせが切でも送れる
 *  - いま見張っている対象: 見張り先が本番のページに向いているかを確かめる
 *    （以前、配信ステータスで判定していて実は何も見張っていなかった）
 */
import { T, el, toast } from '../ui.ts'
import { api, type AlertCoverage } from '../api.ts'

const NOTE_STYLE = `font-size:12px;color:${T.sub};line-height:1.8`

const SERVICE_LABELS: Readonly<Record<string, string>> = {
  line: 'LINE',
  chatwork: 'チャットワーク',
  slack: 'Slack',
}

function coverageLines(c: AlertCoverage): string[] {
  const cv =
    c.cv_pages.length === 0
      ? '対象なし（直近7日にCVがあるページがありません。CVが来ていないページは「止まった」と言いません）'
      : `${c.cv_pages.join('、')}（直近7日にCVがあるページ）`
  const cpa = c.cpa_limit > 0 ? `上限 ${c.cpa_limit.toLocaleString('ja-JP')}円` : '見ていません（上限が0円）'
  const link = !c.link_check
    ? '見ていません（切）'
    : c.link_count === 0
      ? '対象なし（直近7日に見られているページに計測リンクがありません）'
      : `${c.link_pages}ページ・計測リンク${c.link_count}本`
  return [
    `・CVが止まったら … ${cv}`,
    `・CPAが上限を超えたら … ${cpa}`,
    `・リンク切れ … ${link}`,
    `・予約した切り替え … これからの予約 ${c.pending_switches}件`,
  ]
}

/** テストのまとまりを作る。設定を変えたら refresh() で見張り対象を取り直す */
export function buildAlertTestBlock(): { el: HTMLElement; refresh: () => void } {
  const block = el('div', { style: 'padding:16px 0;border-top:1px solid var(--sb-c-f2f2f2, #F2F2F2)' })
  const send = el('button', { class: 'tc-submit', text: '見本を送る' })
  send.style.marginTop = '8px'

  const coverage = el('div', { style: `${NOTE_STYLE};margin-top:12px` })
  const refresh = (): void => {
    void api.alertCoverage().then(
      (c) => {
        coverage.replaceChildren(
          el('div', { text: 'いま見張っている対象', style: `font-size:13px;font-weight:600;color:${T.text}` }),
          ...coverageLines(c).map((line) => el('div', { text: line })),
          ...(c.enabled
            ? []
            : [el('div', { text: '※「お知らせを使う」が切のあいだは、どれも鳴りません。', style: 'color:#C0392B' })]),
          ...(c.destinations > 0
            ? []
            : [el('div', { text: '※送り先がまだありません。', style: 'color:#C0392B' })]),
        )
      },
      () => coverage.replaceChildren(el('div', { text: '見張っている対象を読めませんでした。' })),
    )
  }

  send.addEventListener('click', () => {
    send.setAttribute('disabled', '')
    void api.alertTest().then(
      (out) => {
        send.removeAttribute('disabled')
        if (out.failures.length === 0) {
          toast(`見本を送りました（${out.sent}か所）。届いているか確認してください`)
          return
        }
        const reasons = out.failures.map((f) => `${SERVICE_LABELS[f.service] ?? f.service}: ${f.message}`).join(' ／ ')
        toast(`送れなかった送り先があります。${reasons}`, 'error')
      },
      (error: Error) => {
        send.removeAttribute('disabled')
        toast(error.message, 'error')
      },
    )
  })

  block.append(
    el('div', { text: 'テスト', style: `font-size:14px;font-weight:500;color:${T.text}` }),
    el('div', {
      text:
        'お知らせが条件に当たったときにどう届くかの見本を、「テスト」と明記して1通にまとめて送ります' +
        '（CVが止まった・CPA超え・リンク切れ・予約の実行の4種類）。本番のページや数字には触れません。' +
        'お知らせが切でも送れます。LINEは1回につき1通ぶん枠を使います。',
      style: NOTE_STYLE,
    }),
    send,
    coverage,
  )
  refresh()
  return { el: block, refresh }
}
