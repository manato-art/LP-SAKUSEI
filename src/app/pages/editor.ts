/**
 * LPエディタ（企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** 採取した実DOMをそのまま土台として描画し、
 * `data-test` 属性を目印に挙動だけを付ける（＝企画書 §11 の「島」の再実装）。
 * 見た目は本物のマークアップ＋実CSS（Emotion含む）で担保される。
 */
import Quill from 'quill'
// bubbleテーマは独自のツールチップUIを作ってしまうので使わない。
// 採取した実物のツールバーを使うため、Quillは**テーマ無し**＋coreのCSSだけにする。
import 'quill/dist/quill.core.css'
import substrate from '../fragments/ab_tests__UID__articles__editor-target.html?raw'
import { api, type Version } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { mountVersionSettings } from '../panels/version-settings.ts'
import { mountTagSettings } from '../panels/tag-settings.ts'
import { mountLinkReplace } from '../panels/link-replace.ts'
import { mountHistory } from '../panels/history.ts'
import { mountEditorToolbar } from '../panels/editor-toolbar.ts'
import { createAutosave } from './autosave.ts'
import { createPanelGroup } from '../panels/panel-group.ts'
import { mountVersionListDropdown } from '../panels/version-actions.ts'
import { mountVersionDotsMenu } from '../panels/version-dots-menu.ts'
import { mountHeaderImageModal } from '../panels/header-image-modal.ts'
import { mountVersionLinkPopup } from '../panels/version-link-popup.ts'
import { mountStepAddModal } from '../panels/step-add-modal.ts'
import { mountWidgetLibrary } from '../panels/widget-library.ts'
import { EXTERNAL_IMAGE_TOOL_INDEX, mountExternalImage } from '../panels/external-image.ts'
import { registerMediaBlots } from '../panels/media-blots.ts'
import { wireMediaDrop } from '../panels/media-insert.ts'
import { wireAbTestTabs } from './tab-nav.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { masterStyleEditorDecls } from '../master-style.ts'

