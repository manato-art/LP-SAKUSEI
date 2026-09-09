/**
 * Widgetを自分で作るフォームと、選んだWidgetの差し込み（widget-library.ts から分離）。
 *
 * HTML/CSS を書いて名前を付けて保存し、そのままLPへ入れられるようにする。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { highlight } from './syntax-highlight.ts'
import { applyCodeSelectionStyle } from './code-selection.ts'
import { stripLeakedEditorImgBorder } from './widget-css-sanitize.ts'
import { saveCreatedWidget } from './widget-library-storage.ts'

export function insertWidget(quill: Quill, bodyHtml: string | null, title: string): void {
  if (bodyHtml === null) {
    const range = quill.getSelection(true)
    const index = range?.index ?? quill.getLength()
    const placeholder =
      `<div style="border:1px dashed #B0B0B0;border-radius:6px;padding:16px;margin:8px 0;` +
      `background:#FAFAFA;color:#555;text-align:center;font-size:14px">【Widget】${escapeHtml(title)}</div>`
    quill.clipboard.dangerouslyPasteHTML(index, placeholder, 'user')
    return
  }
  const doc = new DOMParser().parseFromString(bodyHtml, 'text/html')
  // ウィジェットの <style>（見た目）と <script>（動作）はそのまま保持する。
  // 実SBのウィジェットは自己完結したJS（アンケートの設問送り・カルーセル・カウントダウン等）を
  // 内蔵しており、それを配信LP/プレビューでそのまま実行することで実SBと同じ動きを再現する。
  // 赤枠警告(.ql-editor img{border:2px solid red})だけは除去（他画像への漏れ防止）。
  const cleaned = stripLeakedEditorImgBorder(doc.head.innerHTML + doc.body.innerHTML)
  const range = quill.getSelection(true)
  const index = range?.index ?? quill.getLength()
  quill.insertEmbed(index, 'sbwidget', cleaned, 'user')
}
/**
 * 本番 SquadBeyond の「Widget追加」フォームを再現する。
 * - Widget名（テキスト）
 * - カテゴリー（ドロップダウン）
 * - 説明文（テキスト）
 * - サムネイル（+アイコンの枠）
 * - エディタ領域（textarea で代替）
 * - HTML(カスタム) / CSS(カスタム) コードエディタ
 * - 「追加する」ボタン
 */
