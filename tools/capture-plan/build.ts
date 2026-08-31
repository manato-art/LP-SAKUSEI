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
import { statesFor, GLOBAL_STATES, VIEWPORTS, type RouteKind } from './state-templates.ts'

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
 * 採取に必要なアカウント条件。
 * 基準状態は「新規アカウント（空）」だが、採取係の既存アカウントには実データが入っているため、
 * 空状態はそのままでは観測できない（企画書 §5-7 の観測フロア問題）。
 */
function accountRequirement(route: RouteEntry): string {
  if (route.path.startsWith('/admin')) return 'admin権限のアカウント'
  if (route.path === '/permissions') return '権限差分の確認に第2ロールが必要な可能性あり（§5-7）'
  return '新規アカウント（空）が望ましい。既存アカウントで採る場合は空状態が観測できない点に注意（§5-7）'
}

function main(): void {
  const manifest = JSON.parse(readFileSync(ROUTES_PATH, 'utf8')) as RoutesManifest
  const uiRoutes = manifest.routes.filter((r) => r.is_ui_route)

  const plan = {
    _spec: '企画書 §5-4 capture-plan。基準状態＝新規アカウント（空）＋作成フロー（§1-4）',
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
      const states = statesFor(kind)
      return {
        route: route.path,
        slug: route.slug,
        url: `{APP_BASE}${route.path}`,
        tier: route.tier,
        kind,
        screen: route.screen,
        capture_iframe: route.capture_iframe,
        account_requirement: accountRequirement(route),
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
  console.log(`[capture-plan] ${OUT_PATH} を生成`)
  console.log(`[capture-plan] ルート ${plan.routes.length} / 状態 合計${all}`)
  console.log(`[capture-plan]   priority1（今回採取）: ${p1}状態 → 撮影${shots}枚（pc/sp各1）`)
  console.log(`[capture-plan]   priority2/3（後日）  : ${all - p1}状態`)
}

main()