/** 採取DOM内の目印（実物の data-test 属性。採取のたびに増える） */
const HOOK = {
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

/** 配線済みのツール（未実装トーストを出さない） */
/** 打ち終わってから保存するまでの待ち時間。1文字ごとに保存すると通信が飽和する。 */
const AUTOSAVE_DELAY_MS = 900

/** 右レールの並び順は SIDE_TOOLS のとおり。プレビューは1番目。 */
const PREVIEW_TOOL_INDEX = 0
/** 右レールの並び: 6=元に戻す / 7=やり直す */
const UNDO_TOOL_INDEX = 6
const REDO_TOOL_INDEX = 7

const WIRED_TOOLS: readonly number[] = [0, 1, 2, 3, 4, 5]

/** 右レール9ツールの実際の名前（実DOMの tooltip / aria-label より） */
const SIDE_TOOLS: readonly string[] = [
  'プレビュー',
  '変更・復元履歴',
  'Widget管理',
  'リンク置換',
  'Version設定',
  'タグ設定',
  '元に戻す',
  'やり直す',
  '外部サーバー画像アップロード',
]

interface EditorContext {
  root: HTMLElement
  quill: Quill
  abTestUid: string
  /** beyondページ（＝基本情報タブ）へのリンクを組み立てるのに要る */
  folderUid: string
  articleUid: string
  versions: Version[]
  currentUid: string
  /** Versionカードの雛形（採取した実物カードのクリーンなクローン。Versionごとに複製して並べる） */
  cardTemplate: HTMLElement
}

export async function renderEditor(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''

  const [{ ab_test }, { articles }] = await Promise.all([
    api.abTest(abTestUid),
    api.articles(abTestUid),
  ])
  const articleUid = articles[0]?.uid
  if (articleUid === undefined) {
    container.textContent = '記事が見つかりません'
    return
  }
  const { versions } = await api.versions(articleUid)
  const folders = await api.folders()
  const folder = folders.folders.find((f) => f.id === ab_test.folder_id)
  const folderName = folder?.name ?? ''

  // API待ちの間に新しい描画が始まっていたら、ここで降りる（二重描画の防止）
  if (generation !== undefined && isStale(generation)) return

  /**
   * 土台を描画（本物のDOMをそのまま）。
   * 実機のLayout実測（capture/clean/.../editor-target/layout.json）:
   *   editorWrapper   1085×626  display:flex  max-width:1100px  padding:20px
   *   Versionパネル    230×626
   *   コンテンツ枠      620×500
   *   quillIframe     620×486
   *   右レール          50×506   display:flex  padding:20px 0
   *   上部ナビ         1085×80
   * 実CSSが `height: calc(100% - 120px)` を前提にしているため、
   * 差し込み先に高さを与えないとレイアウトが潰れる。
   */
  // container はシェルのコンテンツ枠（`flex:1; min-width:0` が入っている）。
  // ここで cssText を丸ごと上書きすると **flex:1 が消えて左寄せ＋右に灰色余白**になり、
  // overflow:hidden だと縦に長いエディタをスクロールできない。
  // → flex は残したまま、高さと縦スクロールだけ足す。
  container.style.flex = '1'
  container.style.minWidth = '0'
  container.style.height = '100vh'
  container.style.overflow = 'auto'
  const root = document.createElement('div')
  root.style.cssText = 'height:100%'
  root.innerHTML = substrate
  container.append(root)

  // 動画（<video>）ブロットを Quill 生成前に登録しておく（保存HTMLからの復元でも消えないように）。
  registerMediaBlots()
  // ── プレビュー枠の iframe を、動くQuillに差し替える ──
  const quill = mountQuill(root)
  // キャンバスへのドラッグ＆ドロップで、カーソル位置へ画像/GIF/動画を挿入できるようにする。
  wireMediaDrop(quill)

  // Versionカードの雛形を、配線前のクリーンな状態でクローンして控える（採取した実物1枚が雛形）。
  const originalCard = root.querySelector<HTMLElement>('[data-article-uid]')
  const cardTemplate = (originalCard?.cloneNode(true) as HTMLElement | null) ?? document.createElement('div')

  const ctx: EditorContext = {
    root,
    quill,
    abTestUid,
    folderUid: folder?.uid ?? '',
    articleUid,
    versions: [...versions],
    currentUid: versions[0]?.uid ?? '',
    cardTemplate,
  }

  // Versionパネルは ctx.versions から**1枚ずつカードを描く**（複製/追加した分も下に増える）。
  renderVersionList(ctx)
  // 「Version追加」ボタンはカードの下に据え置き（再描画で消えない）。1回だけ配線する。
  wireAddVersion(ctx)
  // 「Version ▼」一覧ドロップダウンの開閉（task 2・採取済みマークアップに挙動だけ付ける）
  mountVersionListDropdown(root)
  mountHeaderImageModal(root)
  mountVersionLinkPopup(root, { abTestUid, getCurrentUid: () => ctx.currentUid })
  mountStepAddModal(root)
  wireSideToolbar(ctx)
  wireTopBar(root, ab_test.title, folderName)
  // 4タブ（基本情報 / Version / ポップアップ / レポート）を相互に行き来できるようにする
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  wireTopRightIcons(root, abTestUid, folder?.uid ?? '')
  loadVersion(ctx, ctx.currentUid)
  // 記事設定（Version設定）を編集画面の本文にも反映する（保存後は「更新」または再読込で最新化）。
  void applyMasterStyleToEditor(ctx)
}

/** 記事設定（MasterStyleSheet）を Quill 本文へ当てて、編集画面でも見た目を反映する。 */
async function applyMasterStyleToEditor(ctx: EditorContext): Promise<void> {
  try {
    const { master_style_sheet } = await api.masterStyleSheet(ctx.articleUid)
    const decls = masterStyleEditorDecls(master_style_sheet)
    if (decls !== '') ctx.quill.root.setAttribute('style', decls)
  } catch {
    // 取得に失敗しても編集は続けられる（既定の見た目のまま）
  }
}

/**
 * 採取DOMのプレビューiframeを探し、その場所にQuillを立てる。
 * 実物は同一オリジンiframeへ動的書き込みしているが、クローンでは
 * 同じ寸法の枠にQuillを置いて「本当に編集できる」状態にする（§9-1 の到達点）。
 */
function mountQuill(root: HTMLElement): Quill {
  // プレビュー枠は実DOMでは `<iframe id="quillIframe" class="_quillEditorWrapper_…">`。
  // **id で引く**（class は匿名化で `_quillEditorWrapper_…`→`UID_…` に置換され得るため、
  // `[class*="quillEditorWrapper"]` だと外れて host が枠の外＝ページ末尾に落ちてしまう）。
  const frame =
    root.querySelector<HTMLIFrameElement>('#quillIframe') ??
    root.querySelector<HTMLIFrameElement>('iframe[class*="quillEditorWrapper"]')
  const host = document.createElement('div')
  if (frame !== null) {
    // iframe の採取CSS（width:100% / height:calc(100vh-260px) / 角丸）を引き継いで、
    // コンテンツ枠いっぱいに広げる（従来は 486px 固定で下に余白が出ていた）。
    host.className = frame.className
    host.style.background = '#fff'
    host.style.overflow = 'auto'
    frame.replaceWith(host)
  } else {
    host.style.cssText = 'width:100%;height:calc(100vh - 260px);background:#fff;overflow:auto'
    root.append(host)
  }
  /**
   * ツールバーは**採取した実物の markup**（`_editorToolbarWrapper_`）を使うので、
   * Quill 内蔵の bubble ツールバーは出さない（二重に出てしまうため）。
   * 書式の適用は `src/app/panels/editor-toolbar.ts` が Quill API 経由で行う。
   */
  return new Quill(host, {
    placeholder: 'ここにLPの内容を入力してください',
    modules: { toolbar: false },
  })
}

function loadVersion(ctx: EditorContext, uid: string): void {
  const v = ctx.versions.find((x) => x.uid === uid)
  if (v === undefined) return
  ctx.currentUid = uid
  ctx.quill.root.innerHTML = v.html
  // 現在Versionの本文を載せ替えたら、カード一覧も描き直して選択状態を合わせる。
  renderVersionList(ctx)
}

/** アクティブ表示に使う実CSSクラス（採取物のクラス。書き換えていない） */
const ACTIVE_CARD_CLASS = '_active_1xibh_202'

/**
 * Versionパネルのカードを ctx.versions から**1枚ずつ描き直す**。
 * 採取物には現在Versionのカードが1枚しか無いので、それを雛形にVersionの数だけ複製して並べる。
 * これが無いと、複製/追加したVersionのカードが下に増えない（＝ユーザー報告の不具合）。
 */
function renderVersionList(ctx: EditorContext): void {
  const list = ctx.root.querySelector<HTMLElement>(HOOK.versionList)
  if (list === null) return
  const addButton = list.querySelector<HTMLElement>(HOOK.addVersion)
  for (const card of list.querySelectorAll<HTMLElement>(HOOK.versionRow)) card.remove()

  const alive = ctx.versions.filter((v) => v.archived !== true)
  for (const version of alive) {
    const card = ctx.cardTemplate.cloneNode(true) as HTMLElement
    wireVersionCard(ctx, card, version)
    if (addButton !== null) list.insertBefore(card, addButton)
    else list.append(card)
  }
}

/** 1枚のVersionカードに、そのVersionの値と操作（名前/配信割合/更新/「…」/クリック切替）を配線する */
function wireVersionCard(ctx: EditorContext, card: HTMLElement, version: Version): void {
  // このカードが表す最新のVersion（保存のたびに新しいオブジェクトへ差し替える＝イミュータブル・§12）。
  let model = version
  card.dataset['articleUid'] = model.uid
  card.setAttribute('data-id', String(model.id))
  const isCurrent = model.uid === ctx.currentUid
  card.querySelector<HTMLElement>(HOOK.currentVersion)?.classList.toggle(ACTIVE_CARD_CLASS, isCurrent)

  const name = card.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = card.querySelector<HTMLInputElement>(HOOK.ratio)
  if (name !== null) name.value = model.name
  if (ratio !== null) ratio.value = String(model.distribution_ratio)

  const save = async (): Promise<void> => {
    const nextName = name !== null && name.value !== model.name ? name.value : null
    const nextRatio =
      ratio !== null && Number(ratio.value) !== model.distribution_ratio ? Number(ratio.value) : null
    if (nextName === null && nextRatio === null) return
    try {
      let updated = model
      if (nextName !== null) {
        await api.saveVersion(model.uid, { name: nextName })
        updated = { ...updated, name: nextName }
      }
      if (nextRatio !== null) {
        const res = await api.setRatio(model.uid, nextRatio)
        updated = { ...updated, distribution_ratio: res.version.distribution_ratio }
        if (ratio !== null) ratio.value = String(res.version.distribution_ratio)
      }
      model = updated
      ctx.versions = ctx.versions.map((v) => (v.uid === updated.uid ? updated : v))
      toast('更新しました')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  name?.addEventListener('change', () => void save())
  ratio?.addEventListener('change', () => void save())
  card.querySelector(HOOK.ratioUp)?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ratio === null) return
    ratio.value = String(Math.min(100, Number(ratio.value) + 1))
    void save()
  })
  card.querySelector(HOOK.ratioDown)?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ratio === null) return
    ratio.value = String(Math.max(0, Number(ratio.value) - 1))
    void save()
  })
  // 「更新」ボタン（`_articleButtons_` 内の文言「更新」のボタン）
  findUpdateButton(card)?.addEventListener('click', (event) => {
    event.stopPropagation()
    void save()
  })

  // カードのクリックでVersionを切り替える（入力欄・ボタン・スピナー・「…」上は除く）。
  card.style.cursor = 'pointer'
  card.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('input, button, ._articleButtons_1xibh_160') !== null) return
    if (target.closest(HOOK.ratioUp) !== null || target.closest(HOOK.ratioDown) !== null) return
    if (model.uid === ctx.currentUid) return
    void saveHtml(ctx).then(() => loadVersion(ctx, model.uid))
  })

  // このカードの「…」メニューは**このVersion**を対象にする。
  mountVersionDotsMenu(card, {
    getCurrentVersion: () => model,
    onDuplicated: (created) => {
      ctx.versions = [...ctx.versions, created]
      // 追加分のカードが下に増える。複製先へ切り替える。
      loadVersion(ctx, created.uid)
    },
    onArchived: (archived) => {
      ctx.versions = ctx.versions.map((v) =>
        v.uid === archived.uid ? { ...v, archived: true } : v,
      )
      const next = ctx.versions.find((v) => v.archived !== true)
      if (next !== undefined) loadVersion(ctx, next.uid)
      else renderVersionList(ctx)
    },
  })
}

