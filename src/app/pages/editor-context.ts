/**
 * エディタ画面の1インスタンスぶんの状態（editor.ts から分離）。
 *
 * 画面を組み立てる関数群がファイルをまたいで受け渡すので、
 * editor.ts に置いたままだと import が循環する。型だけの独立モジュールにしてある。
 */
import type Quill from 'quill'
import type { Version } from '../api.ts'

export interface EditorContext {
  root: HTMLElement
  quill: Quill
  abTestUid: string
  /** beyondページ（＝基本情報タブ）へのリンクを組み立てるのに要る */
  folderUid: string
  articleUid: string
  /** beyondページのファネルステップ（記事）一覧。`< >` で行き来する（指示⑮） */
  articles: { uid: string }[]
  /** いま開いているステップの index（articles 内） */
  stepIndex: number
  versions: Version[]
  currentUid: string
  /** Versionカードの雛形（採取した実物カードのクリーンなクローン。Versionごとに複製して並べる） */
  cardTemplate: HTMLElement
  /** Version▼の表示モード（通常一覧 / アーカイブ一覧・指示⑮） */
  listMode: 'active' | 'archived'
  /** 「選択してアーカイブする」モード（チェックボックス選択・指示⑮） */
  selectionMode: boolean
}
