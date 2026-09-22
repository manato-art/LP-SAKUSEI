/**
 * 「型から作る」「部品を積んで作る」の1つの値を入れる入力（2026-09-22・ノーコードでWidgetを作る③④）。
 *
 * 文字・リンク・日時・数・選ぶ・入/切・色・画像・動画・記号つきの文字。
 * 値の読み書きは env を通す（どこの値か＝いちばん外・並びの中・画面の中の部品、は知らない）。
 * 「移る先の画面」のように、選べるものがほかの入力で変わるときは env.onRefresh で選び直す。
 */
import { isAllowedLinkUrl } from '../../../shared/link-html.ts'
import { toast } from '../../ui.ts'
import { applySymbol } from './form-state.ts'
import { pickLpImage } from './lp-image.ts'
import { pickLpVideo } from './lp-video.ts'
import { COLOR_NAMES, type Field, type TemplateData } from './templates/types.ts'

export type Scalar = string | boolean | number
/** 並びではない入力（見本の部品は form-sample.ts の専用の入力） */
export type ScalarField = Exclude<Field, { kind: 'list' } | { kind: 'screens' } | { kind: 'sample' }>

export interface ControlEnv {
  read: () => unknown
  write: (value: Scalar) => void
  /** 今の中身（選べるものをほかの入力から作るとき） */
  data: () => TemplateData
  /** 入力のたびに呼ばれる直し（選べるものの作り直しなど）を登録する */
  onRefresh: (refresh: () => void) => void
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (className !== '') el.className = className
  if (text !== '') el.textContent = text
  return el
}

/** データURLのおおよその大きさ */
function sizeLabel(dataUrl: string): string {
  const kb = Math.round((dataUrl.length * 0.75) / 1024)
  return kb >= 1024 ? `約${(kb / 1024).toFixed(1)}MB` : `約${kb}KB`
}

/** 今の日本時間を datetime-local の形で（過去を選べないようにする下限） */
function nowJstInput(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16)
}

/** 画像・動画を選ぶ入力（小さな見本・選ぶ／変える・外す・大きさ） */
function mediaControl(env: ControlEnv, id: string, kind: 'image' | 'video'): HTMLElement {
  const wrap = node('div', 'ncf-image')
  const paint = (): void => {
    const src = typeof env.read() === 'string' ? String(env.read()) : ''
    wrap.replaceChildren()
    if (src === '') {
      wrap.append(node('span', 'ncf-image__empty', kind === 'image' ? '画像なし' : '動画なし'))
    } else if (kind === 'image') {
      const img = node('img', 'ncf-image__thumb')
      img.src = src
      img.alt = ''
      wrap.append(img)
    } else {
      const video = node('video', 'ncf-image__thumb')
      video.src = src
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      wrap.append(video)
    }
    const noun = kind === 'image' ? '画像' : '動画'
    const choose = node('button', 'ncf-btn', src === '' ? `${noun}を選ぶ` : '変える')
    choose.type = 'button'
    choose.id = id
    choose.addEventListener('click', () => {
      const pick = kind === 'image' ? pickLpImage() : pickLpVideo()
      void pick.then(
        (picked) => {
          if (picked === null) return
          env.write(picked)
          paint()
        },
        () => toast(`${noun}を読み込めませんでした`, 'error'),
      )
    })
    wrap.append(choose)
    if (src !== '') {
      const clear = node('button', 'ncf-btn ncf-btn--quiet', '外す')
      clear.type = 'button'
      clear.addEventListener('click', () => {
        env.write('')
        paint()
      })
      wrap.append(clear, node('span', 'ncf-image__size', sizeLabel(src)))
    }
  }
  paint()
  return wrap
}

