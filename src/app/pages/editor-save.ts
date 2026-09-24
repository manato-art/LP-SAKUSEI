/**
 * LP本文の保存（editor-version-list.ts から分けた・2026-09-24 全体点検11と「同時に直したときの上書き」）。
 *
 * - 保存の結果を返す（保存した・空なので保存しなかった・ほかの人が先に保存していた）。
 *   以前は結果を返さず、空で保存をやめたときも見出しは「保存済み」になっていた
 * - 開いたとき（最後に保存したとき）の中身の版を添えて保存する。そのあと別の人・別のタブが保存していたら、
 *   サーバーは上書きせずに相手の中身を返す。ここで「どちらを残すか」を聞く
 */
import { api, type Version } from '../api.ts'
import { chooseCard } from '../dialog.ts'
import { toast } from '../ui.ts'
import type { EditorContext } from './editor-context.ts'
import { buildFullHtml, isEffectivelyEmptyHtml, showVersionContent, splitHeaderFromHtml } from './editor-html.ts'

export type SaveResult = 'saved' | 'nothing' | 'skipped-empty' | 'conflict'

export interface SaveOutcome {
  readonly result: SaveResult
  /** 保存しようとしたVersion（保存のあいだに切り替わっても取り違えないよう、始めた時点のもの） */
  readonly versionUid: string
  readonly html: string
}

/**
 * 🚨データ損失防止: いま中身のあるVersionを「空」で上書きしない（リコンサイルで一瞬空になった本文を保存しない）。
 */
export function isEmptyOverwrite(nextHtml: string, savedHtml: string): boolean {
  return isEffectivelyEmptyHtml(splitHeaderFromHtml(nextHtml).body) && !isEffectivelyEmptyHtml(splitHeaderFromHtml(savedHtml).body)
}

/** 「どちらを残すか」を聞いている最中か（1つのエディタで1枚だけ出す） */
const asking = new WeakSet<EditorContext>()
/** ぶつかったときの相手の中身（見出しの「ほかの人が先に保存しました」を押したら、もう一度聞く） */
const lastConflict = new WeakMap<EditorContext, Version>()

export async function saveHtml(ctx: EditorContext, options: { readonly force?: boolean } = {}): Promise<SaveOutcome> {
  const versionUid = ctx.currentUid
  if (versionUid === '') return { result: 'nothing', versionUid, html: '' }
  const html = buildFullHtml(ctx)
  const saved = ctx.versions.find((x) => x.uid === versionUid)
  if (saved !== undefined && isEmptyOverwrite(html, saved.html)) {
    console.warn('[editor] 空の本文で既存Versionを上書きしようとしたため保存を中止しました:', versionUid)
    return { result: 'skipped-empty', versionUid, html }
  }
  const base = options.force === true ? undefined : saved?.content_revision
  const out = await api.saveVersionContent(versionUid, html, base)
  if (out.conflict) {
    lastConflict.set(ctx, out.version)
    void askWhichToKeep(ctx, out.version)
    return { result: 'conflict', versionUid, html }
  }
  lastConflict.delete(ctx)
  ctx.versions = ctx.versions.map((x) =>
    x.uid === versionUid ? { ...x, html, content_revision: out.version.content_revision } : x,
  )
  return { result: 'saved', versionUid, html }
}

/** 見出しの「ほかの人が先に保存しました」を押したとき（閉じてしまったカードをもう一度出す） */
export function askAgainAboutConflict(ctx: EditorContext): boolean {
  const theirs = lastConflict.get(ctx)
  if (theirs === undefined) return false
  void askWhichToKeep(ctx, theirs)
  return true
}

async function askWhichToKeep(ctx: EditorContext, theirs: Version): Promise<void> {
  if (asking.has(ctx)) return
  asking.add(ctx)
  try {
    const choice = await chooseCard({
      title: 'ほかの人が先に保存しました',
      message: `「${theirs.name}」は、開いたあとに、ほかの人（または別のタブ）が保存しています。どちらを残しますか？`,
      options: [
        { value: 'theirs', label: '相手の内容を読み込む', hint: 'あなたがこのあと直したぶんは消えます' },
        { value: 'mine', label: '自分の内容で上書きする', hint: '相手が直したぶんは消えます' },
      ],
    })
    if (choice === 'theirs') {
      lastConflict.delete(ctx)
      ctx.versions = ctx.versions.map((x) => (x.uid === theirs.uid ? { ...x, ...theirs } : x))
      if (ctx.currentUid === theirs.uid) showVersionContent(ctx, theirs.html)
      ctx.saveStatus?.set('saved')
      toast('相手の内容を読み込みました')
    } else if (choice === 'mine') {
      if (ctx.currentUid !== theirs.uid) return
      const out = await saveHtml(ctx, { force: true })
      if (out.result === 'saved') {
        ctx.saveStatus?.set('saved')
        toast('自分の内容で上書きしました')
      }
    }
  } catch (error) {
    ctx.saveStatus?.set('error')
    toast(`保存できませんでした: ${(error as Error).message}`, 'error')
  } finally {
    asking.delete(ctx)
  }
}
