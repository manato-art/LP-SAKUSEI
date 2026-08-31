/**
 * capture-plan.json の生成（企画書 §5-4）。
 *
 *   npx tsx tools/capture-plan/build.ts
 *
 * 採取係の拡張はこの計画を上から実行し、各stateで dom/computed/har/screenshot を保存する。
 * 基準状態が「新規アカウント（空）＋作成フロー」（§1-4）なので、priority=1 を今回の採取範囲とする。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  statesFor,
  GLOBAL_STATES,
  VIEWPORTS,
  type CaptureMode,
  type RouteKind,
  type StateTemplate,
} from './state-templates.ts'

const ROUTES_PATH = 'docs/routes.json'
const OUT_PATH = 'capture/capture-plan.json'

interface RouteEntry {
  path: string
  group: string
  note: string
  tier: number
  slug: string
  is_ui_route: boolean
  params: string[]
  screen: string | null
  capture_iframe: boolean
}

interface RoutesManifest {
  routes: RouteEntry[]
}

/** ルート種別の判定。明示指定 > パターン判定。 */
const EXPLICIT_KIND: Readonly<Record<string, RouteKind>> = {
  '/ab_tests/:ab_test_uid/articles': 'editor',
  '/folders/:folder_uid/ab_tests/:ab_test_uid/edit': 'editor',
  '/conversions': 'realtime',
  '/sb_ai/chat': 'chat',
  '/sb_ai/chat/:conversationId': 'chat',
  '/sb_ai': 'chat',
  '/plans/:planUid/payment/checkout': 'wizard',
  '/users/sign_up': 'wizard',
  '/terms': 'static',
  '/introductions': 'static',
  '/seminar': 'static',
  '/permissions': 'static',
  '*': 'static',
}

function kindFor(route: RouteEntry): RouteKind {
  const explicit = EXPLICIT_KIND[route.path]
  if (explicit !== undefined) return explicit
  if (route.path.startsWith('/redirections/')) return 'oauth-callback'
  if (route.path.startsWith('/settings/')) return 'settings'
  if (route.path.endsWith('/edit') || route.path.includes('/forms/')) return 'form'
  if (route.path.startsWith('/users/')) return 'form'
  if (route.path.includes('split_test_settings')) return 'settings'
  if (route.path.includes('/reports') || route.path.includes('report')) return 'list'
  return 'list'
}

/** そのルートが叩くと想定されるモックエンドポイント（§10-3 と突合するための期待値） */
function expectedEndpoints(route: RouteEntry): string[] {
  const p = route.path
  if (p === '/' || p.startsWith('/dashboard')) {
    return ['GET /teams/dashboard', 'GET /ab_tests/rankings', 'GET /teams/version-rankings']
  }
  if (p === '/ab_tests/:ab_test_uid/articles' || p.endsWith('/ab_tests/:ab_test_uid/edit')) {
    return ['GET /ab_tests/:uid', 'GET /ab_tests/:uid/articles', 'GET /articles/:uid/versions']
  }
  if (p === '/folders') return ['GET /folders']
  if (p === '/conversions') return ['GET /conversions', 'WS ConversionsChannel']
  if (p.includes('split_test_settings')) return ['GET /ab_tests/:uid/split_test_settings/:type']
  if (p.startsWith('/teams/')) return [`GET ${p}`]
  return [`GET ${p}`]
}

/**
 * ルートのデータスコープ。空状態が観測できるかを決める（企画書 §5-7 観測フロア）。
 *
 *   entity    … `:uid` 配下。**新しいエンティティを作れば、その配下は空**なので空状態を観測できる
 *   account   … アカウント全体の一覧。既存アカウントには実データがあるので空にできない
 *   stateless … 設定/認証/OAuth/静的。データ量に依らず見た目が同じなので空状態の問題が無い
 */
export type RouteScope = 'entity' | 'account' | 'stateless'

const STATELESS_KINDS: readonly RouteKind[] = ['settings', 'oauth-callback', 'static', 'wizard']

function scopeFor(route: RouteEntry, kind: RouteKind): RouteScope {
  if (/^\/(ab_tests|folders)\/:/.test(route.path)) return 'entity'
  if (route.path.startsWith('/users/')) return 'stateless'
  if (STATELESS_KINDS.includes(kind)) return 'stateless'
  return 'account'
}

/**
 * スコープに応じて空状態の採取手段を上書きする。
 * account スコープの empty は本番からは原理的に撮れないので hand-built へ落とす。
 */
function applyScope(states: readonly StateTemplate[], scope: RouteScope): StateTemplate[] {
  return states.map((state) => {
    if (state.name !== 'empty') return { ...state }
    if (scope === 'entity') {
      return {
        ...state,
        capture_mode: 'write-production' as CaptureMode,
        interactions: ['採取用エンティティを新規作成してから開く'],
        note: '新規作成したエンティティ配下は空なので、既存アカウントでも空状態を観測できる',
      }
    }
    if (scope === 'account') {
      return {
        ...state,
        capture_mode: 'hand-built' as CaptureMode,
        note:
          'アカウント全体の一覧。既存アカウントには実データがあるため空にできない（§5-7）。' +
          '代替として filter-empty（一致しない語で検索した空結果）を撮り、同じ空状態コンポーネントを流用する。',
      }
    }
    return { ...state }
  })
}

