/**
 * ルート種別ごとの採取状態テンプレート（企画書 §5-4・§7-1）。
 *
 * 基準状態は「新規アカウント（空）＋作成フロー」（§1-4）なので、
 * priority 1 ＝ 今回採取する状態、priority 3 ＝ populated前提で後日フェーズ、と分ける。
 */

export type RouteKind =
  | 'list'
  | 'editor'
  | 'form'
  | 'wizard'
  | 'settings'
  | 'oauth-callback'
  | 'static'
  | 'realtime'
  | 'chat'

export interface StateTemplate {
  name: string
  /** その状態を出すための操作手順（採取係の拡張がこの順に実行する） */
  interactions: string[]
  /** 1=今回必須 / 2=可能なら / 3=populated前提・後日フェーズ */
  priority: 1 | 2 | 3
  note?: string
}

/** 全ルート共通（§7-2 横断状態は _global.md に置き、各ルートからは参照のみ） */
export const GLOBAL_STATES: readonly StateTemplate[] = [
  { name: 'global__sidebar-active', interactions: [], priority: 1, note: 'サイドバーの現在地ハイライト' },
  { name: 'global__sidebar-hover', interactions: ['hover:サイドバー各項目'], priority: 2 },
  { name: 'global__folder-tree-open', interactions: ['click:フォルダ木の展開'], priority: 1 },
  { name: 'global__team-switcher-open', interactions: ['click:ヘッダのチーム名'], priority: 1 },
  { name: 'global__notification-center', interactions: ['click:ヘッダの通知アイコン'], priority: 2 },
  { name: 'global__toast-success', interactions: ['任意の保存操作を成功させる'], priority: 1 },
  { name: 'global__toast-error', interactions: ['バリデーションエラーになる保存を実行'], priority: 2 },
  { name: 'global__session-expired', interactions: [], priority: 3, note: '観測困難。手構築の可能性（§5-7）' },
]

/**
 * ビューポート（企画書 §13-A）。
 * pc/sp は「別の状態」ではなく、各状態を撮る画面幅。よって state ではなく route の属性として持つ。
 * こうしないと state数が二重計上され、台帳の母集合がぶれる。
 */
export const VIEWPORTS: readonly { name: string; width: number; height: number }[] = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'sp', width: 430, height: 932 },
]

const COMMON_DISPLAY: readonly StateTemplate[] = [
  { name: 'empty', interactions: [], priority: 1, note: '基準状態（新規アカウント＝0件・§1-4）。新規アカウントでは default と同一画面なので empty に一本化' },
  { name: 'loading', interactions: ['network:throttle-slow', 'reload'], priority: 2, note: 'スケルトン/スピナー' },
  { name: 'error', interactions: [], priority: 3, note: '実サイトでは意図的に出せない。手構築（§5-7）' },
]

const LIST_POPULATED: readonly StateTemplate[] = [
  { name: 'normal', interactions: [], priority: 3, note: 'populated前提・後日フェーズ' },
  { name: 'page-last', interactions: ['click:最終ページ'], priority: 3 },
  { name: 'sort-desc', interactions: ['click:列見出し'], priority: 3 },
  { name: 'filter-empty', interactions: ['input:検索に一致しない語'], priority: 3 },
  { name: 'delete-confirm', interactions: ['click:行の削除', 'wait:確認ダイアログ'], priority: 3 },
]

const CREATION_FLOW: readonly StateTemplate[] = [
  { name: 'create-modal-open', interactions: ['click:新規作成ボタン'], priority: 1, note: '作成フロー起点' },
  { name: 'create-form-invalid', interactions: ['click:新規作成ボタン', 'click:保存（未入力のまま）'], priority: 1, note: 'バリデーション文言はverbatim保持対象' },
  { name: 'create-submitting', interactions: ['click:新規作成ボタン', 'input:名前', 'click:保存'], priority: 2, note: '送信中disabled' },
  { name: 'create-success', interactions: ['click:新規作成ボタン', 'input:名前', 'click:保存', 'wait:一覧反映'], priority: 1, note: '作成→一覧に出る（§10-9）' },
]

