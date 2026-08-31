/**
 * 採取した実DOM／実CSSの目印。**新しい `data-test` を実物に足さない**（企画書 §11）。
 * 出典: `capture/clean/ab_tests__UID__articles/` の editor-target / editor-text-selected /
 * toolbar-expanded / toolbar-align-open / toolbar-color-open / toolbar-link-open。
 */

/** 実DOMの目印（`data-test` / CSSモジュールのクラス断片） */
export const HOOK = {
  wrapper: '[data-test="EditorToolbar-EditorToolbarWrapper"]',
  arrow: '[class*="editorToolbarArrow"]',
  tooltip: '[class*="_tooltip_"]',
  item: '[class*="toolbarActionWrapper"]',
  bold: '[data-test="EditorToolbar-BtnBold"]',
  italic: '[data-test="EditorToolbar-BtnItalic"]',
  underline: '[data-test="EditorToolbar-BtnUnderline"]',
  strike: '[data-test="EditorToolbar-BtnStrike"]',
  scriptSuper: '[class*="iconScriptSuper"]',
  scriptSub: '[class*="iconScriptSub"]',
  link: '[data-test="LinkDropdown-BtnOpenDropdown"]',
  photo: '[data-test="EditorToolbar-BtnArticlePhoto"]',
  color: '[data-test="ColorPicker-BtnColor"]',
  background: '[data-test="ColorPicker-BtnBackGround"]',
  align: '[data-test="EditorToolbar-BtnAlign"]',
  alignIcon: '[class*="alignIcon"]',
  more: '[data-test="EditorToolbar-BtnMoreToolbarOption"]',
  header: '[data-test="EditorToolbar-BtnHeader"]',
  fontSize: '[data-test="EditorToolbar-BtnFontSize"]',
  fontFamily: '[data-test="EditorToolbar-BtnFontFamily"]',
  removeFormat: '[data-test="EditorToolbar-RemoveFormat"]',
  shrink: '[class*="iconShrinkToolbar"]',
  trigger: '[class*="_trigger_"]',
  bodyWrapper: '[class*="_bodyWrapper_"]',
  dropdownArrow: '[class*="_arrow_"]',
  selectForm: '[class*="selectForm"]',
  fontOptions: '[class*="fontOptionDropDown"]',
  fontSizeTab: '[class*="fontSizeTab"]',
  freeFontSizeForm: '[class*="freeFontSizeForm"]',
  /** リンクドロップダウンを差し込む先（採取物ではこの直下に出ていた） */
  editorWrapper: '[data-test="editorWrapper"]',
} as const

/**
 * 採取したCSSモジュールのハッシュ付きクラス名（verbatim）。
 * 出典: editor-target / editor-text-selected / toolbar-align-open の各 dom.html。
 */
export const CLS = {
  /** ツールバー本体を見える状態にする（`opacity:.5; pointer-events:all`） */
  wrapperActive: '_active_1snng_11',
  /** 各ボタンの押下状態（白丸背景） */
  itemActive: '_active_1snng_11',
  /** 矢印がツールバーの上に出る＝ツールバーは選択範囲の下 */
  arrowTop: '_top_1snng_43',
  /** 矢印がツールバーの下に出る＝ツールバーは選択範囲の上（editor-text-selected と同じ） */
  arrowBottom: '_bottom_1snng_47',
  /** ドロップダウン本体の展開（実CSS: `display:block`） */
  dropdownOpen: '_open_x4j8w_84',
  dropdownArrowTop: '_top_x4j8w_76',
} as const

/** ツールバー内の項目の表示/非表示（実CSS: `[data-is-show="false"]{display:none}`） */
export function setItemShown(node: Element | null, shown: boolean): void {
  node?.closest(HOOK.item)?.setAttribute('data-is-show', shown ? 'true' : 'false')
}
