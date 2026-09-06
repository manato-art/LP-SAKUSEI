/**
 * 書式（Normal / 見出し1-3）・文字サイズ・フォント・書式クリアまわり。
 *
 * 展開時にだけ現れる分（書式 / 文字サイズ / フォント / 設定 / 書式クリア / 折りたたむ）は
 * `capture/clean/ab_tests__UID__articles/toolbar-expanded/dom.html` から verbatim で持ってきて
 * 同じ位置（`_tooltip_` の直前）に差し込む。**手書きで似せていない。**
 */
import type Quill from 'quill'
import { toast } from '../../ui.ts'
import { HOOK } from './hooks.ts'
import type { Dropdown } from './dropdown.ts'

/** 実行時に Quill クラスへ触るための型（`import type` なので実行時importは発生しない） */
type QuillConstructor = typeof import('quill').default

/** 文字サイズの10段（toolbar-expanded/dom.html の並び順そのまま） */
export const TOOLBAR_FONT_SIZES: readonly string[] = [
  '10px', '13px', '15px', '17px', '19px', '21px', '23px', '25px', '27px', '29px',
]

/** 「自由設定」の単位（`<select>` の option そのまま） */
export const FREE_FONT_SIZE_UNITS: readonly string[] = ['px', '%', 'em', 'rem']

/**
 * フォント一覧（ツールバー＋プロパティパネル共用）。
 * CSSジェネリック → 和文システム → 和文Webフォント → 欧文 の順。
 * Google Fonts は loadGoogleFonts() でロードする。
 */
export const TOOLBAR_FONT_FAMILIES: readonly string[] = [
  // CSS ジェネリック
  'serif', 'sans-serif', 'cursive', 'fantasy', 'monospace',
  // 和文システムフォント
  'ヒラギノ角ゴ Pro W3', 'ヒラギノ明朝 Pro W3',
  '游ゴシック体', '游明朝体', 'メイリオ',
  // 和文 Google Fonts
  'Noto Sans JP', 'Noto Serif JP', 'M PLUS Rounded 1c',
  'Kosugi Maru', 'Sawarabi Gothic',
  // 欧文
  'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Impact',
]

/** Google Fonts の <link> + フォントドロップダウンのスクロール CSS を注入（重複防止付き） */
export function loadGoogleFonts(): void {
  if (document.getElementById('sb-google-fonts') !== null) return

  // Google Fonts
  const link = document.createElement('link')
  link.id = 'sb-google-fonts'
  link.rel = 'stylesheet'
  link.href =
    'https://fonts.googleapis.com/css2?' +
    'family=Noto+Sans+JP:wght@400;700' +
    '&family=Noto+Serif+JP:wght@400;700' +
    '&family=M+PLUS+Rounded+1c:wght@400;700' +
    '&family=Kosugi+Maru' +
    '&family=Sawarabi+Gothic' +
    '&display=swap'
  document.head.append(link)

  // フォントドロップダウンのスクロール（20件超でも収まるように）
  const style = document.createElement('style')
  style.id = 'sb-font-dropdown-css'
  style.textContent = `
    [data-test="EditorToolbar-BtnFontFamily"] [class*="fontOptionDropDown"] {
      max-height: 280px;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    [data-test="EditorToolbar-BtnFontFamily"] [class*="fontOptionDropDown"] > div {
      padding: 4px 8px;
      cursor: pointer;
      white-space: nowrap;
    }
    [data-test="EditorToolbar-BtnFontFamily"] [class*="fontOptionDropDown"] > div:hover {
      background: rgba(255,255,255,.15);
    }
  `
  document.head.append(style)
}

/** フォント <div> を1つ生成（HTML文字列）。空白入り名前は引用符で囲む */
function fontOptionHtml(name: string, index: number): string {
  const cssVal = /\s/.test(name) ? `&quot;${name}&quot;` : name
  const dataAttr = index === 0 ? ' data-test="EditorToolbar-BtnFontFamilySerif"' : ''
  return `<div${dataAttr} style="font-family: ${cssVal};">${name}</div>`
}

