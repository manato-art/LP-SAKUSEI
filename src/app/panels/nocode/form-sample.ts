/**
 * 「部品を積んで作る」の見本の部品の入力（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「用意されている見本から作った時にも、部品を積んで作るみたいな視覚的にわかりやすい要素や、
 * ページの切り替わりを入れて欲しい」（決定: 見本を部品として積む・切り替わりは両方）。
 *  - 「見本を選ぶ」→ いつもの見本の一覧に切り替わり、「追加」を押した見本がこの部品に入る
 *  - 中身（文字・画像・ボタン）を上から順に入力欄で直す（コードは出さない）
 *  - ボタンは「押したとき: 見本のまま／画面へ移る」を選べる（画面①②…の切り替え）
 *  - 見本にもともとある設問①②…は、タブで切り替えて直す。右の見え方もその設問を出す（見え方だけ。保存はしない）
 */
import { isAllowedLinkUrl } from '../../../shared/link-html.ts'
import { toast } from '../../ui.ts'
import { node } from './form-controls.ts'
import { pickLpImage } from './lp-image.ts'
import { editSample, previewWithStep, readSample, type SampleChange, type SampleInfo } from './sample-dom.ts'
import type { Slot } from './sample-model.ts'

export interface SampleEditorOptions {
  read: () => { title: string; html: string }
  /** 見本を入れ替える（選んだ・選び直した） */
  replace: (sample: { title: string; html: string }) => void
  /** 中身を直した */
  writeHtml: (html: string) => void
  pickSample?: () => Promise<{ title: string; html: string } | null>
  screenOptions: () => readonly { value: string; label: string }[]
  /** 見え方だけに使うHTML（選んだ設問を出す）。null で元に戻す */
  onPreview: (html: string | null) => void
  /** 設問のタブ（組み立て直しても残す） */
  activeStep: { get: () => number; set: (index: number) => void }
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const stepLabel = (index: number): string => `設問${Array.from(CIRCLED)[index] ?? String(index + 1)}`

let idSeq = 0
const nextId = (): string => `ncs-${(idSeq += 1)}`

function labeled(label: string, control: HTMLElement): HTMLElement {
  const wrap = node('div', 'ncf-field')
  const id = nextId()
  const labelEl = node('label', 'ncf-label', label)
  labelEl.htmlFor = id
  const input = control.matches('input,textarea,select,button') ? control : control.querySelector('input,textarea,select,button')
  if (input !== null) input.id = id
  wrap.append(labelEl, control)
  return wrap
}

export function sampleEditor(options: SampleEditorOptions): HTMLElement {
  const wrap = node('div', 'ncf-sample')
  const { title, html } = options.read()
  const head = node('div', 'ncf-sample__head')
  head.append(node('span', 'ncf-sample__title', title === '' ? '見本はまだ選ばれていません' : `見本：${title}`))
  const pick = node('button', 'ncf-btn', html === '' ? '見本を選ぶ' : '選び直す')
  pick.type = 'button'
  pick.disabled = options.pickSample === undefined
  pick.addEventListener('click', () => {
    void options.pickSample?.().then((sample) => {
      if (sample !== null) options.replace(sample)
    })
  })
  head.append(pick)
  wrap.append(head)
  if (html === '') {
    wrap.append(
      node('p', 'ncf-note', '「見本を選ぶ」を押すと、いつもの見本の一覧に切り替わります。使いたい見本の「追加」を押すと、この部品に入ります（LPにはまだ入りません）。'),
    )
    return wrap
  }
  const body = node('div', 'ncf-sample__body')
  body.append(node('p', 'ncf-note', '見本の中身を読み込んでいます…'))
  wrap.append(body)
  readSample(html).then(
    (info) => renderBody(body, info, options),
    () => body.replaceChildren(node('p', 'ncf-warn', '見本の中身を読み込めませんでした。選び直してください')),
  )
  return wrap
}

function renderBody(body: HTMLElement, info: SampleInfo, options: SampleEditorOptions): void {
  let current = options.read().html
  const steps = info.stepIds.length >= 2 ? info.stepIds : []
  const active = Math.min(Math.max(options.activeStep.get(), 0), Math.max(steps.length - 1, 0))
  /** 見え方: 2つ目以降の設問を選んでいるときだけ、その設問を出す（1つ目は見本のままの見え方） */
  const paintPreview = (): void => options.onPreview(steps.length > 0 && active > 0 ? previewWithStep(current, steps, active) : null)
  const apply = (id: string, change: SampleChange): void => {
    const next = editSample(current, id, change)
    if (next === current) return
    current = next
    options.writeHtml(current)
    paintPreview()
  }

  body.replaceChildren()
  if (steps.length > 0) {
    body.append(node('p', 'ncf-note', 'この見本は、答えるたびに次の設問へ進みます。直したい設問を選んでください（見え方もその設問になります）。'))
    const tabs = node('div', 'ncf-screen-tabs')
    tabs.setAttribute('role', 'tablist')
    steps.forEach((_, index) => {
      const tab = node('button', 'ncf-screen-tab', stepLabel(index))
      tab.type = 'button'
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(index === active))
      tab.addEventListener('click', () => {
        options.activeStep.set(index)
        renderBody(body, info, options)
      })
      tabs.append(tab)
    })
    body.append(tabs)
  }
  paintPreview()

