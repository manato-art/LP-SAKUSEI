/**
 * 書き込み操作（企画書 §10-9）。すべてイミュータブル（§12）。
 *
 * 「作成 → 一覧に出る → 詳細/エディタで開ける」が一貫して繋がるよう、
 * 関連エンティティと非正規化カウントの整合をここで一括して保つ。
 */
import { hashString } from './rng.ts'
import { currentTeamId } from './current-team.ts'
import { makeAbTestUid, makeUid } from './ids.ts'
import { DEFAULT_LP_CSS, DEFAULT_LP_HTML } from './lp-template.ts'
import { toDateKey } from './metrics.ts'
import type {
  AbTest,
  Article,
  Conversion,
  Folder,
  State,
  Task,
  Version,
  VersionStatus,
} from './types.ts'

/** 実APIは created_at/updated_at を数値（UNIXタイムスタンプ・秒）で返す（実測） */
const nowTs = (): number => Math.floor(Date.now() / 1000)

/** そのコレクションの通し番号（uidの連番に使う） */
function nextSeq(items: readonly unknown[]): number {
  return items.length + 1
}

// ── フォルダ ─────────────────────────────────────────────
export interface CreateFolderInput {
  name: string
  parent_id: number | null
}

export function createFolder(
  state: State,
  input: CreateFolderInput,
): { state: State; folder: Folder } {
  const id = state.nextId
  const team = state.teams[0]
  const folder: Folder = {
    id,
    team_id: team?.id ?? 1,
    uid: makeUid('folder', nextSeq(state.folders)),
    name: input.name,
    parent_id: input.parent_id,
    ab_tests_count: 0,
    is_favorite: false,
    created_at: nowTs(),
    updated_at: nowTs(),
  }
  return { state: { ...state, folders: [...state.folders, folder], nextId: id + 1 }, folder }
}

export function updateFolder(
  state: State,
  uid: string,
  patch: Partial<Pick<Folder, 'name' | 'parent_id'>>,
): { state: State; folder: Folder | null } {
  const target = state.folders.find((f) => f.uid === uid)
  if (target === undefined) return { state, folder: null }
  const updated: Folder = { ...target, ...patch, updated_at: nowTs() }
  return {
    state: { ...state, folders: state.folders.map((f) => (f.uid === uid ? updated : f)) },
    folder: updated,
  }
}

/** フォルダ削除。配下のbeyondページは folder_id を null にして残す（孤児にしない） */
export function deleteFolder(state: State, uid: string): { state: State; deleted: boolean } {
  const target = state.folders.find((f) => f.uid === uid)
  if (target === undefined) return { state, deleted: false }
  return {
    state: {
      ...state,
      folders: state.folders.filter((f) => f.uid !== uid),
      abTests: state.abTests.map((t) =>
        t.folder_id === target.id ? { ...t, folder_id: null } : t,
      ),
    },
    deleted: true,
  }
}

// ── beyondページ（AbTest）＋ 記事 ＋ 初期Version ──────────────
export interface CreateAbTestInput {
  title: string
  memo: string
  folder_id: number | null
  media_id: number | null
  /** 2=beyondエディター（既定） / 3=HTMLエディター。作成後は変更不可（実機確認） */
  editor_version?: number
  conversion_condition?: 'click' | 'access'
  conversion_unit_price?: number
}

/**
 * beyondページ作成は、記事1件と初期Version（パターンA・配信割合100%）を同時に作る。
 * これにより作成直後にエディタ（/ab_tests/:uid/articles）が開ける。
 */
