/**
 * 「ノーコードで作る」の「型から作る」タブ（2026-09-22・本人の依頼。ノーコードでWidgetを作る③）。
 *
 * 型を選ぶ → 入力欄に書く（右でその場で見え方を確かめる）→「LPに入れる」か「作成したWidgetに登録」。
 * 入れたあとは普通のWidgetなので、LPの中でクリックすれば見たまま編集（①②）でさらに直せる。
 *
 * - 見え方は配信と同じ土台（幅620px・LP_BASE_CSS・WIDGET_RESET_CSS）で、別の窓（iframe）に出す。
 *   動きのある型（カウントダウン・スライダー）もその場で動く。窓はスクリプトだけ許し、この画面には触れない
 * - 入力中の中身はタブを切り替えても残す（ページを読み込み直すまで）
 * - 登録したあとは、このあと入れる分のWidgetの名前（CSSのクラス）を付け直す（同じLPで色がまざらないように）
 */
import { promptCard } from '../../dialog.ts'
import { LP_BASE_CSS } from '../../lp-base-css.ts'
import { el, toast } from '../../ui.ts'
import { WIDGET_RESET_CSS } from '../../../shared/sb-preview-css.ts'
import { insertWidget } from '../widget-creator.ts'
import { saveCreatedWidget } from '../widget-library-storage.ts'
import type { NocodeContext, NocodeTab } from './nocode-panel.ts'
import { ensureNocodeFormCss } from './nocode-form-css.ts'
import { buildTemplateForm } from './template-form.ts'
import { TEMPLATES, templateById } from './templates/index.ts'
import { newUid } from './templates/kit.ts'
import { str, type NocodeTemplate, type TemplateData } from './templates/types.ts'

interface Draft {
  readonly templateId: string
  readonly data: TemplateData
  readonly uid: string
}

/** 入力中の中身（タブを切り替えても消えない。ページを読み込み直すまで） */
let draft: Draft | null = null

/** 打つたびに見え方を描き直すと重いので、手が止まってから描く */
const PREVIEW_DELAY_MS = 250

function previewDoc(html: string): string {
  return (
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<style>body{margin:0 auto;max-width:620px;font-family:"Hiragino Sans",sans-serif;background:#fff;color:#151515}` +
    `${LP_BASE_CSS}${WIDGET_RESET_CSS}</style>` +
    `</head><body><section class="sb-widget-block">${html}</section></body></html>`
  )
}

/** 登録するときの名前の初期値（「ボタン（今すぐ申し込む）」） */
function suggestName(template: NocodeTemplate, data: TemplateData): string {
  const hint = (str(data, 'title').trim() || str(data, 'label').trim()).slice(0, 20)
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

function renderPicker(root: HTMLElement, onPick: (template: NocodeTemplate) => void): void {
  root.className = ''
  root.removeAttribute('data-nc-view')
  const grid = el('div', { class: 'ncf-picker' })
  for (const template of TEMPLATES) {
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
      text: '型を選んで、入力欄に書くだけで作れます。できあがりは右側でその場で確かめられます。コードは出てきません。',
    }),
    grid,
  )
}

function renderForm(root: HTMLElement, ctx: NocodeContext, template: NocodeTemplate, onBack: () => void): void {
  const start = draft
  if (start === null) return
  root.className = 'ncf-edit-root'
  root.dataset['ncView'] = 'form'

  const back = button('← 型を選び直す', 'quiet')
  back.addEventListener('click', onBack)
  const top = el('div', { class: 'ncf-top' }, [back, el('span', { class: 'ncf-top__name', text: template.name })])

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
  const paintPreview = (): void => {
    if (draft === null) return
    frame.srcdoc = previewDoc(template.render(draft.data, draft.uid))
  }
  const error = el('span', { class: 'ncf-error' })
  error.setAttribute('role', 'alert')

  const form = buildTemplateForm({
    fields: template.fields,
    data: start.data,
    onChange: (data) => {
      if (draft === null) return
      draft = { ...draft, data }
      error.textContent = ''
      window.clearTimeout(timer)
      timer = window.setTimeout(paintPreview, PREVIEW_DELAY_MS)
    },
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
    const current = draft
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
      if (draft !== null) draft = { ...draft, uid: newUid() }
      toast(`「${name}」を作成したWidgetに登録しました`)
    })
  })

  const insert = button('LPに入れる', 'primary')
  insert.addEventListener('click', () => {
    const current = ready()
    if (current === null) return
    const html = template.render(current.data, current.uid)
    draft = null
    ctx.closeLibrary()
    // ライブラリが閉じてから本文へ入れる（Widgetライブラリの「追加」と同じ手順）
    requestAnimationFrame(() => {
      insertWidget(ctx.quill, html, template.name)
      toast(`「${template.name}」を入れました。LPの中でクリックすると、見たまま編集できます`)
    })
  })

  const foot = el('div', { class: 'ncf-foot' }, [error, register, insert])
  root.replaceChildren(top, seg, edit, foot)
  paintPreview()
}

export const TEMPLATE_TAB: NocodeTab = {
  id: 'template',
  label: '型から作る',
  render: (host, ctx) => {
    ensureNocodeFormCss()
    const root = el('div')
    root.dataset['ncTab'] = 'template'
    host.append(root)
    // 入力の画面は高さいっぱいを使う（入力欄だけがスクロールし、見え方は動かない）
    root.style.height = '100%'

    const showPicker = (): void =>
      renderPicker(root, (template) => {
        if (draft === null || draft.templateId !== template.id) {
          draft = { templateId: template.id, data: template.defaults(new Date()), uid: newUid() }
        }
        renderForm(root, ctx, template, showPicker)
      })

    const resumed = draft === null ? undefined : templateById(draft.templateId)
    if (resumed === undefined) showPicker()
    else renderForm(root, ctx, resumed, showPicker)
  },
}