/** フォント選択肢の HTML を TOOLBAR_FONT_FAMILIES から生成 */
const FONT_FAMILY_OPTIONS_HTML = TOOLBAR_FONT_FAMILIES.map((f, i) => fontOptionHtml(f, i)).join('')

/**
 * 展開時にだけ現れる部分。書式/文字サイズは toolbar-expanded/dom.html より verbatim。
 * フォント一覧は TOOLBAR_FONT_FAMILIES から動的生成（追加・並替えに追従）。
 */
const EXPANDED_ONLY_HTML =
  // ── 書式（Normal / 見出し） ──
  `<div data-test="EditorToolbar-BtnHeader" class="_toolbarActionWrapper_1snng_54" data-is-show="true"><div class="_dropdown_x4j8w_1 _darkTheme_x4j8w_116"><div class="_trigger_x4j8w_5"><div class="_selectForm_1snng_148">Normal</div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_fontOptionDropDown_1snng_157"><h1 data-test="EditorToolbar-BtnHeader1">見出し1</h1><h2>見出し2</h2><h3>見出し3</h3></div><div class="_arrow_x4j8w_25"></div></div></div></div></div>` +
  // ── 文字サイズ ──
  `<div data-test="EditorToolbar-BtnFontSize" class="_toolbarActionWrapper_1snng_54" data-is-show="true"><div class="_dropdown_x4j8w_1 _darkTheme_x4j8w_116"><div class="_trigger_x4j8w_5"><div class="_selectForm_1snng_148">17px</div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_fontOptionDropDown_1snng_157"><div class="_font10_1snng_177 _fontSizeTab_1snng_207">10px</div><div class="_font13_1snng_180 _fontSizeTab_1snng_207">13px</div><div class="_font15_1snng_183 _fontSizeTab_1snng_207">15px</div><div class="_font17_1snng_186 _fontSizeTab_1snng_207">17px</div><div class="_font19_1snng_189 _fontSizeTab_1snng_207" data-test="EditorToolbar-BtnFontSize19">19px</div><div class="_font21_1snng_192 _fontSizeTab_1snng_207">21px</div><div class="_font23_1snng_195 _fontSizeTab_1snng_207">23px</div><div class="_font25_1snng_198 _fontSizeTab_1snng_207">25px</div><div class="_font27_1snng_201 _fontSizeTab_1snng_207">27px</div><div class="_font29_1snng_204 _fontSizeTab_1snng_207">29px</div><div class="sample_token_34aacae5"><div class="sample_token_77c7b8a7">自由設定</div><div class="_freeFontSizeForm_1snng_223"><input placeholder="17" type="number" min="0"><select><option value="px" selected="">px</option><option value="%">%</option><option value="em">em</option><option value="rem">rem</option></select></div><div class="_btn_1bcs1_2 _btnDarkThemePrimary_1bcs1_78 _btnXSmall_1bcs1_27">適用する</div></div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div>` +
  // ── フォント（TOOLBAR_FONT_FAMILIES から生成） ──
  `<div data-test="EditorToolbar-BtnFontFamily" class="_toolbarActionWrapper_1snng_54" data-is-show="true"><div class="_dropdown_x4j8w_1 _darkTheme_x4j8w_116"><div class="_trigger_x4j8w_5"><div class="_selectForm_1snng_148">serif</div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_fontOptionDropDown_1snng_157">${FONT_FAMILY_OPTIONS_HTML}</div><div class="_arrow_x4j8w_25"></div></div></div></div></div>` +
  // ── 設定 / 書式クリア / 折りたたみ ──
  `<div class="_toolbarActionWrapper_1snng_54" data-is-show="false"><img alt="" src="/assets/option-white-81034d7f.svg" width="15" data-test="EditorToolbar-BtnOption" aria-label="オプション" class=""></div><div class="_toolbarActionWrapper_1snng_54" data-is-show="true"><img alt="" data-test="EditorToolbar-RemoveFormat" width="15" src="/assets/clear-white-d43b8c87.svg"></div><div class="_toolbarActionWrapper_1snng_54" data-is-show="true"><img alt="" class="_iconShrinkToolbar_1snng_242" src="/assets/shrink_toolbar-161d1c2e.svg"></div>`