export function openWidgetCreator(
  libraryRoot: HTMLElement,
  quill: Quill,
  libraryClose: () => void,
): void {
  // ライブラリの本体エリアに重ねて表示（サイドバーはそのまま）
  const contentArea = libraryRoot.querySelector<HTMLElement>('.css-5v5pzb')
  if (contentArea === null) return

  const creator = document.createElement('div')
  creator.dataset['widgetCreator'] = 'true'
  creator.style.cssText =
    'position:absolute;inset:0;z-index:10;background:#fff;display:flex;flex-direction:column;overflow-y:auto'

  /* ── ヘッダー ── */
  const header = document.createElement('div')
  header.style.cssText =
    'display:flex;align-items:center;padding:16px 24px;border-bottom:1px solid #eee;flex-shrink:0'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    'border:none;background:none;color:#555;font:14px "Hiragino Sans",sans-serif;cursor:pointer;padding:4px 8px'
  const headerTitle = document.createElement('h6')
  headerTitle.textContent = 'Widget追加'
  headerTitle.style.cssText =
    'flex:1;text-align:center;font:600 15px/1.4 "Hiragino Sans",sans-serif;margin:0;color:#333'
  const submitBtn = document.createElement('button')
  submitBtn.type = 'button'
  submitBtn.textContent = '追加する'
  submitBtn.style.cssText =
    'border:none;background:#1976d2;color:#fff;border-radius:4px;padding:6px 20px;' +
    'font:600 13px/1.4 "Hiragino Sans",sans-serif;cursor:pointer'
  header.append(closeBtn, headerTitle, submitBtn)

  /* ── メタ情報行 ── */
  const metaRow = document.createElement('div')
  metaRow.style.cssText =
    'display:flex;align-items:flex-start;gap:16px;padding:20px 24px;flex-shrink:0'

  // サムネイル枠
  const thumbWrap = document.createElement('div')
  thumbWrap.style.cssText =
    'width:80px;height:80px;border:2px dashed #ccc;border-radius:8px;' +
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;color:#aaa'
  const thumbIcon = document.createElement('span')
  thumbIcon.style.cssText = 'font-size:28px;line-height:1'
  thumbIcon.textContent = '+'
  thumbWrap.append(thumbIcon)
  thumbWrap.addEventListener('click', () => {
    toast('サムネイルのアップロードはクローンでは未対応です')
  })

  // Widget名
  const nameGroup = createFormGroup('Widget名', 'text', '入力してください')

  // カテゴリー
  const catGroup = document.createElement('div')
  catGroup.style.cssText = 'flex:1;min-width:0'
  const catLabel = document.createElement('label')
  catLabel.textContent = 'カテゴリー'
  catLabel.style.cssText = 'display:block;font:12px "Hiragino Sans",sans-serif;color:#777;margin-bottom:4px'
  const catSelect = document.createElement('select')
  catSelect.style.cssText =
    'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;' +
    'font:14px "Hiragino Sans",sans-serif;color:#333;background:#fff'
  const catOptions = [
    '選択してください', '見出し', '囲み枠', '吹き出し', '文字', '画像',
    'クチコミ', 'フッター', 'アクション', 'ボタン', '表', '埋め込み',
    '自動表示', 'アンケート', 'テンプレート記事', 'オリジナル', '区切り線',
  ]
  for (const opt of catOptions) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    catSelect.append(o)
  }
  catGroup.append(catLabel, catSelect)

  // 説明文
  const descGroup = createFormGroup('説明文', 'text', '入力してください')

  metaRow.append(thumbWrap, nameGroup, catGroup, descGroup)

  /* ── エディタ領域 ── */
  const editorArea = document.createElement('div')
  editorArea.style.cssText =
    'flex:1;display:flex;gap:0;padding:0 24px 20px;min-height:300px'

  // 左: Quill風エディタ (textarea)
  const editorLeft = document.createElement('div')
  editorLeft.style.cssText = 'flex:1;display:flex;flex-direction:column;border:1px solid #ddd;border-radius:4px;overflow:hidden'

  const toolbar = createEditorToolbar()
  const editorBody = document.createElement('textarea')
  editorBody.placeholder = 'WidgetのHTMLを入力してください'
  editorBody.style.cssText =
    'flex:1;border:none;resize:none;padding:16px;font:14px/1.6 "Hiragino Sans",monospace;' +
    'outline:none;background:#fff;min-height:200px'
  editorLeft.append(toolbar, editorBody)

  // 右: HTML(カスタム) / CSS(カスタム)
  const editorRight = document.createElement('div')
  editorRight.style.cssText = 'width:280px;display:flex;flex-direction:column;gap:0;flex-shrink:0;margin-left:-1px'

  const htmlPanel = createCodePanel('HTML(カスタム)', '<div class="my-widget">\n  \n</div>')
  const cssPanel = createCodePanel('CSS(カスタム)', '.my-widget {\n  \n}')
  editorRight.append(htmlPanel, cssPanel)

  editorArea.append(editorLeft, editorRight)

  /* ── 組み立て ── */
  creator.append(header, metaRow, editorArea)

  // dialog の paper にポジション relative が必要
  const paper = libraryRoot.querySelector<HTMLElement>('.MuiDialog-paper')
  if (paper !== null) paper.style.position = 'relative'
  ;(paper ?? contentArea).append(creator)

  /* ── イベント ── */
  closeBtn.addEventListener('click', () => creator.remove())

  submitBtn.addEventListener('click', () => {
    const nameInput = nameGroup.querySelector('input') as HTMLInputElement | null
    const widgetName = nameInput?.value.trim() ?? ''
    if (widgetName === '') {
      toast('Widget名を入力してください', 'error')
      return
    }

    // HTML/CSS パネルの内容、またはエディタ本文を使う
    const htmlTextarea = htmlPanel.querySelector('textarea') as HTMLTextAreaElement | null
    const cssTextarea = cssPanel.querySelector('textarea') as HTMLTextAreaElement | null
    const htmlCode = htmlTextarea?.value.trim() ?? ''
    const cssCode = cssTextarea?.value.trim() ?? ''
    const editorContent = editorBody.value.trim()

    // コード入力があればそちらを優先、無ければエディタ本文
    const finalHtml = htmlCode !== '' || cssCode !== ''
      ? (cssCode !== '' ? `<style>${cssCode}</style>` : '') + htmlCode
      : editorContent

    if (finalHtml === '') {
      toast('HTMLまたはエディタの内容を入力してください', 'error')
      return
    }

    // 作成したWidgetは localStorage に保存し、「作成したWidget」カテゴリーから再利用できるようにする（指示147）。
    saveCreatedWidget(widgetName, finalHtml)

    creator.remove()
    libraryClose()
    requestAnimationFrame(() => {
      insertWidget(quill, finalHtml, widgetName)
      toast(`「${widgetName}」を追加しました`)
    })
  })
}
function createFormGroup(label: string, type: string, placeholder: string): HTMLDivElement {
  const group = document.createElement('div')
  group.style.cssText = 'flex:1;min-width:0'
  const lbl = document.createElement('label')
  lbl.textContent = label
  lbl.style.cssText = 'display:block;font:12px "Hiragino Sans",sans-serif;color:#777;margin-bottom:4px'
  const input = document.createElement('input')
  input.type = type
  input.placeholder = placeholder
  input.style.cssText =
    'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;' +
    'font:14px "Hiragino Sans",sans-serif;color:#333;box-sizing:border-box'
  group.append(lbl, input)
  return group
}
function createEditorToolbar(): HTMLDivElement {
  const toolbar = document.createElement('div')
  toolbar.style.cssText =
    'display:flex;flex-wrap:wrap;gap:2px;padding:6px 8px;border-bottom:1px solid #ddd;background:#fafafa'
  const tools = [
    '↩', '↪', 'sans-serif ▾', '−', '16', '+',
    'B', 'U', 'S', '≡ ▾', 'A ▾', '■ ▾',
    '🖼', '💡', '⏎', '🔗', 'T̸',
  ]
  for (const t of tools) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = t
    btn.style.cssText =
      'border:1px solid #e0e0e0;background:#fff;border-radius:3px;padding:3px 6px;' +
      'font:12px "Hiragino Sans",sans-serif;color:#555;cursor:pointer;min-width:24px'
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      toast('ツールバー機能はクローンでは利用できません')
    })
    toolbar.append(btn)
  }
  return toolbar
}
function createCodePanel(title: string, placeholder: string): HTMLDivElement {
  const lang = title.toLowerCase().includes('css') ? 'css' : 'html'
  const panel = document.createElement('div')
  panel.style.cssText =
    'flex:1;display:flex;flex-direction:column;border:1px solid #333;overflow:hidden'

  const header = document.createElement('div')
  header.style.cssText =
    'background:#151515;color:#fff;padding:8px 12px;font:12px/1.4 monospace;' +
    'display:flex;align-items:center;justify-content:space-between;flex-shrink:0'
  header.textContent = title

  // プレビュー / コード切替ボタン（見た目のみ）
  const btnGroup = document.createElement('span')
  btnGroup.style.cssText = 'display:flex;gap:4px'
  for (const icon of ['👁', '{ }']) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = icon
    b.style.cssText =
      'border:1px solid #555;background:#2B2B2B;color:#ccc;border-radius:3px;' +
      'padding:2px 6px;font:11px monospace;cursor:pointer'
    btnGroup.append(b)
  }
  header.append(btnGroup)

  // overlay パターン: pre(ハイライト) + textarea(入力)
  const editorBox = document.createElement('div')
  editorBox.style.cssText =
    'flex:1;position:relative;overflow:hidden;min-height:100px;background:#151515'

  const pre = document.createElement('pre')
  pre.style.cssText =
    // 指示177: inset:0 + overflow:hidden だと内容がコンテナ高さで切れ、スクロール先が空になる
    'position:absolute;top:0;left:0;min-width:100%;margin:0;padding:10px 12px;' +
    'font:13px/1.5 "SF Mono",Menlo,monospace;white-space:pre;pointer-events:none;' +
    'overflow:visible;tab-size:2;word-wrap:normal'
  pre.innerHTML = highlight(placeholder, lang)

  const textarea = document.createElement('textarea')
  textarea.value = placeholder
  textarea.spellcheck = false
  textarea.style.cssText =
    'position:relative;z-index:1;width:100%;height:100%;border:none;resize:none;padding:10px 12px;' +
    'font:13px/1.5 "SF Mono",Menlo,monospace;color:transparent;caret-color:#eeffff;' +
    'background:transparent;outline:none;white-space:pre;tab-size:2;box-sizing:border-box'
  // 指示177: 選択範囲が不透明だと下の色付きコードが隠れて読めなくなる
  applyCodeSelectionStyle(textarea)

  textarea.addEventListener('input', () => {
    pre.innerHTML = highlight(textarea.value, lang)
  })
  textarea.addEventListener('scroll', () => {
    pre.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
  })

  editorBox.append(pre, textarea)
  panel.append(header, editorBox)
  return panel
}
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