const EDITOR_STATES: readonly StateTemplate[] = [
  { name: 'default', interactions: [], priority: 1, note: '3レール（左=タブ / 中央=PC/SP iframe / 右=編集ツール）' },
  { name: 'tab-basic', interactions: ['click:左レール 基本情報'], priority: 1 },
  { name: 'tab-version', interactions: ['click:左レール Version'], priority: 1, note: 'Version名+配信割合入力+更新+Version追加' },
  { name: 'tab-popup', interactions: ['click:左レール ポップアップ'], priority: 1 },
  { name: 'tab-report', interactions: ['click:左レール レポート'], priority: 1 },
  { name: 'preview-pc', interactions: ['click:PC表示'], priority: 1, note: 'iframe 約620×486' },
  { name: 'preview-sp', interactions: ['click:SP表示'], priority: 1, note: 'iframe 約430×640' },
  { name: 'code-editor-open', interactions: ['click:右レール コード編集'], priority: 1 },
  { name: 'image-picker-open', interactions: ['click:右レール 画像追加'], priority: 1 },
  { name: 'text-tool-open', interactions: ['click:右レール テキスト追加'], priority: 1 },
  { name: 'block-library-open', interactions: ['click:右レール ブロック追加'], priority: 1, note: 'ブロックテンプレHTMLをライブラリ化（§9-1[4]）' },
  { name: 'history-open', interactions: ['click:右レール 履歴'], priority: 2 },
  { name: 'publish-confirm', interactions: ['click:公開', 'wait:確認ダイアログ'], priority: 1, note: '状態バッジ 準備中→公開中' },
  { name: 'version-add', interactions: ['click:左レール Version', 'click:Version追加'], priority: 1 },
  { name: 'ratio-invalid', interactions: ['click:左レール Version', 'input:配信割合に不正値', 'click:更新'], priority: 1, note: '合計100%警告の文言を採る' },
]

const WIZARD_STATES: readonly StateTemplate[] = [
  { name: 'step1', interactions: [], priority: 1 },
  { name: 'step1-validation-error', interactions: ['click:次へ（未入力のまま）'], priority: 1 },
  { name: 'step2', interactions: ['input:必須項目', 'click:次へ'], priority: 1 },
  { name: 'step2-validation-error', interactions: ['input:必須項目', 'click:次へ', 'click:次へ（未入力のまま）'], priority: 1 },
  { name: 'submit-success', interactions: ['最終ステップまで入力', 'click:完了'], priority: 2 },
]

const FORM_STATES: readonly StateTemplate[] = [
  { name: 'form-empty', interactions: [], priority: 1 },
  { name: 'form-invalid', interactions: ['click:保存（未入力のまま）'], priority: 1 },
  { name: 'submitting', interactions: ['input:必須項目', 'click:保存'], priority: 2 },
  { name: 'submit-success', interactions: ['input:必須項目', 'click:保存', 'wait:トースト'], priority: 1 },
]

export function statesFor(kind: RouteKind): StateTemplate[] {
  const base: StateTemplate[] = [{ name: 'default', interactions: [], priority: 1 }]
  switch (kind) {
    case 'editor':
      return [...EDITOR_STATES]
    case 'list':
      return [...COMMON_DISPLAY, ...CREATION_FLOW, ...LIST_POPULATED]
    case 'wizard':
      return [...WIZARD_STATES]
    case 'form':
      return [...base, ...FORM_STATES]
    case 'settings':
      return [...base, ...FORM_STATES]
    case 'realtime':
      return [
        ...base,
        ...COMMON_DISPLAY,
        { name: 'cable-connecting', interactions: ['reload'], priority: 2 },
        { name: 'cv-toast', interactions: ['wait:CV着信'], priority: 2, note: 'CV発火は保証されない。採れない場合はREST応答から逆算（§9-3）' },
        { name: 'cable-disconnected', interactions: ['network:offline'], priority: 2 },
        ]
    case 'chat':
      return [
        ...base,
        ...COMMON_DISPLAY,
        { name: 'conversation-new', interactions: ['click:新規会話'], priority: 1 },
        { name: 'streaming', interactions: ['input:質問', 'click:送信'], priority: 2, note: 'SSEのトークン逐次表示' },
        ]
    case 'oauth-callback':
      return [
        { name: 'not-connected', interactions: [], priority: 1 },
        { name: 'connected', interactions: [], priority: 3, note: '実連携が必要。後日フェーズ' },
        ]
    case 'static':
      return [...base]
  }
}