export type FreeFontSize = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly reason: string }

/**
 * 「自由設定」の入力チェック。実物のフォームは `<input type="number" min="0">` と
 * px/%/em/rem の `<select>` の2つだけなので、通す条件もその2つに対してだけ決める。
 */
export function parseFreeFontSize(rawValue: string, unit: string): FreeFontSize {
  if (!FREE_FONT_SIZE_UNITS.includes(unit)) return { ok: false, reason: '単位は px / % / em / rem のいずれかです' }
  const trimmed = rawValue.trim()
  if (trimmed === '') return { ok: false, reason: '数値を入力してください' }
  const size = Number(trimmed)
  if (!Number.isFinite(size)) return { ok: false, reason: '数値を入力してください' }
  if (size <= 0) return { ok: false, reason: '0 より大きい値を入力してください' }
  return { ok: true, value: `${size}${unit}` }
}

/** 書式ドロップダウンのトリガー表示（実物の既定は「Normal」） */
export function headerLabel(value: unknown): string {
  if (value === 1 || value === '1') return '見出し1'
  if (value === 2 || value === '2') return '見出し2'
  if (value === 3 || value === '3') return '見出し3'
  return 'Normal'
}

/** 文字サイズドロップダウンのトリガー表示（実物の既定は「17px」） */
export function fontSizeLabel(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : '17px'
}

/** フォントドロップダウンのトリガー表示（実物の既定は「serif」） */
export function fontFamilyLabel(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : 'serif'
}

/** 空白を含むフォント名は CSS 上で引用符が要る（実物の option も `&quot;` 付きだった） */
export function cssFontFamilyValue(name: string): string {
  return /\s/.test(name) ? `"${name}"` : name
}

/**
 * `size` を px で、`font` を任意のファミリ名で扱えるようにする。
 * Quill の既定はクラス方式（`ql-size-small` / `ql-font-serif`）でホワイトリスト固定なので、
 * style 方式に差し替えてホワイトリストを外す（自由設定を通すため）。
 */
export function allowPxSizeAndFreeFont(quill: Quill): void {
  const Ctor = quill.constructor as unknown as QuillConstructor
  for (const name of ['size', 'font']) {
    // parchment の Attributor。ホワイトリストを外すためだけに触る
    const attributor = Ctor.import(`attributors/style/${name}`) as { whitelist: string[] | undefined }
    attributor.whitelist = undefined
    Ctor.register(`formats/${name}`, attributor, true)
  }
}

/** 展開時だけ現れる部分を、実物と同じ位置（`_tooltip_` の直前）に差し込む */
export function insertExpandedOnlyItems(wrapper: HTMLElement): void {
  if (wrapper.querySelector(HOOK.header) !== null) return
  const template = document.createElement('template')
  template.innerHTML = EXPANDED_ONLY_HTML
  const tooltip = wrapper.querySelector(HOOK.tooltip)
  const nodes = [...template.content.children]
  for (const node of nodes) {
    if (tooltip === null) wrapper.append(node)
    else wrapper.insertBefore(node, tooltip)
  }
}

/** 「自由設定」（数値 ＋ px/%/em/rem ＋ 適用する） */
export function wireFreeFontSize(
  dropdown: Dropdown | undefined,
  apply: (name: string, value: unknown) => void,
): void {
  if (dropdown === undefined) return
  const form = dropdown.body.querySelector<HTMLElement>(HOOK.freeFontSizeForm)
  if (form === null) return
  const input = form.querySelector<HTMLInputElement>('input')
  const select = form.querySelector<HTMLSelectElement>('select')
  const submit = form.parentElement?.querySelector<HTMLElement>('[class*="btnDarkThemePrimary"]')
  if (input === null || select === null || submit === undefined || submit === null) return

  submit.addEventListener('click', () => {
    const parsed = parseFreeFontSize(input.value, select.value)
    if (!parsed.ok) {
      toast(parsed.reason, 'error')
      return
    }
    apply('size', parsed.value)
    dropdown.close()
  })
}
