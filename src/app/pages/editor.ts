/**
 * LPエディタ（企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** 採取した実DOMをそのまま土台として描画し、
 * `data-test` 属性を目印に挙動だけを付ける（＝企画書 §11 の「島」の再実装）。
 * 見た目は本物のマークアップ＋実CSS（Emotion含む）で担保される。
 */
import Quill from 'quill'
import 'quill/dist/quill.bubble.css'
import substrate from '../fragments/ab_tests__UID__articles__editor-target.html?raw'
import { api, type Version } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'

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
  editorWrapper: '[data-test="editor-wrapper"], [data-test="editorWrapper"]',
  /** Version行は記事uidを属性で持っている（実DOMで判明） */
  versionRow: '[data-article-uid]',
  funnelPrev: '[class*="changePrevFunnelStep"]',
  funnelNext: '[class*="changeNextFunnelStep"]',
  versionLinkInput: '#versionLink',
} as const

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
  const folderName = folders.folders.find((f) => f.id === ab_test.folder_id)?.name ?? ''

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
    articleUid,
    versions: [...versions],
    currentUid: versions[0]?.uid ?? '',
  }

  applyVersionToPanel(ctx)
  wireVersionPanel(ctx)
  wireSideToolbar(ctx, ab_test.title, folderName)
  wireTopBar(root, ab_test.title, folderName)
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
  return new Quill(host, {
    theme: 'bubble',
    placeholder: 'ここにLPの内容を入力してください',
    modules: {
      toolbar: [
        ['bold', 'underline', 'italic', 'strike'],
        [{ script: 'super' }, { script: 'sub' }],
        ['link'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ header: [1, 2, 3, false] }],
        [{ size: ['10px', '13px', '15px', '17px', '19px', '21px', '23px', '25px', '27px', '29px'] }],
        [{ font: [] }],
        ['clean'],
      ],
    },
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

  const total = ctx.versions.reduce((s, v) => s + v.distribution_ratio, 0)
  showRatioWarning(ctx.root, total)
}

/** 配信割合の合計が100%でないときの警告（企画書 §9-1[2]） */
function showRatioWarning(root: HTMLElement, total: number): void {
  const id = 'sb-ratio-warning'
  root.querySelector(`#${id}`)?.remove()
  if (total === 100) return
  const list = root.querySelector(HOOK.versionList) ?? root
  const warn = document.createElement('div')
  warn.id = id
  warn.textContent = `配信割合の合計が${total}%です。100%になるよう調整してください。`
  warn.style.cssText =
    'color:#D0021B;font-size:11px;padding:8px 12px;line-height:1.6;font-family:"Hiragino Sans",sans-serif'
  list.append(warn)
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
  ctx.root.querySelector(HOOK.undo)?.addEventListener('click', () => ctx.quill.history.undo())
  ctx.root.querySelector(HOOK.redo)?.addEventListener('click', () => ctx.quill.history.redo())
  ctx.root.querySelector(HOOK.tagSettings)?.addEventListener('click', () => {
    toast('タグ設定は未実装です（採取済みなので次に作れます）', 'error')
  })

  ctx.root.querySelector(HOOK.versionSettings)?.addEventListener('click', () => {
    toast('Version設定は未実装です（採取済みなので次に作れます）', 'error')
  })

  ctx.root.querySelector(HOOK.preview)?.addEventListener('click', async () => {
    await saveHtml(ctx)
    openPreview(ctx, previewTitle, previewFolder)
  })

  // 未実装の右レールツールは、実際の名前を出して「何が未実装か」を分かるようにする
  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined) continue
    // 既に配線したものは飛ばす。data-test だけでなく aria-label 付き（プレビュー等）も対象。
    const alreadyWired =
      icon.querySelector('[data-test]') !== null || icon.querySelector('[aria-label]') !== null
    if (alreadyWired) continue
    const name = SIDE_TOOLS[index] ?? 'このツール'
    icon.style.cursor = 'pointer'
    icon.addEventListener('click', () => toast(`${name} は未実装です`, 'error'))
  }

  // 保存（実物にはショートカットが無いが、作業用に足している）
  ctx.root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      void saveHtml(ctx).then(() => toast('保存しました'))
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
 * プレビュー画面（右レール1番目）。実DOMの提供により、実物は**専用の1画面**だと判明した:
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
    ['中間ページ', `/ab_tests/${ctx.abTestUid}/redirect_pages`],
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

  const widthToggle = navButton('SP表示に切替')
  const frame = document.createElement('iframe')
  frame.id = 'previewIframe'
  frame.style.cssText = 'width:620px;height:70vh;border:none;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15)'
  stage.append(widthToggle, frame)

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

  let isSp = false
  widthToggle.addEventListener('click', () => {
    isSp = !isSp
    frame.style.width = isSp ? '430px' : '620px'
    widthToggle.textContent = isSp ? 'PC表示に切替' : 'SP表示に切替'
  })
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