  const shown = info.slots.filter((slot) => steps.length === 0 || slot.step === null || slot.step === active)
  if (shown.length === 0) {
    body.append(node('p', 'ncf-note', 'この見本には、ここで直せる文字・画像・ボタンがありません。LPに入れたあと、見たまま編集で直せます。'))
    return
  }
  let lastGroup: string | null = null
  for (const slot of shown) {
    const group = steps.length === 0 ? '' : slot.step === null ? '共通の部分' : `${stepLabel(active)}の中身`
    if (group !== '' && group !== lastGroup) body.append(node('p', 'ncf-sample__group', group))
    lastGroup = group
    body.append(slotEl(slot, apply, options))
  }
}

function slotEl(slot: Slot, apply: (id: string, change: SampleChange) => void, options: SampleEditorOptions): HTMLElement {
  const row = node('div', 'ncf-sample__slot')
  switch (slot.kind) {
    case 'text': {
      const long = slot.text.length > 24
      const input = node(long ? 'textarea' : 'input', 'ncf-input') as HTMLInputElement | HTMLTextAreaElement
      if (input instanceof HTMLTextAreaElement) input.rows = Math.min(6, Math.ceil(slot.text.length / 26) + 1)
      input.value = slot.text
      input.addEventListener('input', () => apply(slot.id, { kind: 'text', value: input.value }))
      row.append(labeled('文字', input))
      break
    }
    case 'image': {
      const box = node('div', 'ncf-image')
      const thumb = node('img', 'ncf-image__thumb')
      thumb.src = slot.src
      thumb.alt = slot.alt
      const change = node('button', 'ncf-btn', '画像を変える')
      change.type = 'button'
      change.addEventListener('click', () => {
        void pickLpImage().then(
          (picked) => {
            if (picked === null) return
            apply(slot.id, { kind: 'image', value: picked })
            thumb.src = picked
          },
          () => toast('画像を読み込めませんでした', 'error'),
        )
      })
      box.append(thumb, change)
      row.append(labeled(slot.alt === '' ? '画像' : `画像（${slot.alt}）`, box))
      break
    }
    case 'control': {
      const noun = slot.tag === 'LABEL' ? '選択肢' : 'ボタン'
      const label = node('input', 'ncf-input')
      label.type = 'text'
      label.value = slot.label
      label.addEventListener('input', () => apply(slot.id, { kind: 'label', value: label.value }))
      row.append(labeled(`${noun}の文字`, label))
      // 画面①②…に作り変えた見本の中で、次の設問へ移るボタンはリンクではない（リンク先の欄は出さない）
      const movesInside = slot.internal && slot.go !== null
      if (slot.tag === 'A' && !movesInside) {
        const href = node('input', 'ncf-input')
        href.type = 'url'
        href.value = slot.href ?? ''
        const warn = node('span', 'ncf-warn')
        warn.hidden = true
        href.addEventListener('input', () => {
          const url = href.value.trim()
          warn.textContent = url !== '' && !isAllowedLinkUrl(url) ? 'このリンクは開けません。https:// から始まるURLを書いてください' : ''
          warn.hidden = warn.textContent === ''
          if (warn.hidden) apply(slot.id, { kind: 'href', value: url })
        })
        const hrefField = labeled('リンク先', href)
        hrefField.append(warn)
        row.append(hrefField)
      }
      // 画面①②…に作り変えた見本の中のボタンは、見本自身の画面を切り替える（外の画面へは移せない）
      if (slot.internal) {
        const to = /^s(\d{1,4})$/.exec(slot.go ?? '')
        row.append(
          node(
            'p',
            'ncf-note',
            movesInside && to !== null ? `押すと、見本の中の「${stepLabel(Number(to[1]) - 1)}」へ移ります。` : '押したときは見本のまま動きます（上のリンク先へ）。',
          ),
        )
        break
      }
      const action = node('select', 'ncf-input')
      for (const [value, text] of [
        ['keep', '見本のまま（元の動き）'],
        ['screen', '画面へ移る（すぐ切り替わる）'],
      ] as const) {
        const opt = node('option', '', text)
        opt.value = value
        action.append(opt)
      }
      action.value = slot.go === null ? 'keep' : 'screen'
      const target = node('select', 'ncf-input')
      const fillTargets = (): void => {
        target.replaceChildren()
        const blank = node('option', '', '（選んでください）')
        blank.value = ''
        target.append(blank)
        for (const option of options.screenOptions()) {
          const opt = node('option', '', option.label)
          opt.value = option.value
          target.append(opt)
        }
        target.value = slot.go ?? ''
      }
      fillTargets()
      const targetField = labeled('移る先の画面', target)
      targetField.hidden = action.value !== 'screen'
      action.addEventListener('change', () => {
        targetField.hidden = action.value !== 'screen'
        if (action.value === 'keep') apply(slot.id, { kind: 'go', value: null })
        else if (target.value !== '') apply(slot.id, { kind: 'go', value: target.value })
      })
      target.addEventListener('change', () => apply(slot.id, { kind: 'go', value: target.value === '' ? null : target.value }))
      row.append(labeled('押したとき', action), targetField)
      break
    }
  }
  return row
}
