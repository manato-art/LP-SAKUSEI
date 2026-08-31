/**
 * 書き込み操作（企画書 §10-9）。すべてイミュータブル（§12）。
 *
 * 「作成 → 一覧に出る → 詳細/エディタで開ける」が一貫して繋がるよう、
 * 関連エンティティと非正規化カウントの整合をここで一括して保つ。
 */
import { makeUid } from './ids.ts'
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

const nowIso = (): string => new Date().toISOString()

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
    created_at: nowIso(),
    updated_at: nowIso(),
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
  const updated: Folder = { ...target, ...patch, updated_at: nowIso() }
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
    uid: makeUid('abTest', nextSeq(state.abTests)),
    title: input.title,
    memo: input.memo,
    media_id: input.media_id,
    folder_id: input.folder_id,
    published: false,
    ad_status: 'none',
    editor_version: 2,
    created_at: nowIso(),
    updated_at: nowIso(),
    creator_member_id: owner?.id ?? 1,
  }
  const article: Article = {
    id: articleId,
    uid: makeUid('article', nextSeq(state.articles)),
    ab_test_id: abTestId,
    memo: '',
    archived: false,
    style_applied: false,
    created_at: nowIso(),
    updated_timestamp: Date.now(),
  }
  const version: Version = {
    id: versionId,
    uid: makeUid('version', nextSeq(state.versions)),
    article_id: articleId,
    name: 'パターンA',
    distribution_ratio: 100,
    status: '準備中',
    is_control: true,
    html: DEFAULT_LP_HTML,
    css: DEFAULT_LP_CSS,
    thumbnail_url: null,
    created_at: nowIso(),
    updated_at: nowIso(),
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

export function updateAbTest(
  state: State,
  uid: string,
  patch: Partial<Pick<AbTest, 'title' | 'memo' | 'media_id' | 'folder_id' | 'ad_status'>>,
): { state: State; abTest: AbTest | null } {
  const target = state.abTests.find((t) => t.uid === uid)
  if (target === undefined) return { state, abTest: null }
  const updated: AbTest = { ...target, ...patch, updated_at: nowIso() }
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
const VERSION_NAMES = ['パターンA', 'パターンB', 'パターンC', 'パターンD', 'パターンE'] as const

export function addVersion(
  state: State,
  articleUid: string,
): { state: State; version: Version | null } {
  const article = state.articles.find((a) => a.uid === articleUid)
  if (article === undefined) return { state, version: null }
  const siblings = state.versions.filter((v) => v.article_id === article.id)
  const id = state.nextId
  const version: Version = {
    id,
    uid: makeUid('version', nextSeq(state.versions)),
    article_id: article.id,
    name: VERSION_NAMES[siblings.length] ?? `パターン${siblings.length + 1}`,
    distribution_ratio: 0,
    status: '準備中',
    is_control: false,
    html: DEFAULT_LP_HTML,
    css: DEFAULT_LP_CSS,
    thumbnail_url: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  return {
    state: { ...state, versions: [...state.versions, version], nextId: id + 1 },
    version,
  }
}

export function updateVersion(
  state: State,
  uid: string,
  patch: Partial<Pick<Version, 'name' | 'html' | 'css' | 'distribution_ratio' | 'status'>>,
): { state: State; version: Version | null } {
  const target = state.versions.find((v) => v.uid === uid)
  if (target === undefined) return { state, version: null }
  const updated: Version = { ...target, ...patch, updated_at: nowIso() }
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
  const updated: Version = { ...target, status, updated_at: nowIso() }
  return {
    state: {
      ...state,
      versions: state.versions.map((v) => (v.uid === uid ? updated : v)),
      abTests: state.abTests.map((t) =>
        t.id === article?.ab_test_id ? { ...t, published: true, updated_at: nowIso() } : t,
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

// ── タスク ───────────────────────────────────────────────
export function createTask(
  state: State,
  input: { title: string; assignee_member_id: number | null; due_at: string | null },
): { state: State; task: Task } {
  const id = state.nextId
  const task: Task = {
    id,
    uid: makeUid('task', nextSeq(state.tasks)),
    team_id: state.teams[0]?.id ?? 1,
    title: input.title,
    assignee_member_id: input.assignee_member_id,
    status: 'todo',
    due_at: input.due_at,
    created_at: nowIso(),
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
    occurred_at: nowIso(),
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
