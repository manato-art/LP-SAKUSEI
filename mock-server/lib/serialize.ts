/**
 * レスポンス整形（企画書 §10-2 のネスト形状に合わせる）。
 * 例: AbTest は media{attributes{...}} / folder{...} / creator{...} を内包する。
 */
import type { AbTest, Article, State, Version } from '../store/types.ts'

/**
 * 実APIの media は **フラット**（`{id,name,icon_name,ad_cooperation}`）。
 * 企画書 §10-2 の `media.attributes.{...}` というネストは誤り（2026-08-31 実測）。
 */
export function serializeMedia(state: State, mediaId: number | null): unknown {
  const media = state.media.find((m) => m.id === mediaId)
  if (media === undefined) return null
  return {
    id: media.id,
    name: media.name,
    icon_name: media.icon_name,
    ad_cooperation: media.ad_cooperation,
  }
}

export function serializeFolder(state: State, folderId: number | null): unknown {
  const folder = state.folders.find((f) => f.id === folderId)
  if (folder === undefined) return null
  return { id: folder.id, uid: folder.uid, name: folder.name, parent_id: folder.parent_id }
}

/** 実APIの creator は Member よりリッチ（role/権限フラグ/参加状態を含む・実測） */
export function serializeCreator(state: State, memberId: number): unknown {
  const member = state.members.find((m) => m.id === memberId)
  if (member === undefined) return null
  return {
    id: member.id,
    uid: member.uid,
    name: member.name,
    email: member.email,
    role: member.role,
    team_id: member.team_id,
    is_admin_user: member.role === 'admin',
    billing_manager: member.role === 'team-owner',
    joined: true,
    joined_at: 0,
    outside: false,
    created_at: 0,
  }
}

export function serializeAbTest(state: State, abTest: AbTest): Record<string, unknown> {
  return {
    id: abTest.id,
    uid: abTest.uid,
    title: abTest.title,
    memo: abTest.memo,
    team_id: abTest.team_id,
    ad_status: abTest.ad_status,
    editor_version: abTest.editor_version,
    delivery_type: abTest.delivery_type,
    conversion_unit_price: abTest.conversion_unit_price,
    conversion_setting: abTest.conversion_setting,
    affiliate_service_provider: abTest.affiliate_service_provider,
    product_genres: abTest.product_genres,
    // 基本情報タブ「その他の項目」のターゲティング欄（実DOMに実在する3つのselect）
    gender: abTest.gender,
    age_from: abTest.age_from,
    age_to: abTest.age_to,
    reports: null,
    created_at: abTest.created_at,
    updated_at: abTest.updated_at,
    media_id: abTest.media_id,
    folder_id: abTest.folder_id,
    media: serializeMedia(state, abTest.media_id),
    folder: serializeFolder(state, abTest.folder_id),
    creator: serializeCreator(state, abTest.creator_member_id),
  }
}

export function serializeArticle(article: Article): Record<string, unknown> {
  return {
    id: article.id,
    uid: article.uid,
    ab_test_id: article.ab_test_id,
    memo: article.memo,
    archived: article.archived,
    style_applied: article.style_applied,
    created_at: article.created_at,
    updated_timestamp: article.updated_timestamp,
  }
}

export function serializeVersion(version: Version): Record<string, unknown> {
  return {
    id: version.id,
    uid: version.uid,
    article_id: version.article_id,
    name: version.name,
    distribution_ratio: version.distribution_ratio,
    status: version.status,
    is_control: version.is_control,
    html: version.html,
    css: version.css,
    thumbnail_url: version.thumbnail_url,
    created_at: version.created_at,
    updated_at: version.updated_at,
  }
}

/** エディタが叩く versions 一覧は html/css を含む（§10-3） */
export function serializeVersions(versions: readonly Version[]): Record<string, unknown>[] {
  return versions.map(serializeVersion)
}