/**
 * 採取に必要なアカウント条件。
 * 基準状態は「新規アカウント（空）」だが、採取係の既存アカウントには実データが入っているため、
 * 空状態はそのままでは観測できない（企画書 §5-7 の観測フロア問題）。
 */
function accountRequirement(route: RouteEntry, scope: RouteScope): string {
  if (route.path.startsWith('/admin')) return 'admin権限のアカウント（無ければ採取不能→手構築）'
  if (route.path === '/permissions') return '権限差分の確認には第2ロールが必要（§5-7）'
  if (scope === 'entity') return '既存アカウントで可。採取用エンティティを新規作成して撮る'
  if (scope === 'account') return '既存アカウントで可。ただし空状態だけは手構築（§5-7）'
  return '既存アカウントで可（データ量に依存しない画面）'
}

function main(): void {
  const manifest = JSON.parse(readFileSync(ROUTES_PATH, 'utf8')) as RoutesManifest
  const uiRoutes = manifest.routes.filter((r) => r.is_ui_route)

  const plan = {
    _spec: '企画書 §5-4 capture-plan。基準状態＝新規アカウント（空）＋作成フロー（§1-4）',
    _account_constraint:
      '採取に使えるのは実データ入りの既存アカウントのみ（新規アカウントは発行不可）。' +
      'よって各stateに capture_mode を持たせた: read-only=見るだけ / ' +
      'write-production=本番に採取用エンティティを作ってから撮る（要承認・後始末必須） / ' +
      'hand-built=本番からは観測不能なので実CSS＋データモデルから手構築（§5-7(b)）',
    _production_write_warning:
      'write-production の状態は本番アカウントに実レコードを作る。公開(publish)は実LPが' +
      '外部公開されうるため、確認ダイアログの見た目までを撮り、確定は押さないこと。',
    _usage:
      'priority=1 の state を今回の採取範囲とする。priority=3 は populated 前提のため後日の実データ取込フェーズ。',
    _app_base:
      '{APP_BASE} は採取係が自分の環境で置換する（本番ドメインをこのファイルに書かない・§3-2）',
    _capture_output:
      '各stateで dom.html / iframe.html(該当時) / computed.json / screenshot.png / network.har / fixtures/*.json を隔離ディレクトリへ保存（§5-1[1]）',
    generated_from: ROUTES_PATH,
    route_count: uiRoutes.length,
    viewports: VIEWPORTS,
    global_states: GLOBAL_STATES,
    routes: uiRoutes.map((route) => {
      const kind = kindFor(route)
      const scope = scopeFor(route, kind)
      const states = applyScope(statesFor(kind), scope)
      return {
        route: route.path,
        slug: route.slug,
        url: `{APP_BASE}${route.path}`,
        tier: route.tier,
        kind,
        scope,
        screen: route.screen,
        capture_iframe: route.capture_iframe,
        account_requirement: accountRequirement(route, scope),
        expected_endpoints: expectedEndpoints(route),
        params: route.params,
        states,
        priority1_count: states.filter((s) => s.priority === 1).length,
        // 各stateを全ビューポートで撮るので、撮影枚数 = states × viewports
        priority1_shots: states.filter((s) => s.priority === 1).length * VIEWPORTS.length,
      }
    }),
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, `${JSON.stringify(plan, null, 2)}\n`)

  const p1 = plan.routes.reduce((sum, r) => sum + r.priority1_count, 0)
  const all = plan.routes.reduce((sum, r) => sum + r.states.length, 0)
  const shots = plan.routes.reduce((sum, r) => sum + r.priority1_shots, 0)
  const byMode = plan.routes
    .flatMap((r) => r.states.filter((s) => s.priority === 1))
    .reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.capture_mode]: (acc[s.capture_mode] ?? 0) + 1 }), {})
  console.log(`[capture-plan] ${OUT_PATH} を生成`)
  console.log(`[capture-plan] ルート ${plan.routes.length} / 状態 合計${all}`)
  console.log(`[capture-plan]   priority1（今回採取）: ${p1}状態 → 撮影${shots}枚（pc/sp各1）`)
  console.log(`[capture-plan]   priority2/3（後日）  : ${all - p1}状態`)
  console.log('[capture-plan] priority1 の採取手段別内訳:')
  console.log(`[capture-plan]   read-only（見るだけ）        : ${byMode['read-only'] ?? 0}`)
  console.log(`[capture-plan]   write-production（本番に作る）: ${byMode['write-production'] ?? 0}  ← 要承認`)
  console.log(`[capture-plan]   hand-built（手構築）          : ${byMode['hand-built'] ?? 0}`)
  console.log(`[capture-plan] スコープ別: entity=${plan.routes.filter((r) => r.scope === 'entity').length} account=${plan.routes.filter((r) => r.scope === 'account').length} stateless=${plan.routes.filter((r) => r.scope === 'stateless').length}`)
}

main()
