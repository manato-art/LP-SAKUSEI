/**
 * LPエディタ（企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** 採取した実DOMをそのまま土台として描画し、
 * `data-test` 属性を目印に挙動だけを付ける（＝企画書 §11 の「島」の再実装）。
 * 見た目は本物のマークアップ＋実CSS（Emotion含む）で担保される。
 */
import Quill from 'quill'
import 'quill/dist/quill.bubble.css'
import substrate from '../fragments/ab_tests__UID__articles__editor-beyond-empty.html?raw'
import { api, type Version } from '../api.ts'
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
  articleUid: string
  versions: Version[]
  currentUid: string
}

export async function renderEditor(container: HTMLElement, abTestUid: string): Promise<void> {
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

  // ── 土台を描画（本物のDOMをそのまま）──
  const root = document.createElement('div')
  root.innerHTML = substrate
  container.append(root)

  // ── プレビュー枠の iframe を、動くQuillに差し替える ──
  const quill = mountQuill(root)

  const ctx: EditorContext = {
    root,
    quill,
    articleUid,
    versions: [...versions],
    currentUid: versions[0]?.uid ?? '',
  }

  applyVersionToPanel(ctx)
  wireVersionPanel(ctx)
  wireSideToolbar(ctx)
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

function wireSideToolbar(ctx: EditorContext): void {
  ctx.root.querySelector(HOOK.undo)?.addEventListener('click', () => ctx.quill.history.undo())
  ctx.root.querySelector(HOOK.redo)?.addEventListener('click', () => ctx.quill.history.redo())
  ctx.root.querySelector(HOOK.tagSettings)?.addEventListener('click', () => {
    toast('タグ設定は未実装です（採取済みなので次に作れます）', 'error')
  })

  ctx.root.querySelector(HOOK.versionSettings)?.addEventListener('click', () => {
    toast('Version設定は未実装です（採取済みなので次に作れます）', 'error')
  })

  // 未実装の右レールツールは、実際の名前を出して「何が未実装か」を分かるようにする
  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined || icon.querySelector('[data-test]') !== null) continue
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