export function createAbTest(
  state: State,
  input: CreateAbTestInput,
): { state: State; abTest: AbTest; article: Article; version: Version } {
  const abTestId = state.nextId
  const articleId = abTestId + 1
  const versionId = abTestId + 2
  const team = state.teams[0]
  const owner = state.members[0]

  const abTest: AbTest = {
    id: abTestId,
    team_id: team?.id ?? 1,
    // AbTestのuidは18文字の短縮ID（Folderのuuidとは別形式・実機確認）
    uid: makeAbTestUid(nextSeq(state.abTests)),
    title: input.title,
    memo: input.memo,
    media_id: input.media_id,
    folder_id: input.folder_id,
    ad_status: 'prepared',
    editor_version: input.editor_version ?? 2,
    delivery_type: 'same_url',
    conversion_unit_price: input.conversion_unit_price ?? 0,
    conversion_setting: { id: abTestId, conversion_condition: input.conversion_condition ?? 'click' },
    affiliate_service_provider: null,
    product_genres: [],
    gender: null,
    age_from: null,
    age_to: null,
    created_at: nowTs(),
    updated_at: nowTs(),
    creator_member_id: owner?.id ?? 1,
  }
  const article: Article = {
    id: articleId,
    uid: makeUid('article', nextSeq(state.articles)),
    ab_test_id: abTestId,
    memo: '',
    archived: false,
    style_applied: false,
    created_at: nowTs(),
    updated_timestamp: Date.now(),
  }
  const version: Version = {
    id: versionId,
    uid: makeUid('version', nextSeq(state.versions)),
    article_id: articleId,
    name: generateVersionName(nextSeq(state.versions)),
    // 実機の新規作成直後の配信割合は 1（100ではない）
    distribution_ratio: 1,
    status: '準備中',
    is_control: true,
    archived: false,
    html: DEFAULT_LP_HTML,
    css: DEFAULT_LP_CSS,
    thumbnail_url: null,
    created_at: nowTs(),
    updated_at: nowTs(),
  }

  return {
    state: {
      ...state,
      abTests: [...state.abTests, abTest],
      articles: [...state.articles, article],
      versions: [...state.versions, version],
      folders: state.folders.map((f) =>
        f.id === input.folder_id ? { ...f, ab_tests_count: f.ab_tests_count + 1 } : f,
      ),
      nextId: versionId + 1,
    },
    abTest,
    article,
    version,
  }
}

/**
 * 更新できる項目。基本情報タブ（`/folders/:uid/ab_tests/:uid/edit`）の実フォームに合わせて広げてある。
 * `editor_version` は実機で disabled（「後から変更できません」）なので**含めない**。
 */
export type AbTestUpdatePatch = Partial<
  Pick<
    AbTest,
    | 'title'
    | 'memo'
    | 'media_id'
    | 'folder_id'
    | 'ad_status'
    | 'delivery_type'
    | 'conversion_unit_price'
    | 'conversion_setting'
    | 'affiliate_service_provider'
    | 'gender'
    | 'age_from'
    | 'age_to'
  >
>

export function updateAbTest(
  state: State,
  uid: string,
  patch: AbTestUpdatePatch,
): { state: State; abTest: AbTest | null } {
  const target = state.abTests.find((t) => t.uid === uid)
  if (target === undefined) return { state, abTest: null }
  const updated: AbTest = { ...target, ...patch, updated_at: nowTs() }
  const folderChanged = patch.folder_id !== undefined && patch.folder_id !== target.folder_id
  return {
    state: {
      ...state,
      abTests: state.abTests.map((t) => (t.uid === uid ? updated : t)),
      folders: folderChanged
        ? state.folders.map((f) => {
            if (f.id === target.folder_id) return { ...f, ab_tests_count: f.ab_tests_count - 1 }
            if (f.id === patch.folder_id) return { ...f, ab_tests_count: f.ab_tests_count + 1 }
            return f
          })
        : state.folders,
    },
    abTest: updated,
  }
}

export function deleteAbTest(state: State, uid: string): { state: State; deleted: boolean } {
  const target = state.abTests.find((t) => t.uid === uid)
  if (target === undefined) return { state, deleted: false }
  const articleIds = state.articles.filter((a) => a.ab_test_id === target.id).map((a) => a.id)
  return {
    state: {
      ...state,
      abTests: state.abTests.filter((t) => t.uid !== uid),
      articles: state.articles.filter((a) => a.ab_test_id !== target.id),
      versions: state.versions.filter((v) => !articleIds.includes(v.article_id)),
      redirectPages: state.redirectPages.filter((r) => r.ab_test_id !== target.id),
      exitPopups: state.exitPopups.filter((p) => p.ab_test_id !== target.id),
      splitTestSettings: state.splitTestSettings.filter((s) => s.ab_test_id !== target.id),
      conversions: state.conversions.filter((c) => c.ab_test_uid !== target.uid),
      metrics: state.metrics.filter((m) => m.entity_uid !== target.uid),
      folders: state.folders.map((f) =>
        f.id === target.folder_id ? { ...f, ab_tests_count: Math.max(0, f.ab_tests_count - 1) } : f,
      ),
    },
    deleted: true,
  }
}

