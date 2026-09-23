/**
 * 「ノーコードで作る」の「型から作る」「部品を積んで作る」タブ（2026-09-22・本人の依頼。ノーコードでWidgetを作る③④）。
 *
 * 型を選ぶ → 入力欄に書く（右でその場で見え方を確かめる）→「LPに入れる」か「作成したWidgetに登録」。
 * 「部品を積んで作る」は型が1つだけ（部品の並び）なので、選ぶ画面は出さずに入力から始める。
 * 入れたあとは普通のWidgetなので、LPの中でクリックすれば見たまま編集（①②）でさらに直せる。
 *
 * - 見え方は配信と同じ土台（幅620px・LP_BASE_CSS・WIDGET_RESET_CSS）で、別の窓（iframe）に出す。
 *   動きのある型（カウントダウン・スライダー）もその場で動く。窓はスクリプトだけ許し、この画面には触れない
 * - 入力中の中身はタブを切り替えても残す（ページを読み込み直すまで）
 * - 登録したあとは、このあと入れる分のWidgetの名前（CSSのクラス）を付け直す（同じLPで色がまざらないように）
 */
import { confirmCard, promptCard } from '../../dialog.ts'
import { LP_BASE_CSS } from '../../lp-base-css.ts'
import { el, toast } from '../../ui.ts'
import { WIDGET_RESET_CSS } from '../../../shared/sb-preview-css.ts'
import { insertWidget } from '../widget-creator.ts'
import { saveCreatedWidget } from '../widget-library-storage.ts'
import type { NocodeContext, NocodeTab } from './nocode-panel.ts'
import { setAt, type Path } from './form-state.ts'
import { showLibraryHint } from './library-hint.ts'
import { ensureNocodeFormCss } from './nocode-form-css.ts'
import { armSamplePick, cancelSamplePick } from './nocode-flow.ts'
import { PREVIEW_STEP_CSS } from './sample-dom.ts'
import { applyScreenIds, splitSampleScreens } from './sample-to-screens.ts'
import { screenLabel } from './screens-state.ts'
import { buildTemplateForm } from './template-form.ts'
import { BUILDER_TEMPLATE } from './templates/builder.ts'
import { TEMPLATES } from './templates/index.ts'
import { newUid } from './templates/kit.ts'
import { items, str, type ItemData, type NocodeTemplate, type TemplateData } from './templates/types.ts'

interface Draft {
  readonly templateId: string
  readonly data: TemplateData
  readonly uid: string
}

/** 入力中の中身の置き場（タブごと。タブを切り替えても消えない。ページを読み込み直すまで） */
interface DraftStore {
  get: () => Draft | null
  set: (draft: Draft | null) => void
}

/** 打つたびに見え方を描き直すと重いので、手が止まってから描く */
const PREVIEW_DELAY_MS = 250