export function scalarControl(field: ScalarField, env: ControlEnv, id: string): HTMLElement {
  const value = env.read()
  switch (field.kind) {
    case 'text':
    case 'url':
    case 'datetime': {
      const input = node('input', 'ncf-input')
      input.id = id
      input.type = field.kind === 'url' ? 'url' : field.kind === 'datetime' ? 'datetime-local' : 'text'
      input.value = typeof value === 'string' ? value : ''
      if (field.kind !== 'datetime' && field.placeholder !== undefined) input.placeholder = field.placeholder
      if (field.kind === 'text' && field.maxLength !== undefined) input.maxLength = field.maxLength
      if (field.kind === 'datetime') input.min = nowJstInput()
      if (field.kind !== 'url') {
        input.addEventListener('input', () => env.write(input.value))
        return input
      }
      const wrap = node('div')
      const warn = node('span', 'ncf-warn')
      const check = (): void => {
        const url = input.value.trim()
        warn.textContent =
          url !== '' && !isAllowedLinkUrl(url) ? 'このリンクは開けません。https:// から始まるURLか、# で始まるページ内の場所を書いてください' : ''
        warn.hidden = warn.textContent === ''
      }
      input.addEventListener('input', () => {
        check()
        env.write(input.value)
      })
      check()
      wrap.append(input, warn)
      return wrap
    }
    case 'textarea': {
      const area = node('textarea', 'ncf-input')
      area.id = id
      area.rows = field.rows ?? 3
      area.value = typeof value === 'string' ? value : ''
      if (field.maxLength !== undefined) area.maxLength = field.maxLength
      area.addEventListener('input', () => env.write(area.value))
      return area
    }
    case 'number': {
      const wrap = node('div', 'ncf-inline')
      const input = node('input', 'ncf-input')
      input.id = id
      input.type = 'number'
      input.inputMode = 'numeric'
      input.min = String(field.min)
      input.max = String(field.max)
      input.step = '1'
      input.value = typeof value === 'number' || typeof value === 'string' ? String(value) : ''
      input.addEventListener('input', () => {
        if (Number.isFinite(input.valueAsNumber)) env.write(input.valueAsNumber)
      })
      wrap.append(input)
      if (field.unit !== undefined) wrap.append(node('span', 'ncf-unit', field.unit))
      return wrap
    }
    case 'select': {
      const select = node('select', 'ncf-input')
      select.id = id
      const fill = (): void => {
        const current = typeof env.read() === 'string' ? String(env.read()) : ''
        const options = field.optionsOf === undefined ? field.options : field.optionsOf(env.data())
        const known = options.some((o) => o.value === current)
        select.replaceChildren()
        // まだ選んでいない（または選んでいた画面を消した）ときは「選んでください」を出す
        if (field.optionsOf !== undefined && !known) {
          const blank = node('option', '', '（選んでください）')
          blank.value = ''
          select.append(blank)
        }
        for (const option of options) {
          const opt = node('option', '', option.label)
          opt.value = option.value
          select.append(opt)
        }
        select.value = known ? current : field.optionsOf === undefined ? (options[0]?.value ?? '') : ''
      }
      fill()
      if (field.optionsOf !== undefined) env.onRefresh(fill)
      select.addEventListener('change', () => env.write(select.value))
      return select
    }
    case 'toggle': {
      // 名前はこの中に書く（外の名前は出さない）
      const label = node('label', 'ncf-toggle')
      const box = node('input')
      box.id = id
      box.type = 'checkbox'
      box.checked = value === true
      box.addEventListener('change', () => env.write(box.checked))
      label.append(box, node('span', '', field.label))
      return label
    }
    case 'color': {
      const wrap = node('div', 'ncf-swatches')
      wrap.setAttribute('role', 'group')
      const current = (): string => (typeof env.read() === 'string' ? String(env.read()).toUpperCase() : '')
      // 「ほかの色」も今の色を映す（候補を選んだあとに古い色のまま残らないように）
      const picker = node('input')
      picker.type = 'color'
      picker.id = id
      const paint = (): void => {
        for (const b of wrap.querySelectorAll<HTMLButtonElement>('.ncf-swatch')) {
          b.setAttribute('aria-pressed', String(b.dataset['color'] === current()))
        }
        if (/^#[0-9A-F]{6}$/.test(current())) picker.value = current().toLowerCase()
      }
      for (const color of field.presets) {
        const b = node('button', 'ncf-swatch')
        b.type = 'button'
        b.dataset['color'] = color
        b.style.background = color
        b.setAttribute('aria-label', COLOR_NAMES[color] ?? color)
        b.title = COLOR_NAMES[color] ?? color
        b.addEventListener('click', () => {
          env.write(color)
          paint()
        })
        wrap.append(b)
      }
      picker.addEventListener('input', () => {
        env.write(picker.value.toUpperCase())
        paint()
      })
      const custom = node('label', 'ncf-custom')
      custom.append(picker, node('span', '', 'ほかの色'))
      wrap.append(custom)
      paint()
      return wrap
    }
    case 'image':
      return mediaControl(env, id, 'image')
    case 'video':
      return mediaControl(env, id, 'video')
    case 'symbols': {
      const wrap = node('div', 'ncf-inline')
      const input = node('input', 'ncf-input')
      input.id = id
      input.type = 'text'
      input.value = typeof value === 'string' ? value : ''
      if (field.placeholder !== undefined) input.placeholder = field.placeholder
      input.addEventListener('input', () => env.write(input.value))
      const syms = node('div', 'ncf-syms')
      for (const symbol of field.symbols) {
        const b = node('button', 'ncf-sym', symbol)
        b.type = 'button'
        b.setAttribute('aria-label', `${symbol}にする`)
        b.addEventListener('click', () => {
          input.value = applySymbol(input.value, symbol, field.symbols)
          env.write(input.value)
        })
        syms.append(b)
      }
      wrap.append(input, syms)
      return wrap
    }
  }
}