// ── Version（追加 / 配信割合 / LP編集 / 公開）─────────────────
/**
 * 実機ではVersion名は `Ver.` + 4桁のランダム数字で自動採番される（例 `Ver.3872`）。
 * 企画書の「パターンA/B/C」は誤り。決定論を保つため seed から生成する。
 */
function generateVersionName(seq: number): string {
  const n = 1000 + (hashString(`version-name|${seq}`) % 9000)
  return `Ver.${n}`
}

export function addVersion(
  state: State,
  articleUid: string,
): { state: State; version: Version | null } {
  const article = state.articles.find((a) => a.uid === articleUid)
  if (article === undefined) return { state, version: null }
  const id = state.nextId
  const version: Version = {
    id,
    uid: makeUid('version', nextSeq(state.versions)),
    article_id: article.id,
    name: generateVersionName(state.versions.length + 1),
    distribution_ratio: 0,
    status: '準備中',
    is_control: false,
    archived: false,
    html: DEFAULT_LP_HTML,
    css: DEFAULT_LP_CSS,
    thumbnail_url: null,
    created_at: nowTs(),
    updated_at: nowTs(),
  }
  return {
    state: { ...state, versions: [...state.versions, version], nextId: id + 1 },
    version,
  }
}

/**
 * Version複製。元Versionの html/css を引き継いで新Versionを作り、**元の直後**に挿入する
 * （実物の「すぐ下に複製」に倣った並び）。配信割合・コントロール・状態は addVersion と同じ既定
 * （0 / 非コントロール / 準備中）に落とす＝合計100%を壊さない。
 */
export function duplicateVersion(
  state: State,
  uid: string,
): { state: State; version: Version | null } {
  const index = state.versions.findIndex((v) => v.uid === uid)
  const source = state.versions[index]
  if (source === undefined) return { state, version: null }
  const id = state.nextId
  const copy: Version = {
    ...source,
    id,
    uid: makeUid('version', nextSeq(state.versions)),
    name: generateVersionName(state.versions.length + 1),
    distribution_ratio: 0,
    is_control: false,
    status: '準備中',
    thumbnail_url: null,
    created_at: nowTs(),
    updated_at: nowTs(),
  }
  const versions = [
    ...state.versions.slice(0, index + 1),
    copy,
    ...state.versions.slice(index + 1),
  ]
  return { state: { ...state, versions, nextId: id + 1 }, version: copy }
}

export function updateVersion(
  state: State,
  uid: string,
  patch: Partial<Pick<Version, 'name' | 'html' | 'css' | 'distribution_ratio' | 'status'>>,
): { state: State; version: Version | null } {
  const target = state.versions.find((v) => v.uid === uid)
  if (target === undefined) return { state, version: null }
  const updated: Version = { ...target, ...patch, updated_at: nowTs() }
  return {
    state: { ...state, versions: state.versions.map((v) => (v.uid === uid ? updated : v)) },
    version: updated,
  }
}

/** 公開（§9-1[4]）: Version status を「公開中」へ。AbTest.published も立てる。 */
export function publishVersion(
  state: State,
  uid: string,
): { state: State; version: Version | null } {
  const target = state.versions.find((v) => v.uid === uid)
  if (target === undefined) return { state, version: null }
  const article = state.articles.find((a) => a.id === target.article_id)
  const status: VersionStatus = '公開中'
  void status
  const updated: Version = { ...target, status, updated_at: nowTs() }
  return {
    state: {
      ...state,
      versions: state.versions.map((v) => (v.uid === uid ? updated : v)),
      abTests: state.abTests.map((t) =>
        t.id === article?.ab_test_id ? { ...t, ad_status: 'delivered' as const, updated_at: nowTs() } : t,
      ),
    },
    version: updated,
  }
}

export function deleteVersion(state: State, uid: string): { state: State; deleted: boolean } {
  const target = state.versions.find((v) => v.uid === uid)
  if (target === undefined) return { state, deleted: false }
  return {
    state: {
      ...state,
      versions: state.versions.filter((v) => v.uid !== uid),
      conversions: state.conversions.filter((c) => c.version_uid !== uid),
      metrics: state.metrics.filter((m) => m.entity_uid !== uid),
    },
    deleted: true,
  }
}

