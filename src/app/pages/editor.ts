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
import { mountWidgetManager } from '../panels/widget-manager.ts'
import { EXTERNAL_IMAGE_TOOL_INDEX, mountExternalImage } from '../panels/external-image.ts'
import { wireAbTestTabs } from './tab-nav.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'

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
  container.style.cssText = 'height:100vh;overflow:hidden'
  const root = document.createElement('div')
  root.style.cssText = 'height:100%'
  root.innerHTML = substrate
  container.append(root)

  // ── プレビュー枠の iframe を、動くQuillに差し替える ──
  const quill = mountQuill(root)

  const ctx: EditorContext = {
    root,
    quill,
    abTestUid,
    folderUid: folder?.uid ?? '',
    articleUid,
    versions: [...versions],
    currentUid: versions[0]?.uid ?? '',
  }

  applyVersionToPanel(ctx)
  wireVersionPanel(ctx)
  // 「Version ▼」一覧ドロップダウンの開閉（task 2・採取済みマークアップに挙動だけ付ける）
  mountVersionListDropdown(root)
  // エディタ内オーバーレイ4種（すべて採取済みマークアップに挙動だけ付ける）
  mountVersionDotsMenu(root, {
    getCurrentVersion: () => ctx.versions.find((v) => v.uid === ctx.currentUid) ?? null,
    onDuplicated: (version) => {
      ctx.versions = [...ctx.versions, version]
      loadVersion(ctx, version.uid)
    },
  })
  mountHeaderImageModal(root)
  mountVersionLinkPopup(root, { abTestUid, getCurrentUid: () => ctx.currentUid })
  mountStepAddModal(root)
  wireSideToolbar(ctx, ab_test.title, folderName)
  wireTopBar(root, ab_test.title, folderName)
  // 4タブ（基本情報 / Version / ポップアップ / レポート）を相互に行き来できるようにする
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  wireTopRightIcons(root, abTestUid, folder?.uid ?? '')
  loadVersion(ctx, ctx.currentUid)
}

/**
 * 採取DOMのプレビューiframeを探し、その場所にQuillを立てる。
 * 実物は同一オリジンiframeへ動的書き込みしているが、クローンでは
 * 同じ寸法の枠にQuillを置いて「本当に編集できる」状態にする（§9-1 の到達点）。
 */