function previewDoc(html: string): string {
  return (
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<style>body{margin:0 auto;max-width:620px;font-family:"Hiragino Sans",sans-serif;background:#fff;color:#151515}` +
    // 見本の部品で選んだ設問を出す（見え方だけ）
    `${LP_BASE_CSS}${WIDGET_RESET_CSS}${PREVIEW_STEP_CSS}</style>` +
    `</head><body><section class="sb-widget-block">${html}</section></body></html>`
  )
}

/**
 * 見本の部品: いつもの見本の一覧で見本を選んでもらう（「追加」を押した見本を受け取る。やめたら null）。
 * 選んでいる間はこの入口を隠すだけ（入力中の中身は残る）。
 */
function pickSampleFromLibrary(ctx: NocodeContext): Promise<{ title: string; html: string } | null> {
  return new Promise((resolve) => {
    let removeHint = (): void => undefined
    const finish = (sample: { title: string; html: string } | null): void => {
      removeHint()
      ctx.showPanel()
      if (sample !== null) toast(`「${sample.title}」を部品に入れました`)
      resolve(sample)
    }
    armSamplePick((sample) => finish(sample))
    ctx.hidePanel()
    removeHint = showLibraryHint(ctx.libraryRoot, '部品にしたい見本の「追加」を押してください（LPにはまだ入りません）', () => {
      cancelSamplePick()
      finish(null)
    })
  })
}

/** 登録するときの名前の初期値（「ボタン（今すぐ申し込む）」。積んだものは最初の見出し） */
function suggestName(template: NocodeTemplate, data: TemplateData): string {
  const firstHeading = items(data, 'blocks').find((block) => block['type'] === 'heading')
  const hint = (str(data, 'title').trim() || str(data, 'label').trim() || str(firstHeading ?? {}, 'text').trim()).slice(0, 20)
  return hint === '' || hint === template.name ? template.name : `${template.name}（${hint}）`
}

function button(text: string, variant: 'primary' | 'normal' | 'quiet'): HTMLButtonElement {
  const b = el('button', {
    class: variant === 'primary' ? 'ncf-btn ncf-btn--primary' : variant === 'quiet' ? 'ncf-btn ncf-btn--quiet' : 'ncf-btn',
    text,
  })
  b.type = 'button'
  return b
}

function renderPicker(root: HTMLElement, templates: readonly NocodeTemplate[], onPick: (template: NocodeTemplate) => void): void {
  root.className = ''
  root.removeAttribute('data-nc-view')
  const grid = el('div', { class: 'ncf-picker' })
  for (const template of templates) {
    const pick = el('button', { class: 'ncf-pick' }, [
      el('span', { class: 'ncf-pick__icon', html: template.icon }),
      el('span', {}, [
        el('span', { class: 'ncf-pick__name', text: template.name }),
        el('span', { class: 'ncf-pick__sum', text: template.summary }),
      ]),
    ])
    pick.type = 'button'
    pick.addEventListener('click', () => onPick(template))
    grid.append(pick)
  }
  root.replaceChildren(
    el('p', {
      class: 'ncf-intro',
      text:
        '型を選ぶと「部品を積んで作る」の画面と部品に、その型が部品として入ります。' +
        '入力欄に書くだけで作れて、できあがりは右側でその場で確かめられます。コードは出てきません。',
    }),
    grid,
  )
}

function renderForm(
  root: HTMLElement,
  ctx: NocodeContext,
  store: DraftStore,
  template: NocodeTemplate,
  top: { onBack?: () => void; intro?: string },
): void {
  const start = store.get()
  if (start === null) return
  root.className = 'ncf-edit-root'
  root.dataset['ncView'] = 'form'

  const topBar = el('div', { class: 'ncf-top' })
  if (top.onBack !== undefined) {
    const back = button('← 型を選び直す', 'quiet')
    back.addEventListener('click', top.onBack)
    topBar.append(back, el('span', { class: 'ncf-top__name', text: template.name }))
  } else if (top.intro !== undefined) {
    topBar.append(el('span', { class: 'ncf-top__intro', text: top.intro }))
  }

  // スマホは「入力」と「見え方」を切り替える（横に並べる幅が無い）。PCでは出さない
  const seg = el('div', { class: 'ncf-seg' })
  seg.setAttribute('role', 'group')
  const segButton = (view: 'form' | 'preview', label: string): HTMLButtonElement => {
    const b = button(label, 'normal')
    b.setAttribute('aria-pressed', String(view === 'form'))
    b.addEventListener('click', () => {
      root.dataset['ncView'] = view
      for (const other of seg.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b))
    })
    return b
  }
  seg.append(segButton('form', '入力'), segButton('preview', '見え方'))

  const frame = document.createElement('iframe')
  frame.title = 'できあがりの見え方'
  // スクリプトだけ許す（この画面の中身や保存には触れられない）
  frame.setAttribute('sandbox', 'allow-scripts')
  let timer = 0
  /** 見え方に出す画面（「部品を積んで作る」で編集している画面。決めていなければ最初の画面） */
  let previewScreen: string | undefined
  /** 見え方だけの差し替え（見本の部品で選んだ設問を出したHTML）。保存する中身には入れない */
  const previewOverrides = new Map<string, { path: Path; html: string }>()
  const paintPreview = (): void => {
    const current = store.get()
    if (current === null) return
    let previewData = current.data
    for (const override of previewOverrides.values()) previewData = setAt(previewData, override.path, override.html)
    frame.srcdoc = previewDoc(template.render(previewData, current.uid, previewScreen === undefined ? undefined : { screen: previewScreen }))
  }
  const error = el('span', { class: 'ncf-error' })
  error.setAttribute('role', 'alert')

  const form = buildTemplateForm({
    fields: template.fields,
    data: start.data,
    onChange: (data) => {
      const current = store.get()
      if (current === null) return
      store.set({ ...current, data })
      error.textContent = ''
      window.clearTimeout(timer)
      timer = window.setTimeout(paintPreview, PREVIEW_DELAY_MS)
    },
    onScreenChange: (screenId) => {
      previewScreen = screenId
      window.clearTimeout(timer)
      paintPreview()
    },
    pickSample: () => pickSampleFromLibrary(ctx),
    onPreviewOverride: (key, path, html) => {
      if (html === null) previewOverrides.delete(key)
      else previewOverrides.set(key, { path, html })
      window.clearTimeout(timer)
      timer = window.setTimeout(paintPreview, PREVIEW_DELAY_MS)
    },
    onPreviewReset: () => previewOverrides.clear(),
  })

  const edit = el('div', { class: 'ncf-edit' }, [
    el('div', { class: 'ncf-form' }, [form]),
    el('div', { class: 'ncf-preview' }, [
      el('span', { class: 'ncf-preview__label', text: '見え方（LPの幅で表示しています）' }),
      el('div', { class: 'ncf-preview__frame' }, [frame]),
    ]),
  ])

  /** 入れる前の確かめ。だめなら理由を出して、入力の画面に戻す */
  const ready = (): Draft | null => {
    const current = store.get()
    if (current === null) return null
    const problem = template.validate(current.data, new Date())
    if (problem === null) return current
    error.textContent = problem
    root.dataset['ncView'] = 'form'
    for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.textContent === '入力'))
    return null
  }

  const register = button('作成したWidgetに登録', 'normal')
  register.addEventListener('click', () => {
    const current = ready()
    if (current === null) return
    const html = template.render(current.data, current.uid)
    void promptCard({
      title: '作成したWidgetに登録',
      label: '名前（「作成したWidget」にこの名前で入ります）',
      value: suggestName(template, current.data),
      submitLabel: '登録する',
      validate: (v) => (v === '' ? '名前を入れてください' : null),
    }).then((name) => {
      if (name === null) return
      if (!saveCreatedWidget(name, html)) {
        toast('登録できませんでした。画像が大きいと、このブラウザに保存しきれないことがあります', 'error')
        return
      }
      // このあと入れる分は別の名前にする（登録した分と同じLPに並んでも、色がまざらない）
      const latest = store.get()
      if (latest !== null) store.set({ ...latest, uid: newUid() })
      toast(`「${name}」を作成したWidgetに登録しました`)
    })
  })

  const insert = button('LPに入れる', 'primary')
  insert.addEventListener('click', () => {
    const current = ready()
    if (current === null) return
    const html = template.render(current.data, current.uid)
    store.set(null)
    ctx.closeLibrary()
    // ライブラリが閉じてから本文へ入れる（Widgetライブラリの「追加」と同じ手順）
    requestAnimationFrame(() => {
      insertWidget(ctx.quill, html, template.name)
      toast(`「${template.name}」を入れました。LPの中でクリックすると、見たまま編集できます`)
    })
  })

  const foot = el('div', { class: 'ncf-foot' }, [error, register, insert])
  root.replaceChildren(topBar, seg, edit, foot)
  paintPreview()
}

