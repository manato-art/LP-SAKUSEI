/**
 * 採取したエディタDOMの目印（editor.ts から分離）。
 *
 * 実物の `data-test` 属性をそのまま使う。手書きでUIを似せず、
 * 採取DOMに挙動だけを付ける方式（企画書 §11「島」の再実装）の入口になる。
 * 画面を組み立てる関数がファイルをまたいで参照するのでここに置いている。
 */
/** 採取DOM内の目印（実物の data-test 属性。採取のたびに増える） */
export const HOOK = {
  versionList: '[data-test="Article-ArticleLists"]',
  currentVersion: '[data-test="ArticleList-CurrentArticle"]',
  versionName: '[data-test="ArticleList-InputMemo"]',
  ratio: '[data-test="ArticleList-DeriveryRateForm"]',
  ratioUp: '[data-test="ArticleList-DeriveryUpRateForm"]',
  ratioDown: '[data-test="ArticleList-DeriveryDownRateForm"]',
  addVersion: '[data-test="Article-BtnCreateNewArticle"]',
  undo: '[data-test="SideToolbar-Undo"]',
  redo: '[data-test="SideToolbar-Redo"]',
  tagSettings: '[data-test="HtmlSettingModal-BtnOpenModal"]',
  versionSettings: '[data-test="MasterStyleSheetModal-BtnOpenModal"]',
  /** 右レール1番目。実DOMでは aria-label で識別できる */
  preview: '[aria-label="プレビュー"]',
  moreToolbar: '[data-test="EditorToolbar-BtnMoreToolbarOption"]',
  // 実物は data-test="editorWrapper"。data-testid="editor-wrapper" という別要素もあるが、
  // 属性名が違うので [data-test="editor-wrapper"] は永久に一致しない。念のための第2候補は置かない。
  editorWrapper: '[data-test="editorWrapper"]',
  /** Version行は記事uidを属性で持っている（実DOMで判明） */
  versionRow: '[data-article-uid]',
  funnelPrev: '[class*="changePrevFunnelStep"]',
  funnelNext: '[class*="changeNextFunnelStep"]',
  versionLinkInput: '#versionLink',
} as const