function mountQuill(root: HTMLElement): Quill {
  const frame = root.querySelector<HTMLIFrameElement>('iframe[class*="quillEditorWrapper"]')
  const host = document.createElement('div')
  if (frame !== null) {
    host.style.cssText = `width:${frame.getAttribute('width') ?? 620}px;height:486px;background:#fff;overflow:auto`
    frame.replaceWith(host)
  } else {
    host.style.cssText = 'width:620px;height:486px;background:#fff;overflow:auto;margin:0 auto'
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
  applyVersionToPanel(ctx)
}

/** 採取DOMのVersion行に、モックの値を流し込む */
function applyVersionToPanel(ctx: EditorContext): void {
  const current = ctx.versions.find((v) => v.uid === ctx.currentUid)
  if (current === undefined) return
  const name = ctx.root.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = ctx.root.querySelector<HTMLInputElement>(HOOK.ratio)
  if (name !== null) name.value = current.name
  if (ratio !== null) ratio.value = String(current.distribution_ratio)

}


function wireVersionPanel(ctx: EditorContext): void {
  const name = ctx.root.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = ctx.root.querySelector<HTMLInputElement>(HOOK.ratio)

  const save = async (): Promise<void> => {
    const current = ctx.versions.find((v) => v.uid === ctx.currentUid)
    if (current === undefined) return
    try {
      if (name !== null && name.value !== current.name) {
        await api.saveVersion(current.uid, { name: name.value })
        current.name = name.value
      }
      if (ratio !== null && Number(ratio.value) !== current.distribution_ratio) {
        const res = await api.setRatio(current.uid, Number(ratio.value))
        current.distribution_ratio = res.version.distribution_ratio
      }
      applyVersionToPanel(ctx)
      toast('更新しました')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  name?.addEventListener('change', () => void save())
  ratio?.addEventListener('change', () => void save())

  // スピナー（実物は上下ボタンが別要素）
  ctx.root.querySelector(HOOK.ratioUp)?.addEventListener('click', () => {
    if (ratio === null) return
    ratio.value = String(Math.min(100, Number(ratio.value) + 1))
    void save()
  })
  ctx.root.querySelector(HOOK.ratioDown)?.addEventListener('click', () => {
    if (ratio === null) return
    ratio.value = String(Math.max(0, Number(ratio.value) - 1))
    void save()
  })

  // Version行のクリックで切り替え（行が data-article-uid を持つ・実DOMで判明）
  for (const row of ctx.root.querySelectorAll<HTMLElement>(HOOK.versionRow)) {
    row.style.cursor = 'pointer'
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('input') !== null || target.closest('button') !== null) return
      const uid = row.dataset['articleUid']
      if (uid === undefined) return
      void saveHtml(ctx).then(() => loadVersion(ctx, uid))
    })
  }

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

function wireSideToolbar(ctx: EditorContext, previewTitle: string, previewFolder: string): void {
  // ── 各パネルを配線（実装は src/app/panels/ に分かれている）──
  mountVersionSettings(ctx.root, ctx.articleUid)
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
  mountWidgetManager(ctx.root, ctx.quill)


  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined) continue
    icon.style.cursor = 'pointer'

    if (index === PREVIEW_TOOL_INDEX) {
      // プレビューは右レールの1番目。aria-label で引くと別の要素に当たっていて、
      // レールのアイコンを押しても何も起きなかった。位置で引く。
      icon.addEventListener('click', async () => {
        await saveHtml(ctx)
        openPreview(ctx, previewTitle, previewFolder)
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
 * プレビュー画面（右レール1番目）。
 *
 * ⚠ **この画面だけは採取物が無く、手書きで組み立てている。**
 * 本案件の方法（採取した実物を土台にする）から外れた唯一の画面なので、
 * 画面上にもその旨を出して「本物に見えるが本物ではない」状態を避ける。
 * 採取できたら、他の画面と同じく断片を土台にして作り直すこと。
 *
 * 根拠にしているのは採取物ではなく、人間が実機で見た記録
 * （docs/findings-live-observation.md）だけ。構造は次のとおりと記録されている:
 *   上部ナビ（戻る / ページ切替 / Version編集・オプション設定・中間ページ へのリンク）
 *   URLカード2枚（作成中の確認用URL / 配信URL）＋ それぞれ コピー・QR・別タブ
 *   中央に previewIframe
 * クローンでは外部へ一切出さず、保存済みの html / css を iframe に流し込む（§3-2）。
 */
function openPreview(ctx: EditorContext, title: string, folderName: string): void {
  const version = ctx.versions.find((v) => v.uid === ctx.currentUid)
  if (version === undefined) return

  const overlay = document.createElement('div')
  overlay.style.cssText = `position:fixed;inset:0;z-index:9500;background:#ECECEC;overflow:auto;
    font-family:"Hiragino Sans",sans-serif`

  // ── 上部ナビ ──
  const nav = document.createElement('div')
  nav.style.cssText = `background:#fff;border-bottom:1px solid #E5E5E5;padding:10px 16px;
    display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:2`

  const back = navButton('‹ 戻る')
  back.addEventListener('click', () => overlay.remove())

  const pageInfo = document.createElement('div')
  pageInfo.style.cssText = 'display:flex;flex-direction:column;gap:2px;flex:1;min-width:0'
  pageInfo.append(
    inline(`${title}`, 'font-size:14px;font-weight:600'),
    inline(folderName, 'font-size:11px;color:#808080'),
  )

  // 実物のナビにある3リンク（遷移先は実DOMで確定済み）
  const links = document.createElement('div')
  links.style.cssText = 'display:flex;gap:8px'
  for (const [label, hash] of [
    ['Version編集', `/ab_tests/${ctx.abTestUid}/articles`],
    ['Versionオプション設定', `/ab_tests/${ctx.abTestUid}/articles/split_test_settings/devices`],
    ['中間ページ', `/folders/${ctx.folderUid}/ab_tests/${ctx.abTestUid}/redirect_pages`],
  ] as const) {
    const b = navButton(label)
    b.addEventListener('click', () => {
      overlay.remove()
      location.hash = hash
    })
    links.append(b)
  }
  nav.append(back, pageInfo, links)

  // ── URLカード2枚 ──
  const cards = document.createElement('div')
  cards.style.cssText = 'padding:14px 16px;display:flex;flex-direction:column;gap:10px'
  cards.append(
    urlCard(
      '作成中の確認用URL',
      `${location.origin}/#/preview/${version.uid}`,
      '配信には利用できないURLです。ご注意ください。',
      '#D0021B',
    ),
    urlCard(
      '配信URL',
      `${location.origin}/#/ab/${ctx.abTestUid}`,
      '正確なレポート計測のため、レポート除外設定を必ず行ってください。',
      '#808080',
    ),
  )

  // ── プレビュー本体 ──
  const stage = document.createElement('div')
  stage.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:0 16px 32px;gap:10px'

  // 実物にSP/PC切替があるという記録は採取物にも観測メモにも無い。
  // 「あったら便利」で足すと、実物に無い機能が本物に見えてしまうので置かない。
  const frame = document.createElement('iframe')
  frame.id = 'previewIframe'
  frame.style.cssText = 'width:620px;height:70vh;border:none;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15)'
  stage.append(frame)

  overlay.append(
    inline(
      'この画面は採取できていないため、実物と見た目が異なります（クローン独自の暫定表示）',
      'background:#FFF4E5;color:#7A4B00;font-size:12px;padding:8px 16px;text-align:center',
    ),
  )
  overlay.append(nav, cards, stage)
  document.body.append(overlay)

  const doc = frame.contentDocument
  if (doc !== null) {
    doc.open()
    doc.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<style>body{margin:0;font-family:"Hiragino Sans",sans-serif}${version.css}</style>
</head><body>${version.html}</body></html>`)
    doc.close()
  }

}

function inline(text: string, style: string): HTMLElement {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = style
  return el
}

function navButton(label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = `background:#F4F4F4;border:1px solid #DDD;border-radius:4px;padding:6px 12px;
    cursor:pointer;font-size:12px;font-family:inherit;color:#151515;line-height:1.5;white-space:nowrap`
  return b
}

/** URLカード（コピー / 別タブ）。実物にはQRもあるが未実装。 */
function urlCard(label: string, url: string, note: string, noteColor: string): HTMLElement {
  const card = document.createElement('div')
  card.style.cssText = 'background:#fff;border-radius:6px;padding:12px 14px'

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap'
  row.append(inline(label, 'font-size:12px;font-weight:600;white-space:nowrap'))

  const urlText = document.createElement('p')
  urlText.textContent = url
  urlText.style.cssText = 'margin:0;font-size:12px;color:#0091FF;flex:1;min-width:0;word-break:break-all'
  row.append(urlText)

  const copy = navButton('コピー')
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(url).then(() => toast('URLをコピーしました'))
  })
  const open = navButton('別タブで開く')
  open.addEventListener('click', () => window.open(url, '_blank', 'noopener'))
  row.append(copy, open)

  card.append(row, inline(note, `font-size:11px;margin-top:8px;color:${noteColor};line-height:1.7`))
  return card
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
