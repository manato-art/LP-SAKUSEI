/**
 * 指標の見出しに出す説明（2026-09-15・本人指示
 * 「わかりずらいので、カーソルが当たれば説明を出してほしい」）。
 *
 * FVER / SVER / FSVER / OAR / CTVR / MCPA は略語だけでは何の数字か分からない。
 * 文言は**採取物の aria-label をそのまま**使う（report-columns.ts の title）。
 * 指標ではない列（名前・配信割合など）だけ、ここで補う。
 */
import { REPORT_COLUMNS } from './report-columns.ts'

/** 指標ではない列の説明。実物に文言が無いので、この画面の作りを説明する。 */
const EXTRA_TIPS: Readonly<Record<string, string>> = {
  名前: 'Version名。下にぶら下がるのは、そのVersionに来た広告パラメータです',
  日付: '期間内の1日ぶん。先頭の行は期間の合計です',
  バージョン: 'Version名',
  配信期間: '絞り込みで選んでいる期間',
  アーカイブ: 'アーカイブ済みかどうか',
  デバイス: '配信する端末',
  配信割合: 'そのVersionを何割の人に見せるかの設定',
}

/** 単位つきの見出し（「CTR %」「配信金額 円」）でも引けるよう、先頭の語で見る */
function baseLabel(label: string): string {
  return label.split(' ')[0] ?? label
}

const METRIC_TIPS: Readonly<Record<string, string>> = Object.fromEntries(
  REPORT_COLUMNS.filter((c) => c.title !== undefined).map((c) => [c.label, c.title as string]),
)

/** その見出しの説明。無ければ空文字（空の吹き出しを出さないため） */
export function metricTip(label: string): string {
  const key = baseLabel(label)
  return METRIC_TIPS[key] ?? EXTRA_TIPS[key] ?? ''
}

/** 吹き出しを出している見出しに付くクラス */
export const TIP_OPEN_CLASS = 'rv2-tip-open'

/**
 * 表の見出しに説明を仕込む。
 *
 * 出し入れは `:hover` に任せず自分で持つ。理由は2つ:
 *  - スマホにホバーが無い。押したときも出したい
 *  - ブラウザ標準の `title` は出るまで1秒ほどかかって気づかれない
 * `title` も残す（読み上げと長押し用）。
 */
export function applyMetricTips(table: HTMLElement): void {
  const targets: { el: HTMLElement; label: string }[] = [
    ...[...table.querySelectorAll<HTMLElement>('thead th')].map((el) => ({
      el,
      label: (el.textContent ?? '').trim(),
    })),
    // スマホは列見出しを消して1行＝1カードにするので、セル側にも同じ説明を付ける
    ...[...table.querySelectorAll<HTMLElement>('tbody td[data-label]')].map((el) => ({
      el,
      label: el.dataset['label'] ?? '',
    })),
  ]
  for (const { el: th, label } of targets) {
    const tip = metricTip(label)
    if (tip === '') continue
    th.dataset['tip'] = tip
    th.title = tip
    th.tabIndex = 0
    const show = (on: boolean): void => {
      // 出せるのは1つだけ（別の見出しへ移ったら前のは閉じる）
      if (on) {
        for (const other of document.querySelectorAll(`.${TIP_OPEN_CLASS}`)) {
          other.classList.remove(TIP_OPEN_CLASS)
        }
      }
      th.classList.toggle(TIP_OPEN_CLASS, on)
    }
    th.addEventListener('mouseenter', () => show(true))
    th.addEventListener('mouseleave', () => show(false))
    th.addEventListener('focus', () => show(true))
    th.addEventListener('blur', () => show(false))
    // 指で触ったとき（スマホ）。もう一度押すと閉じる
    th.addEventListener('click', () => show(!th.classList.contains(TIP_OPEN_CLASS)))
  }
}
