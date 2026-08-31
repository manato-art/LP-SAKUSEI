/**
 * トレーサビリティ台帳の骨格生成（企画書 §8）。
 *
 *   npx tsx tools/traceability/build.ts
 *
 * 1状態=1行。進捗の正準はこの表。採取結果が入ったら行を足し、各ゲート列を [x] にしていく。
 * 生成物なので手編集しない（チェック列だけは手で進める運用）。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const PLAN_PATH = 'capture/capture-plan.json'
const OUT_PATH = 'docs/traceability.md'

interface PlanState {
  name: string
  priority: 1 | 2 | 3
  note?: string
}

interface PlanRoute {
  route: string
  slug: string
  tier: number
  kind: string
  screen: string | null
  capture_iframe: boolean
  expected_endpoints: string[]
  states: PlanState[]
}

interface Plan {
  routes: PlanRoute[]
}

/** ルート種別 → 参照エンティティ（§10-2） */
const ENTITIES_BY_KIND: Readonly<Record<string, string>> = {
  editor: 'AbTest,Article,Version,Media',
  realtime: 'Conversion,AbTest,Version,Media',
  chat: 'SbAiConversation,SbAiMessage',
  'oauth-callback': 'AdAccount',
  wizard: 'Plan,Team',
  settings: 'Team,Member',
  form: 'Form,Folder',
  static: '—',
  list: 'AbTest,Folder,Report',
}

function entitiesFor(route: PlanRoute): string {
  if (route.route.startsWith('/folders')) return 'Folder,AbTest'
  if (route.route.startsWith('/tasks')) return 'Task,Member'
  if (route.route.startsWith('/inspections')) return 'Inspection,Folder'
  if (route.route.startsWith('/teams/')) return 'Team,Member,AdAccount,Domain,Tag'
  if (route.route.startsWith('/admin')) return 'Team,Plan,Member'
  if (route.route.startsWith('/users/')) return 'User,Team'
  return ENTITIES_BY_KIND[route.kind] ?? '—'
}

/** 残差（§1-2[7]）に該当する状態かを機械判定する */
function residualFor(route: PlanRoute, state: PlanState): string {
  if (route.kind === 'editor' && ['code-editor-open', 'block-library-open', 'text-tool-open'].includes(state.name)) {
    return '1:1 WYSIWYG非対象'
  }
  if (route.route.includes('heatmaps')) return '密度算出は対象外(合成)'
  if (state.name === 'error') return '観測不能→手構築'
  if (state.priority === 3) return 'populated前提・後日'
  return '—'
}

function main(): void {
  const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8')) as Plan

  const header = `# トレーサビリティ台帳（完全再現の計測基盤・正準）

企画書 §8 の正本。**1状態=1行**で全属性を横に持つ。進捗の正準はこの表（個別mdは詳細を持つが、完了判定はここ）。
「完全再現達成」（企画書 §1-2）は、この表で **対象内状態が全数合格・残差が個別列挙** されていることで判定する。

> **このファイルは生成物**（\`npx tsx tools/traceability/build.ts\`）。行の追加・削除は
> \`capture/capture-plan.json\` 側を直してから再生成する。チェック列 \`[ ]→[x]\` だけは手で進める。

## 基準状態（企画書 §1-4）

再現の基準は **新規アカウント発行直後の「まっさら」な空状態**。各ルートの最重要状態は
**empty（0件）＋ creation flow（作成→反映）**。populated（実データ充填）状態は後日の取込フェーズ。
本表の \`必須?\` は priority=1（今回の対象内）を Y としている。

## 列の意味

- route / slug / state_id … §5-3・§7-2 の命名（state_id = \`<slug>__<state>\`）
- screen … 実際にレンダされる画面（route≠画面の是正結果・§6-2）
- endpoints … その状態が叩くモックエンドポイント（§10-3）
- entities … 参照エンティティ（§10-2）
- 必須? … 今回の対象内（priority=1）なら Y
- 採取/再現/視覚/操作 … 各ゲートの合格（[ ]/[x]）
- 残差 … 対象外（§1-2[7]）の場合の理由

## 集計

| | 件数 |
|---|---|
| ルート | ${plan.routes.length} |
| 状態（全priority） | ${plan.routes.reduce((s, r) => s + r.states.length, 0)} |
| **対象内（priority=1・必須）** | **${plan.routes.reduce((s, r) => s + r.states.filter((x) => x.priority === 1).length, 0)}** |
| 残差・後日（priority=2,3） | ${plan.routes.reduce((s, r) => s + r.states.filter((x) => x.priority !== 1).length, 0)} |

`

  const sections = [1, 2, 3, 4].map((tier) => {
    const routes = plan.routes.filter((r) => r.tier === tier)
    const rows = routes.flatMap((route) =>
      route.states.map((state) => {
        const stateId = `${route.slug}__${state.name}`
        const required = state.priority === 1 ? 'Y' : 'N'
        const screen = route.screen ?? route.kind
        const endpoints = route.expected_endpoints.join(' / ')
        const fixture = `capture/clean/${route.slug}/${state.name}/fixtures/`
        const baseline = `capture/clean/${route.slug}/${state.name}/screenshot.png`
        const note = state.note ?? ''
        return `| ${route.route} | ${route.slug} | ${stateId} | ${screen} | ${endpoints} | ${entitiesFor(route)} | ${fixture} | ${baseline} | ${required} | [ ] | [ ] | [ ] | [ ] | ${residualFor(route, state)} | ${note} |`
      }),
    )
    return `## Tier ${tier}（${routes.length}ルート / ${rows.length}状態）

| route | slug | state_id | screen | endpoints | entities | fixture | baseline | 必須? | 採取 | 再現 | 視覚 | 操作 | 残差 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`
  })

  writeFileSync(OUT_PATH, `${header}${sections.join('\n')}`)
  const total = plan.routes.reduce((s, r) => s + r.states.length, 0)
  console.log(`[traceability] ${OUT_PATH} を生成: ${plan.routes.length}ルート / ${total}行`)
}

main()
