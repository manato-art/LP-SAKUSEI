/**
 * 比較モードのプレビューの中身（2026-09-24 全体点検36）。
 *
 * 以前は比較モードだけ独自に本文を包んでいて、LPの基本CSS・Version CSS・LP設定・Widgetの整理が入らず、
 * `*{margin:0;padding:0}` で余白も消えていた＝配信と見た目が違った。
 * サーバーのプレビューと同じ組み立て（mock-server/routes/delivery-preview.ts）で作ったページを使う。
 */
import { editorSessionHeaders } from '../editor-session.ts'

/** 保存済みの中身のプレビュー（帯とポップアップを出さない） */
export function savedPreviewUrl(versionUid: string): string {
  return `/preview/${encodeURIComponent(versionUid)}?bare=1`
}

/** まだ保存していない本文・履歴の本文を、プレビューと同じ見た目のページにする */
export async function previewDocumentFor(versionUid: string, html: string): Promise<string> {
  const res = await fetch(`/api/v1/versions/${encodeURIComponent(versionUid)}/preview_document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...editorSessionHeaders() },
    body: JSON.stringify({ html }),
  })
  const json = (await res.json().catch(() => null)) as { document?: string; error?: { message?: string } } | null
  if (!res.ok || typeof json?.document !== 'string') {
    throw new Error(json?.error?.message ?? `プレビューを作れませんでした (${res.status})`)
  }
  return json.document
}

/** iframe に本文を出す（作れなかったら、その旨を iframe の中に出す） */
export function showInFrame(iframe: HTMLIFrameElement, versionUid: string, html: string): void {
  void previewDocumentFor(versionUid, html).then(
    (doc) => iframe.setAttribute('srcdoc', doc),
    (error: Error) =>
      iframe.setAttribute(
        'srcdoc',
        `<!doctype html><meta charset="utf-8"><p style="font:13px sans-serif;color:#C62828;padding:16px">${error.message.replace(/[<>&]/g, '')}</p>`,
      ),
  )
}