/**
 * Versionをアーカイブする（Version一覧の「アーカイブ」タブへ移す）。
 * FAQ:「アーカイブする際には、配信割合が1以上のVersionがbeyondページ内に存在している必要がある」
 * ＝アーカイブ後も、非アーカイブで配信割合>=1のVersionが最低1つ残ることを条件にする。
 */
export function archiveVersion(
  state: State,
  uid: string,
): { state: State; version: Version | null; reason?: string } {
  const target = state.versions.find((v) => v.uid === uid)
  if (target === undefined) return { state, version: null, reason: 'notfound' }
  const siblings = state.versions.filter(
    (v) => v.article_id === target.article_id && v.uid !== uid && !v.archived,
  )
  const hasActiveLeft = siblings.some((v) => v.distribution_ratio >= 1)
  if (!hasActiveLeft) {
    return { state, version: null, reason: 'need-active' }
  }
  const updated: Version = { ...target, archived: true, distribution_ratio: 0, updated_at: nowTs() }
  return {
    state: { ...state, versions: state.versions.map((v) => (v.uid === uid ? updated : v)) },
    version: updated,
  }
}

// ── タスク ───────────────────────────────────────────────
export function createTask(
  state: State,
  input: { title: string; assignee_member_id: number | null; due_at: string | null },
): { state: State; task: Task } {
  const id = state.nextId
  const task: Task = {
    id,
    uid: makeUid('task', nextSeq(state.tasks)),
    team_id: currentTeamId(state),
    title: input.title,
    assignee_member_id: input.assignee_member_id,
    status: 'todo',
    due_at: input.due_at,
    created_at: nowTs(),
  }
  return { state: { ...state, tasks: [...state.tasks, task], nextId: id + 1 }, task }
}

export function updateTask(
  state: State,
  uid: string,
  patch: Partial<Pick<Task, 'title' | 'status' | 'assignee_member_id' | 'due_at'>>,
): { state: State; task: Task | null } {
  const target = state.tasks.find((t) => t.uid === uid)
  if (target === undefined) return { state, task: null }
  const updated: Task = { ...target, ...patch }
  return {
    state: { ...state, tasks: state.tasks.map((t) => (t.uid === uid ? updated : t)) },
    task: updated,
  }
}

// ── コンバージョン（CV速報が積む・§10-9「ダミーの流入が乗ると数値が付く」）──
export function recordConversion(
  state: State,
  input: { ab_test_uid: string; version_uid: string; media_id: number | null; amount: number },
): { state: State; conversion: Conversion } {
  const id = state.nextId
  const conversion: Conversion = {
    id,
    uid: makeUid('conversion', nextSeq(state.conversions)),
    ab_test_uid: input.ab_test_uid,
    version_uid: input.version_uid,
    media_id: input.media_id,
    amount: input.amount,
    occurred_at: nowTs(),
    status: '承認',
  }
  const date = toDateKey(new Date())
  return {
    state: {
      ...state,
      conversions: [conversion, ...state.conversions],
      metrics: bumpMetric(state, input.ab_test_uid, 'ab_test', date, {
        cv: 1,
        sales: input.amount,
      }),
      nextId: id + 1,
    },
    conversion,
  }
}

/** 日次メトリクスに加算（無ければ作る）。一次値だけを持ち、派生は metrics.ts の恒等式で算出する。 */
export function bumpMetric(
  state: State,
  entityUid: string,
  scope: 'ab_test' | 'version',
  date: string,
  delta: Partial<{ pv: number; click: number; cv: number; ad_cost: number; sales: number }>,
): State['metrics'] {
  const index = state.metrics.findIndex(
    (m) => m.entity_uid === entityUid && m.scope === scope && m.date === date,
  )
  if (index === -1) {
    return [
      ...state.metrics,
      {
        entity_uid: entityUid,
        scope,
        date,
        pv: delta.pv ?? 0,
        click: delta.click ?? 0,
        cv: delta.cv ?? 0,
        ad_cost: delta.ad_cost ?? 0,
        sales: delta.sales ?? 0,
      },
    ]
  }
  return state.metrics.map((m, i) =>
    i === index
      ? {
          ...m,
          pv: m.pv + (delta.pv ?? 0),
          click: m.click + (delta.click ?? 0),
          cv: m.cv + (delta.cv ?? 0),
          ad_cost: m.ad_cost + (delta.ad_cost ?? 0),
          sales: m.sales + (delta.sales ?? 0),
        }
      : m,
  )
}
