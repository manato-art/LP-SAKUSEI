/**
 * レポート設定「表示するパラメータ」（歯車から開くモーダル）の読み出し（ab-tests-reports.ts から分離・2026-09-24）。
 *
 * 採取物（capture/clean/ab_tests__UID__reports/report-settings-modal）の表そのまま。
 * 行は6つ固定で、列は クリエイティブ / Branch Operation / ヒートマップ / メモ。
 * 各列はそれぞれ自分の一覧だけを決める:
 *   クリエイティブ     … クリエイティブレポートの広告の一覧
 *   Branch Operation  … Version の下にぶら下がる広告の行
 *   ヒートマップ       … ヒートマップの左の一覧に並ぶ広告
 */
import type { ParameterScope, State } from './types.ts'

export const PARAMETER_SCOPE_NAMES = [
  'utm_medium',
  'utm_source',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_campaign',
] as const

/** 既定は全部ON・メモ空（採取した初期状態）。保存済みの行があればそれを返す。 */
export function parameterScopesOf(state: State, abTestUid: string): ParameterScope[] {
  return PARAMETER_SCOPE_NAMES.map((name) => {
    const saved = state.parameterScopes.find(
      (row) => row.ab_test_uid === abTestUid && row.name === name,
    )
    return (
      saved ?? {
        ab_test_uid: abTestUid,
        name,
        creative: true,
        branch_operation: true,
        heatmap: true,
        description: '',
      }
    )
  })
}

/** `utm_source=fb` の名前の部分（`utm_source`） */
export function parameterNameOf(param: string): string {
  const at = param.indexOf('=')
  return at === -1 ? param : param.slice(0, at)
}
