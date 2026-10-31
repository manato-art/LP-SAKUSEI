/**
 * ポップアップの編集画面の「どのタブに何を置くか」の表（2026-10-31 本人「なんか表示されている部分が一貫していなくて
 * 使い勝手が悪い」→ 案A「3種類を同じ型に」・本人の選択「タブは今の5つに合わせる」）。
 *
 * 離脱防止・表示直後・追従型の3つの編集画面は、この表から作る（exit-popup-editor-tabs.ts / exit-popup-follow-tabs.ts）。
 * その種類で使えない設定は隠さずに薄く出して、どの種類で使えるかを書く（どの種類でも、同じ所を見れば見つかる）。
 * 設定を足すときは、この表に1行足す（3種類に出る。足し忘れは tests/popup-editor-layout.test.ts が止める）。
 */
import { el } from '../ui.ts'

export type PopupKind = 'exit' | 'instant' | 'follow'
export type EditorTab = 'basic' | 'display' | 'position' | 'device' | 'code'

export const EDITOR_TABS: readonly { id: EditorTab; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'display', label: '表示' },
  { id: 'position', label: '位置' },
  { id: 'device', label: '出し分け' },
  // 中身の HTML は「中身を編集」で直す。ここは動き（JavaScript）など
  { id: 'code', label: 'コード' },
]

export const KIND_LABEL: Readonly<Record<PopupKind, string>> = { exit: '離脱防止', instant: '表示直後', follow: '追従型' }

export type SettingKey =
  | 'visit_count' | 'action' | 'link' | 'phone' | 'tracking_urls'
  | 'animation' | 'delay' | 'scroll' | 'countdown' | 'back_button' | 'exit_intent' | 'close_button'
  | 'position' | 'device' | 'code'

export interface SettingRow {
  readonly key: SettingKey
  readonly tab: EditorTab
  readonly label: string
  /** 使える種類 */
  readonly kinds: readonly PopupKind[]
  /** 使えない種類で出す説明（無ければ「〇〇で使えます」） */
  readonly offNote?: string
}

const ALL: readonly PopupKind[] = ['exit', 'instant', 'follow']
const BOX: readonly PopupKind[] = ['exit', 'instant']

/** 移行先URLの欄の名前（押したら移る先は、どこでもこの名前・popup-link-field.ts） */
export const LINK_LABEL = '移行先URL（押したときに移る先）'

export const POPUP_SETTINGS: readonly SettingRow[] = [
  { key: 'visit_count', tab: 'basic', label: '訪問回数', kinds: BOX },
  {
    key: 'action', tab: 'basic', label: 'ポップアップを押したときの動作', kinds: BOX,
    offNote: '追従型は、押すと下の移行先URLへ移ります（LPに戻る・電話をかけるは、離脱防止・表示直後で使えます）',
  },
  { key: 'link', tab: 'basic', label: LINK_LABEL, kinds: ALL },
  { key: 'phone', tab: 'basic', label: '電話番号', kinds: BOX },
  { key: 'tracking_urls', tab: 'basic', label: '計測URL（クリック時にリクエストを送信・複数可）', kinds: BOX },
  { key: 'animation', tab: 'display', label: '表示アニメーション', kinds: ALL },
  { key: 'delay', tab: 'display', label: '開いてから出さない秒数', kinds: BOX },
  { key: 'scroll', tab: 'display', label: 'スクロールで表示', kinds: ['exit', 'follow'] },
  { key: 'countdown', tab: 'display', label: 'カウントダウンで表示', kinds: ['exit'] },
  { key: 'back_button', tab: 'display', label: 'バックボタンで表示', kinds: ['exit'] },
  { key: 'exit_intent', tab: 'display', label: '離脱で表示', kinds: ['exit'] },
  { key: 'close_button', tab: 'display', label: '閉じるボタンを表示', kinds: ['follow'], offNote: '離脱防止・表示直後は、いつも右上に ✕ が出ます' },
  { key: 'position', tab: 'position', label: '表示位置', kinds: ALL },
  { key: 'device', tab: 'device', label: 'デバイス別の表示制御', kinds: ALL },
  { key: 'code', tab: 'code', label: 'コード（中身の HTML は「中身を編集」で直します）', kinds: ALL },
]

/** 「コード」のタブの中の小さなタブ（JavaScript・CSS・HeadTag・BodyTag） */
export type CodeTab = 'javascript' | 'css' | 'head_tag' | 'body_tag'
export const CODE_TABS: readonly { id: CodeTab; label: string; kinds: readonly PopupKind[] }[] = [
  { id: 'javascript', label: 'JavaScript', kinds: ALL },
  { id: 'css', label: 'CSS', kinds: ['follow'] },
  { id: 'head_tag', label: 'HeadTag', kinds: BOX },
  { id: 'body_tag', label: 'BodyTag', kinds: BOX },
]

export const settingsOfTab = (tab: EditorTab): readonly SettingRow[] => POPUP_SETTINGS.filter((row) => row.tab === tab)

export function labelOf(key: SettingKey): string {
  const row = POPUP_SETTINGS.find((r) => r.key === key)
  if (row === undefined) throw new Error(`ポップアップの設定 ${key} が表に無い`)
  return row.label
}

/** どの種類で使えるか（「離脱防止・表示直後で使えます」） */
export const usableIn = (kinds: readonly PopupKind[]): string => `${kinds.map((kind) => KIND_LABEL[kind]).join('・')}で使えます`

export const offNoteOf = (row: SettingRow): string => row.offNote ?? usableIn(row.kinds)

/** その種類で使える設定の欄を作る（使える種類の分だけ渡す） */
export type SettingRenderers = Partial<Record<SettingKey, () => HTMLElement>>

/** タブの中を表のとおりの順に並べる。使えない設定は薄く出して、どの種類で使えるかを書く */
export function renderSettingsTab(body: HTMLElement, tab: EditorTab, kind: PopupKind, renderers: SettingRenderers): void {
  body.innerHTML = ''
  for (const row of settingsOfTab(tab)) {
    let field: HTMLElement
    if (row.kinds.includes(kind)) {
      const render = renderers[row.key]
      if (render === undefined) throw new Error(`${KIND_LABEL[kind]}の「${row.label}」の欄が作られていない`)
      field = render()
    } else {
      field = el('div', { class: 'ep-field ep-field-off' }, [el('label', { text: row.label }), offNote(offNoteOf(row))])
      field.setAttribute('data-unavailable', '')
    }
    field.dataset['setting'] = row.key
    body.append(field)
  }
}

/** 使えない理由の小さな説明 */
export const offNote = (text: string): HTMLElement => el('p', { class: 'ep-off-note', text })

/**
 * 欄を薄くして触れないようにする（スイッチがオフ・動作が違うとき）。隠さない＝どこにあるかは見えたまま。
 * 触れなくするのは disabled だけ（見た目の薄さは .ep-field-off）。
 */
export function setOff(field: HTMLElement, off: boolean): void {
  field.classList.toggle('ep-field-off', off)
  for (const control of field.querySelectorAll('input, select, textarea, button')) {
    if (off) control.setAttribute('disabled', '')
    else control.removeAttribute('disabled')
  }
}
