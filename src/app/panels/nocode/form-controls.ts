/**
 * 「型から作る」「部品を積んで作る」の1つの値を入れる入力（2026-09-22・ノーコードでWidgetを作る③④）。
 *
 * 文字・リンク・日時・数・選ぶ・入/切・色・画像・動画・記号つきの文字。
 * 値の読み書きは env を通す（どこの値か＝いちばん外・並びの中・画面の中の部品、は知らない）。
 * 「移る先の画面」のように、選べるものがほかの入力で変わるときは env.onRefresh で選び直す。
 */
import { isAllowedLinkUrl } from '../../../shared/link-html.ts'
import { toast } from '../../ui.ts'
import { attachScrub, makeSlider } from '../number-scrub.ts'
import { applySymbol } from './form-state.ts'
import { pickLpImage } from './lp-image.ts'
import { pickLpVideo } from './lp-video.ts'
import { COLOR_NAMES, type Field, type TemplateData } from './templates/types.ts'

export type Scalar = string | boolean | number
/** 並びではない入力（見本の部品は form-sample.ts の専用の入力） */
export type ScalarField = Exclude<Field, { kind: 'list' } | { kind: 'screens' } | { kind: 'sample' } | { kind: 'goto' }>

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
  let shown: string | null = null
  const paint = (): void => {
    const src = typeof env.read() === 'string' ? String(env.read()) : ''
    // よそから中身が変わったときの描き直し（onRefresh）は、同じ画像なら何もしない（ボタンを作り直さない）
    if (src === shown) return
    shown = src
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
  env.onRefresh(paint)
  return wrap
}

/**
 * 中身がよそ（見たまま画面で文字を打ち直した など）から変わったとき、入力欄の値を合わせる。
 * 打っている途中の欄（フォーカスがある）は触らない（打った文字が消えないように）。
 */
function followValue(env: ControlEnv, input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, read: () => string): void {
  const field = input // eslint-safe alias（no-param-reassign 回避）
  env.onRefresh(() => {
    if (document.activeElement === field) return
    const next = read()
    if (field.value !== next) field.value = next
  })
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

type SelectField = Extract<ScalarField, { kind: 'select' }>

/**
 * 絵のタイルで選ぶ（2026-09-24・本人「プルダウンの文字を、パッと見で分かるように」）。
 * タイル＝絵＋下に短い言葉。選んでいるものは青い枠。名前（label）は読み上げとマウスを乗せたときに出す。
 * キーボードは Tab で移り Enter/Space で選ぶ。← → でも選べる（ラジオボタンと同じ）
 */
function tileControl(field: SelectField, env: ControlEnv, id: string): HTMLElement {
  const group = node('div', 'ncf-tiles')
  group.id = id
  group.setAttribute('role', 'radiogroup')
  group.setAttribute('aria-label', field.label)
  const known = (v: string): string => (field.options.some((o) => o.value === v) ? v : (field.options[0]?.value ?? ''))
  const tiles: HTMLButtonElement[] = []
  const paint = (): void => {
    const current = known(asText(env.read()))
    for (const tile of tiles) {
      const on = tile.dataset['value'] === current
      tile.setAttribute('aria-checked', String(on))
      tile.tabIndex = on ? 0 : -1
    }
  }
  field.options.forEach((option, index) => {
    const tile = node('button', 'ncf-tile')
    tile.type = 'button'
    tile.dataset['value'] = option.value
    tile.setAttribute('role', 'radio')
    tile.setAttribute('aria-label', option.label)
    tile.title = option.label
    const icon = node('span', 'ncf-tile__icon')
    icon.innerHTML = option.icon ?? ''
    tile.append(icon, node('span', 'ncf-tile__label', option.short ?? option.label))
    const choose = (): void => {
      env.write(option.value)
      paint()
    }
    tile.addEventListener('click', choose)
    tile.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const next = tiles[(index + (event.key === 'ArrowRight' ? 1 : -1) + tiles.length) % tiles.length]
      next?.focus()
      next?.click()
    })
    tiles.push(tile)
    group.append(tile)
  })
  paint()
  env.onRefresh(paint)
  return group
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
      followValue(env, input, () => asText(env.read()))
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
      followValue(env, area, () => asText(env.read()))
      return area
    }
    case 'number': {
      // 数字の欄＋単位（左右にドラッグで増減）＋スライダー（Canva風・2026-09-23）
      const wrap = node('div', 'ncf-number')
      const row = node('div', 'ncf-inline')
      const input = node('input', 'ncf-input')
      input.id = id
      input.type = 'number'
      input.inputMode = 'decimal'
      input.min = String(field.min)
      input.max = String(field.max)
      const step = field.unit === 'px' ? 0.5 : 1
      input.step = String(step)
      // 以前の選び（'l'・'m' など）は表で数に読み替える（読めなければ下限）
      const asNumber = (v: unknown): number => {
        const preset = typeof v === 'string' ? field.legacy?.[v] : undefined
        const n = preset ?? (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN)
        return Number.isFinite(n) ? n : field.min
      }
      const asNumberText = (v: unknown): string => (v === undefined || v === '' ? '' : String(asNumber(v)))
      input.value = asNumberText(value)
      const slider = makeSlider({ min: field.min, max: field.max, step }, asNumber(value), 'ncf-slider', (n) => {
        input.value = String(n)
        env.write(n)
      })
      input.addEventListener('input', () => {
        if (!Number.isFinite(input.valueAsNumber)) return
        slider.value = input.value
        env.write(input.valueAsNumber)
      })
      followValue(env, input, () => asNumberText(env.read()))
      env.onRefresh(() => {
        const next = String(asNumber(env.read()))
        if (slider.value !== next) slider.value = next
      })
      const grip = node('span', 'ncf-unit ncf-scrub', field.unit ?? '↔')
      attachScrub(grip, {
        read: () => asNumber(env.read()),
        step,
        range: { min: field.min, max: field.max },
        apply: (n) => {
          input.value = String(n)
          slider.value = String(n)
          env.write(n)
        },
      })
      row.append(input, grip)
      wrap.append(row, slider)
      return wrap
    }
    case 'select': {
      // 全部の選択肢に絵があれば、プルダウンではなく絵のタイルで選ぶ（言葉が違う人でも形で分かる）
      if (field.options.length > 0 && field.options.every((option) => option.icon !== undefined)) return tileControl(field, env, id)
      const select = node('select', 'ncf-input')
      select.id = id
      const current = typeof value === 'string' ? value : ''
      for (const option of field.options) {
        const opt = node('option', '', option.label)
        opt.value = option.value
        select.append(opt)
      }
      const known = (v: string): string => (field.options.some((o) => o.value === v) ? v : (field.options[0]?.value ?? ''))
      select.value = known(current)
      select.addEventListener('change', () => env.write(select.value))
      followValue(env, select, () => known(asText(env.read())))
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
      env.onRefresh(() => {
        box.checked = env.read() === true
      })
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
        const b = node('button', color === 'none' ? 'ncf-swatch ncf-swatch--none' : 'ncf-swatch')
        b.type = 'button'
        b.dataset['color'] = color
        // 'none'＝色なし（LPの地のまま）。斜線の見本にする
        if (color !== 'none') b.style.background = color
        b.setAttribute('aria-label', color === 'none' ? 'なし（LPの地のまま）' : (COLOR_NAMES[color] ?? color))
        b.title = color === 'none' ? 'なし（LPの地のまま）' : (COLOR_NAMES[color] ?? color)
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
      env.onRefresh(paint)
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
      followValue(env, input, () => asText(env.read()))
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