/**
 * 「部品を積んで作る」のタブ（型は1つ＝部品の並びなので、選ぶ画面は出さずに入力から始める）。
 * 入力中の中身（draft）はタブを切り替えても残す。見本のカード・型の一覧からは draft に入れてから開く。
 */
function makeBuilderTab(intro: string): NocodeTab & { readonly draft: DraftStore } {
  let draft: Draft | null = null
  const store: DraftStore = {
    get: () => draft,
    set: (next) => {
      draft = next
    },
  }
  return {
    id: BUILDER_TEMPLATE.id,
    label: '部品を積んで作る',
    draft: store,
    render: (host, ctx) => {
      ensureNocodeFormCss()
      const root = el('div')
      root.dataset['ncTab'] = BUILDER_TEMPLATE.id
      host.append(root)
      // 入力の画面は高さいっぱいを使う（入力欄だけがスクロールし、見え方は動かない）
      root.style.height = '100%'
      if (draft === null || draft.templateId !== BUILDER_TEMPLATE.id) {
        draft = { templateId: BUILDER_TEMPLATE.id, data: BUILDER_TEMPLATE.defaults(new Date()), uid: newUid() }
      }
      renderForm(root, ctx, store, BUILDER_TEMPLATE, { intro })
    },
  }
}

export const BUILDER_TAB = makeBuilderTab(
  '見出し・文章・画像・ボタンなどを、上から順に積んで作ります。「見本」や「型」も部品として使えます。' +
    '画面①②…を作ると、ボタンや画像を押したときに、その画面へすぐ切り替えられます。',
)