/** カード内の「更新」ボタンを文言で探す（Emotionクラスは匿名化され得るので文言で引く） */
function findUpdateButton(card: HTMLElement): HTMLElement | null {
  const buttons = card.querySelectorAll<HTMLElement>('._articleButtons_1xibh_160 button')
  for (const button of buttons) {
    if ((button.textContent ?? '').trim().startsWith('更新')) return button
  }
  return null
}

/** 「Version追加」ボタンを1回だけ配線する（カード再描画で消えない要素なので使い回す） */
function wireAddVersion(ctx: EditorContext): void {
  ctx.root.querySelector(HOOK.addVersion)?.addEventListener('click', async () => {
    try {
      await saveHtml(ctx)
      const { version } = await api.addVersion(ctx.articleUid)
      ctx.versions = [...ctx.versions, version]
      toast(`${version.name} を追加しました`)
      loadVersion(ctx, version.uid)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}

async function saveHtml(ctx: EditorContext): Promise<void> {
  if (ctx.currentUid === '') return
  const html = ctx.quill.root.innerHTML
  await api.saveVersion(ctx.currentUid, { html })
  const v = ctx.versions.find((x) => x.uid === ctx.currentUid)
  if (v !== undefined) v.html = html
}

function wireSideToolbar(ctx: EditorContext): void {
  // ── 各パネルを配線（実装は src/app/panels/ に分かれている）──
  mountVersionSettings(ctx.root, ctx.articleUid, () => void applyMasterStyleToEditor(ctx))
  mountTagSettings(ctx.root, ctx.articleUid)
  // 置換の対象は「いま開いているVersion」。パネルは押されるたびに読み直す
  // サイドパネルは**押したときに開く**。実物は同時に1枚しか開かない
  // （採取したどの状態も1枚だけ開いた姿で採れている）。
  // 以前はマウント時点で全部開いており、画面上で重なっていた。
  const panels = createPanelGroup()
  const openers: Readonly<Record<number, () => HTMLElement | null>> = {
    1: () => mountHistory(ctx.root, ctx.articleUid),
    3: () => mountLinkReplace(ctx.root, ctx.articleUid, () => ctx.currentUid),
  }
  // リンクパネルの「計測ツールの変更」は、実物と同じ beyondページの編集画面（基本情報タブ）へ。
  mountEditorToolbar(ctx.root, ctx.quill, {
    trackingSettingsHref: `#/folders/${ctx.folderUid}/ab_tests/${ctx.abTestUid}/edit`,
  })
  // パズルピース（Widget管理ボタン）は実物では Widgetライブラリを開く
  mountWidgetLibrary(ctx.root, ctx.quill)


  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined) continue
    icon.style.cursor = 'pointer'

    if (index === PREVIEW_TOOL_INDEX) {
      // プレビューは右レールの1番目。aria-label で引くと別の要素に当たっていて、
      // レールのアイコンを押しても何も起きなかった。位置で引く。
      // 実物と同じく**新しいタブ**で `/ab_tests/:uid/articles/:stepUid/previews` を開く。
      icon.addEventListener('click', async () => {
        await saveHtml(ctx)
        const url =
          `${location.origin}${location.pathname}` +
          `#/ab_tests/${ctx.abTestUid}/articles/${ctx.currentUid}/previews`
        window.open(url, '_blank', 'noopener')
      })
      continue
    }

      const open = openers[index]
    if (open !== undefined) {
      // 押すたびに開閉。開くときは他のパネルを閉じる（実物は同時に1枚だけ）。
      icon.addEventListener('click', () => {
        const panel = open()
        if (panel === null) return
        panels.register(SIDE_TOOLS[index] ?? String(index), panel)
        panels.toggle(SIDE_TOOLS[index] ?? String(index))
      })
      continue
    }
    // 元に戻す / やり直す は Quill の履歴で実際に動かす（data-test がアイコンの
    // 内側にあり外側クリックを拾えないことがあるため、レールアイコンに直接配線する）。
    if (index === UNDO_TOOL_INDEX) {
      icon.addEventListener('click', () => ctx.quill.history.undo())
      continue
    }
    if (index === REDO_TOOL_INDEX) {
      icon.addEventListener('click', () => ctx.quill.history.redo())
      continue
    }
    // 外部サーバー画像アップロードは、実物のモーダルが採取できていないため
    // 見た目は真似ず、標準のファイル選択でカーソル位置へ画像を挿入する（§11 の“正直な代替”）。
    if (index === EXTERNAL_IMAGE_TOOL_INDEX) {
      mountExternalImage(icon, ctx.quill)
      continue
    }
    if (WIRED_TOOLS.includes(index)) continue
    // それでも残るツールがあれば正直にトースト
    const name = SIDE_TOOLS[index] ?? 'このツール'
    icon.addEventListener('click', () => toast(`${name} は未実装です`, 'error'))
  }

  // 本文の自動保存。実物のエディタは自動保存が走る
  // （docs/findings-live-observation.md「エディタは『開くだけで自動保存』が走る」・DOMに _saveAnimation_）。
  // これが無いと、打った内容がサーバーに残らない。
  const autosave = createAutosave({
    save: () => saveHtml(ctx),
    delayMs: AUTOSAVE_DELAY_MS,
    onError: (error) => toast(`保存できませんでした: ${error.message}`, 'error'),
  })
  ctx.quill.on('text-change', (_delta, _old, source) => {
    // 画面を切り替えた直後の再描画で保存が走ると、古い内容を書き戻してしまう。
    if (source === 'user') autosave.schedule()
  })

  // 保存（実物にはショートカットが無いが、作業用に足している）
  ctx.root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      void autosave.flush().then(() => toast('保存しました'))
    }
  })
}

/**
 * 土台には**採取した時点の値**が焼き付いている。
 * 匿名化で `サンプル施策NNN` の形に揃えてあるので、その並びを目印にして
 * いま開いているページの値へ差し替える（＝企画書 §5-6 の「再配線」）。
 */
const ANONYMIZED_NAME = /^サンプル施策\d+$/

function replaceBakedValues(root: HTMLElement, values: readonly string[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let node = walker.nextNode()
  while (node !== null) {
    const text = (node.textContent ?? '').trim()
    if (ANONYMIZED_NAME.test(text)) targets.push(node as Text)
    node = walker.nextNode()
  }
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i]
    if (target === undefined) continue
    target.textContent = values[Math.min(i, values.length - 1)] ?? ''
  }
}

/**
 * 上部右の3アイコン（編集 / Versionオプション設定 / 中間ページ）を配線する。
 *
 * 3アイコンは採取物では `_linksContainer_dcd38_102` 配下の `<a>` で、いずれも実アプリの
 * 絶対パスを指している。位置で #2/#3 を当てるのは脆いので、**アンカー自身の href /
 * data-trackid で同定**する（`wireBeyondNavAnchors` の中身・editor-target で確認した実DOM）:
 *   #1 編集              data-trackid="editor-nav-editor" / href=/ab_tests/:uid/articles#<記事uid>
 *   #2 オプション設定    href=/ab_tests/:uid/articles/split_test_settings/devices
 *   #3 中間ページ        data-trackid="editor-nav-redirect-page" / href=…/redirect_pages
 * #1(編集)は現画面。採取物の絶対hrefのままだとクリックでSPA外へ出てしまうので、
 * 現画面のハッシュへ張り替えて実害を消す（＝押しても現画面に留まる＝実質「無反応」）。
 *
 * 走査は `_linksContainer_dcd38_102` に限定する（本文の他アンカーを巻き込まないため）。
 * このクラスが採取物から消えたら、下部の Version▼ 等を触らないよう黙って何もしない。
 */
function wireTopRightIcons(root: HTMLElement, abTestUid: string, folderUid: string): void {
  const container = root.querySelector<HTMLElement>('._linksContainer_dcd38_102')
  if (container === null) {
    console.warn('[editor] 上部右アイコンの入れ物（_linksContainer_dcd38_102）が見つかりませんでした')
    return
  }
  wireBeyondNavAnchors(container, { abTestUid, folderUid })
}

function wireTopBar(root: HTMLElement, title: string, folderName: string): void {
  // 1つ目＝ページ名、2つ目＝フォルダ名（実機の上部バーの並び）
  replaceBakedValues(root, [title, folderName])

  for (const back of root.querySelectorAll<HTMLElement>('[class*="back"]')) {
    back.style.cursor = 'pointer'
    back.addEventListener('click', () => {
      location.hash = '/folders'
    })
  }
}