export const TEMPLATE_TAB: NocodeTab = {
  id: 'template',
  label: '型から作る',
  render: (host, ctx) => {
    ensureNocodeFormCss()
    const root = el('div')
    root.dataset['ncTab'] = 'template'
    root.style.height = '100%'
    host.append(root)
    renderPicker(root, TEMPLATES, (template) => {
      void startBuilderWithBlock(templateBlock(template), template.name).then((ok) => {
        if (ok) ctx.openTab(BUILDER_TAB.id)
      })
    })
  },
}

/** 型1つぶんの部品（「部品を積んで作る」の部品の形） */
function templateBlock(template: NocodeTemplate): ItemData {
  return { type: `tpl-${template.id}`, uid: newUid(), ...template.defaults(new Date()) }
}

/** 作りかけの中身を置き換えてよいか（あれば確かめる） */
async function canReplaceDraft(): Promise<boolean> {
  if (BUILDER_TAB.draft.get() === null) return true
  return confirmCard({
    title: '作りかけのWidgetを置き換えますか？',
    message: '「部品を積んで作る」に作りかけの中身があります。ここから作り直すと、その中身は消えます。',
    submitLabel: '作り直す',
    danger: true,
  })
}

/** 部品1つを画面①に置いて「部品を積んで作る」を始める */
async function startBuilderWithBlock(block: ItemData, title: string): Promise<boolean> {
  if (!(await canReplaceDraft())) return false
  BUILDER_TAB.draft.set({
    templateId: BUILDER_TEMPLATE.id,
    data: { ...BUILDER_TEMPLATE.defaults(new Date()), screens: [{ id: 's1', name: screenLabel(1), blocks: [block] }] },
    uid: newUid(),
  })
  toast(`「${title}」を部品にしました。画面と部品で続けて作れます`)
  return true
}


/**
 * 見本のカードの「画面を作って使う」から、その見本を部品にして「部品を積んで作る」を始める
 * （本人の依頼「見本からでも型からでも、部品を積んで作るときと同じ『画面と部品』が欲しい」）。
 * 設問①②③で進む見本は、設問ごとの部品にして画面①②③に分ける。
 * 作りかけの中身があるときは、消してよいか確かめる（やめたら false）。
 */
export async function startBuilderWithSample(sample: { title: string; html: string }): Promise<boolean> {
  if (!(await canReplaceDraft())) return false
  const parts = splitSampleScreens(sample.html)
  const ids = parts.map((_, index) => `s${index + 1}`)
  const screens = parts.map((part, index) => ({
    id: ids[index] ?? `s${index + 1}`,
    name: screenLabel(index + 1),
    blocks: [{ type: 'sample', title: sample.title, html: applyScreenIds(part, ids) }],
  }))
  BUILDER_TAB.draft.set({
    templateId: BUILDER_TEMPLATE.id,
    data: { ...BUILDER_TEMPLATE.defaults(new Date()), screens },
    uid: newUid(),
  })
  return true
}
