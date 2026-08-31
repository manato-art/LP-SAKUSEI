/**
 * テキスト選択ツールバー（企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** マークアップは採取した実DOMをそのまま使う:
 *   - 折りたたみ時の11個は土台（`fragments/ab_tests__UID__articles__editor-target.html`）に
 *     最初から入っているので、それを**そのまま**配線する。
 *   - 展開時にだけ現れる分（書式 / 文字サイズ / フォント / 設定 / 書式クリア / 折りたたむ）は
 *     `capture/clean/ab_tests__UID__articles/toolbar-expanded/dom.html` から verbatim で持ってきて
 *     同じ位置（`_tooltip_` の直前）に差し込む。
 *   - 表示の切替は実物と同じく `data-is-show` 属性（実CSS: `[data-is-show="false"]{display:none}`）。
 *
 * **実物の入れ違いは直さない**（企画書 §3-5「勝手にUIを改善しない」）:
 *   `EditorToolbar-BtnItalic` に下線アイコン、`EditorToolbar-BtnUnderline` に斜体アイコンが
 *   割り当たっている。アイコンの取り違えは本物の状態なのでそのまま再現し、
 *   フォーマットの割り当ては要素の素性（`data-test` 名）に従う。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'

/** 実行時に Quill クラスへ触るための型（`import type` なので実行時importは発生しない） */
type QuillConstructor = typeof import('quill').default

/** Quill の選択範囲（Range を値として import しないための最小形） */
export interface QuillRange {
  readonly index: number
  readonly length: number
}

// ───────────────────────────── 採取物から取った定数 ─────────────────────────────

/** 実DOMの目印（`data-test` / CSSモジュールのクラス断片） */
const HOOK = {
  wrapper: '[data-test="EditorToolbar-EditorToolbarWrapper"]',
  arrow: '[class*="editorToolbarArrow"]',
  tooltip: '[class*="_tooltip_"]',
  item: '[class*="toolbarActionWrapper"]',
  bold: '[data-test="EditorToolbar-BtnBold"]',
  italic: '[data-test="EditorToolbar-BtnItalic"]',
  underline: '[data-test="EditorToolbar-BtnUnderline"]',
  strike: '[data-test="EditorToolbar-BtnStrike"]',
  scriptSuper: '[class*="iconScriptSuper"]',
  scriptSub: '[class*="iconScriptSub"]',
  link: '[data-test="LinkDropdown-BtnOpenDropdown"]',
  photo: '[data-test="EditorToolbar-BtnArticlePhoto"]',
  color: '[data-test="ColorPicker-BtnColor"]',
  background: '[data-test="ColorPicker-BtnBackGround"]',
  align: '[data-test="EditorToolbar-BtnAlign"]',
  alignIcon: '[class*="alignIcon"]',
  more: '[data-test="EditorToolbar-BtnMoreToolbarOption"]',
  header: '[data-test="EditorToolbar-BtnHeader"]',
  fontSize: '[data-test="EditorToolbar-BtnFontSize"]',
  fontFamily: '[data-test="EditorToolbar-BtnFontFamily"]',
  removeFormat: '[data-test="EditorToolbar-RemoveFormat"]',
  shrink: '[class*="iconShrinkToolbar"]',
  trigger: '[class*="_trigger_"]',
  bodyWrapper: '[class*="_bodyWrapper_"]',
  dropdownArrow: '[class*="_arrow_"]',
  selectForm: '[class*="selectForm"]',
  fontOptions: '[class*="fontOptionDropDown"]',
  fontSizeTab: '[class*="fontSizeTab"]',
  freeFontSizeForm: '[class*="freeFontSizeForm"]',
} as const

/**
 * 採取したCSSモジュールのハッシュ付きクラス名（verbatim）。
 * 出典: editor-target / editor-text-selected / toolbar-align-open の各 dom.html。
 */
const CLS = {
  /** ツールバー本体を見える状態にする（`opacity:.5; pointer-events:all`） */
  wrapperActive: '_active_1snng_11',
  /** 各ボタンの押下状態（白丸背景） */
  itemActive: '_active_1snng_11',
  /** 矢印がツールバーの上に出る＝ツールバーは選択範囲の下 */
  arrowTop: '_top_1snng_43',
  /** 矢印がツールバーの下に出る＝ツールバーは選択範囲の上（editor-text-selected と同じ） */
  arrowBottom: '_bottom_1snng_47',
  /** ドロップダウン本体の展開（実CSS: `display:block`） */
  dropdownOpen: '_open_x4j8w_84',
  dropdownArrowTop: '_top_x4j8w_76',
} as const

/** 開いたドロップダウンに実物が付ける inline style（toolbar-align-open/dom.html より verbatim） */
const DROPDOWN_OPEN_STYLE = 'top: 24px; border-top: 8px solid transparent; left: 50%; margin-left: -15px;'
const DROPDOWN_ARROW_STYLE = 'left: 7px;'

/** アイコンの明暗差し替え（押下状態は白背景になるので黒アイコンへ）。実在するファイルだけ */
const ICON_SWAP: Readonly<Record<string, { readonly on: string; readonly off: string }>> = {
  bold: { on: '/assets/files/bold-black-149b128e.svg', off: '/assets/files/bold-white-68435554.svg' },
  strike: {
    on: '/assets/files/strikethrough-black-6f71bb5f.svg',
    off: '/assets/files/strikethrough-white-1675881b.svg',
  },
}

/** 文字サイズの10段（toolbar-expanded/dom.html の並び順そのまま） */
export const TOOLBAR_FONT_SIZES: readonly string[] = [
  '10px', '13px', '15px', '17px', '19px', '21px', '23px', '25px', '27px', '29px',
]

/** 「自由設定」の単位（`<select>` の option そのまま） */
export const FREE_FONT_SIZE_UNITS: readonly string[] = ['px', '%', 'em', 'rem']

/** フォント（toolbar-expanded/dom.html の並び順そのまま） */
export const TOOLBAR_FONT_FAMILIES: readonly string[] = [
  'serif', 'sans-serif', 'cursive', 'fantasy', 'monospace', 'ヒラギノ角ゴ Pro W3',
]

/** 整列（ドロップダウンのアイコン順。Quill の align 値。左寄せは値なし） */
const ALIGN_VALUES: readonly (string | false)[] = [false, 'center', 'right', 'justify']

/**
 * 文字色・背景色パレットの40色（toolbar-color-open/dom.html の `title` 属性を verbatim）。
 * `#fffff66` は本物のデータがそうなっている（16進として不正なので実物でも色が出ていない）。
 * 企画書 §3-5 に従い**直さない**。
 */
export const TOOLBAR_SWATCHES: readonly string[] = [
  '#000000', '#ffffff', '#bbbbbb', '#888888', '#444444',
  '#e60000', '#facccc', '#f06666', '#a10000', '#5c0000',
  '#ff9900', '#ffebcc', '#ffc266', '#b26b00', '#663d00',
  '#ffff00', '#ffffcc', '#fffff66', '#b2b200', '#666600',
  '#008a00', '#cce8cc', '#66B966', '#006100', '#003700',
  '#0066cc', '#cce0f5', '#66a3e0', '#0047b2', '#002966',
  '#9933ff', '#ebd6ff', '#c285ff', '#6b24b2', '#3d140a',
  '#0000ff', '#ff0000', '#ff00ff', '#fa57cc', '#fae1f0',
]

/**
 * 展開時にだけ現れる部分（toolbar-expanded/dom.html より verbatim）。
 * `/assets/...` は土台と同じくローカル配置に合わせて `/assets/files/...` にしてある。
 */
const EXPANDED_ONLY_HTML = `<div data-test="EditorToolbar-BtnHeader" class="_toolbarActionWrapper_1snng_54" data-is-show="true"><div class="_dropdown_x4j8w_1 _darkTheme_x4j8w_116"><div class="_trigger_x4j8w_5"><div class="_selectForm_1snng_148">Normal</div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_fontOptionDropDown_1snng_157"><h1 data-test="EditorToolbar-BtnHeader1">見出し1</h1><h2>見出し2</h2><h3>見出し3</h3></div><div class="_arrow_x4j8w_25"></div></div></div></div></div><div data-test="EditorToolbar-BtnFontSize" class="_toolbarActionWrapper_1snng_54" data-is-show="true"><div class="_dropdown_x4j8w_1 _darkTheme_x4j8w_116"><div class="_trigger_x4j8w_5"><div class="_selectForm_1snng_148">17px</div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_fontOptionDropDown_1snng_157"><div class="_font10_1snng_177 _fontSizeTab_1snng_207">10px</div><div class="_font13_1snng_180 _fontSizeTab_1snng_207">13px</div><div class="_font15_1snng_183 _fontSizeTab_1snng_207">15px</div><div class="_font17_1snng_186 _fontSizeTab_1snng_207">17px</div><div class="_font19_1snng_189 _fontSizeTab_1snng_207" data-test="EditorToolbar-BtnFontSize19">19px</div><div class="_font21_1snng_192 _fontSizeTab_1snng_207">21px</div><div class="_font23_1snng_195 _fontSizeTab_1snng_207">23px</div><div class="_font25_1snng_198 _fontSizeTab_1snng_207">25px</div><div class="_font27_1snng_201 _fontSizeTab_1snng_207">27px</div><div class="_font29_1snng_204 _fontSizeTab_1snng_207">29px</div><div class="sample_token_34aacae5"><div class="sample_token_77c7b8a7">自由設定</div><div class="_freeFontSizeForm_1snng_223"><input placeholder="17" type="number" min="0"><select><option value="px" selected="">px</option><option value="%">%</option><option value="em">em</option><option value="rem">rem</option></select></div><div class="_btn_1bcs1_2 _btnDarkThemePrimary_1bcs1_78 _btnXSmall_1bcs1_27">適用する</div></div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div><div data-test="EditorToolbar-BtnFontFamily" class="_toolbarActionWrapper_1snng_54" data-is-show="true"><div class="_dropdown_x4j8w_1 _darkTheme_x4j8w_116"><div class="_trigger_x4j8w_5"><div class="_selectForm_1snng_148">serif</div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_fontOptionDropDown_1snng_157"><div data-test="EditorToolbar-BtnFontFamilySerif" style="font-family: serif;">serif</div><div style="font-family: sans-serif;">sans-serif</div><div style="font-family: cursive;">cursive</div><div style="font-family: fantasy;">fantasy</div><div style="font-family: monospace;">monospace</div><div style="font-family: &quot;ヒラギノ角ゴ Pro W3&quot;;">ヒラギノ角ゴ Pro W3</div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div><div class="_toolbarActionWrapper_1snng_54" data-is-show="false"><img alt="" src="/assets/files/option-white-81034d7f.svg" width="15" data-test="EditorToolbar-BtnOption" aria-label="オプション" class=""></div><div class="_toolbarActionWrapper_1snng_54" data-is-show="true"><img alt="" data-test="EditorToolbar-RemoveFormat" width="15" src="/assets/files/clear-white-d43b8c87.svg"></div><div class="_toolbarActionWrapper_1snng_54" data-is-show="true"><img alt="" class="_iconShrinkToolbar_1snng_242" src="/assets/files/shrink_toolbar-161d1c2e.svg"></div>`

/** カラーピッカー上段（toolbar-color-open/dom.html の react-color ChromePicker を verbatim） */
const CHROME_PICKER_HTML = `<div class="chrome-picker " style="width: 225px; background: rgb(255, 255, 255); border-radius: 2px; box-shadow: rgba(0, 0, 0, 0.3) 0px 0px 2px, rgba(0, 0, 0, 0.3) 0px 4px 8px; box-sizing: initial; font-family: Menlo;"><div style="width: 100%; padding-bottom: 55%; position: relative; border-radius: 2px 2px 0px 0px; overflow: hidden;"><div style="position: absolute; inset: 0px; background: rgb(255, 0, 0);"><style>
          .saturation-white {
            background: -webkit-linear-gradient(to right, #fff, rgba(255,255,255,0));
            background: linear-gradient(to right, #fff, rgba(255,255,255,0));
          }
          .saturation-black {
            background: -webkit-linear-gradient(to top, #000, rgba(0,0,0,0));
            background: linear-gradient(to top, #000, rgba(0,0,0,0));
          }
        </style><div class="saturation-white" style="position: absolute; inset: 0px;"><div class="saturation-black" style="position: absolute; inset: 0px;"></div><div style="position: absolute; top: 100%; left: 0%; cursor: default;"><div style="width: 12px; height: 12px; border-radius: 6px; box-shadow: rgb(255, 255, 255) 0px 0px 0px 1px inset; transform: translate(-6px, -6px);"></div></div></div></div></div><div style="padding: 16px 16px 12px;"><div class="flexbox-fix" style="display: flex;"><div style="width: 22px;"><div style="margin-top: 0px; width: 10px; height: 10px; border-radius: 8px; position: relative; overflow: hidden;"><div style="position: absolute; inset: 0px; border-radius: 8px; box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset; background: rgb(0, 0, 0); z-index: 2;"></div><div style="position: absolute; inset: 0px; background: url(&quot;data:image/png;base64,sample_token_b5921805/9hAAAAPUlEQVR4AeySywkAMAhDH52h+0/sample_token_cb7c5d12//sample_token_3c96bb24==&quot;) left center;"></div></div></div><div style="-webkit-box-flex: 1; flex: 1 1 0%;"><div style="height: 10px; position: relative; margin-bottom: 0px;"><div style="position: absolute; inset: 0px;"><div class="hue-horizontal" style="padding: 0px 2px; position: relative; height: 100%;"><style>
            .hue-horizontal {
              background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0
                33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
              background: -webkit-linear-gradient(to right, #f00 0%, #ff0
                17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            }

            .hue-vertical {
              background: linear-gradient(to top, #f00 0%, #ff0 17%, #0f0 33%,
                #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
              background: -webkit-linear-gradient(to top, #f00 0%, #ff0 17%,
                #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            }
          </style><div style="position: absolute; left: 0%;"><div style="width: 12px; height: 12px; border-radius: 6px; transform: translate(-6px, -1px); background-color: rgb(248, 248, 248); box-shadow: rgba(0, 0, 0, 0.37) 0px 1px 4px 0px;"></div></div></div></div></div><div style="height: 10px; position: relative; display: none;"><div style="position: absolute; inset: 0px;"><div style="position: absolute; inset: 0px; overflow: hidden;"><div style="position: absolute; inset: 0px; background: url(&quot;data:image/png;base64,sample_token_b5921805/9hAAAAPUlEQVR4AeySywkAMAhDH52h+0/sample_token_cb7c5d12//sample_token_3c96bb24==&quot;) left center;"></div></div><div style="position: absolute; inset: 0px; background: linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 100%);"></div><div style="position: relative; height: 100%; margin: 0px 3px;"><div style="position: absolute; left: 100%;"><div style="width: 12px; height: 12px; border-radius: 6px; transform: translate(-6px, -1px); background-color: rgb(248, 248, 248); box-shadow: rgba(0, 0, 0, 0.37) 0px 1px 4px 0px;"></div></div></div></div></div></div></div><div class="flexbox-fix" style="padding-top: 16px; display: flex;"><div class="flexbox-fix" style="-webkit-box-flex: 1; flex: 1 1 0%; display: flex; margin-left: -6px;"><div style="padding-left: 6px; width: 100%;"><div style="position: relative;"><input id="rc-editable-input-1" spellcheck="false" value="#000000" style="font-size: 11px; color: rgb(51, 51, 51); width: 100%; border-radius: 2px; border-width: medium; border-style: none; border-color: currentcolor; border-image: none; box-shadow: rgb(218, 218, 218) 0px 0px 0px 1px inset; height: 21px; text-align: center;"><label for="rc-editable-input-1" style="text-transform: uppercase; font-size: 11px; line-height: 11px; color: rgb(150, 150, 150); text-align: center; display: block; margin-top: 12px;">hex</label></div></div></div><div style="width: 32px; text-align: right; position: relative;"><div style="margin-right: -4px; margin-top: 12px; cursor: pointer; position: relative;"><svg viewBox="0 0 24 24" style="fill: rgb(51, 51, 51); width: 24px; height: 24px; border: 1px solid transparent; border-radius: 5px;"><path d="M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z"></path></svg></div></div></div></div></div>`

/**
 * カラーピッカーの Emotion ランタイムCSS（toolbar-color-open の CSSOM から verbatim）。
 * ポップオーバーは `#root` の外（document.body 直下）に出るので、
 * 土台側の `/cssom/editor.css` には含まれていない。ここで一度だけ足す。
 */
const PICKER_CSS = `
.css-mwpql5 { position: fixed; inset: 0px; z-index: 100000; }
.css-esi9ax { position: fixed; display: flex; align-items: center; justify-content: center; inset: 0px; background-color: transparent; -webkit-tap-highlight-color: transparent; z-index: -1; }
.css-1dmzujt { background-color: rgb(255, 255, 255); color: rgba(0, 0, 0, 0.87); transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1); border-radius: 4px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 5px -3px, rgba(0, 0, 0, 0.14) 0px 8px 10px 1px, rgba(0, 0, 0, 0.12) 0px 3px 14px 2px; position: absolute; overflow: hidden auto; min-width: 16px; min-height: 16px; max-width: calc(100% - 32px); max-height: calc(100% - 32px); outline: 0px; }
.css-1xyx5ni { width: 235px; }
.css-1xyx5ni .chrome-picker { width: 235px !important; box-shadow: none !important; border-radius: 2px 2px 0px 0px !important; background: rgb(236, 236, 236) !important; }
.css-1xyx5ni .github-picker { box-sizing: border-box; border-radius: 0px; box-shadow: none !important; border: none !important; width: 235px !important; background: rgb(236, 236, 236) !important; }
.css-170de7g { padding: 10px; background-color: rgb(236, 236, 236); border-radius: 0px 0px 2px 2px !important; }
.css-1yaowxx { display: inline-flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; -webkit-tap-highlight-color: transparent; outline: 0px; border: 0px; margin: 0px; cursor: pointer; user-select: none; vertical-align: middle; appearance: none; text-decoration: none; text-transform: none; font-family: "Hiragino Sans", "Helvetica Neue", Arial, sans-serif; font-size: 0.875rem; line-height: 1.75; min-width: 64px; padding: 6px 16px; color: rgb(255, 255, 255); background-color: rgb(0, 134, 255); width: 100%; box-shadow: none; border-radius: 10px; font-weight: bold; }
.css-1yaowxx:hover { background-color: rgb(0, 93, 178); }
.css-w0pj6f { overflow: hidden; pointer-events: none; position: absolute; z-index: 0; inset: 0px; border-radius: inherit; }
`

/** ポップオーバーの寸法（css-1xyx5ni が 235px 固定） */
const PICKER_WIDTH = 235

// ───────────────────────────── 純粋ロジック（テスト対象） ─────────────────────────────

export interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface ToolbarPlacement {
  readonly left: number
  readonly top: number
  readonly arrowLeft: number
  readonly placement: 'above' | 'below'
}

/** 矢印が角に寄りすぎないための余白（実物の `left: 20px` / `left: 7px` から） */
const ARROW_EDGE = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * ツールバーの表示位置（実物は `_editorToolbarWrapper_` に `left` / `top` を直接指定していた）。
 * 座標はすべて「位置決めの基準になる箱（offsetParent）」の左上を原点とする。
 */
export function computeToolbarPosition(
  selection: Box,
  toolbar: { readonly width: number; readonly height: number },
  host: { readonly width: number; readonly height: number },
  gap = 10,
): ToolbarPlacement {
  const centerX = selection.left + selection.width / 2
  const left = clamp(centerX - toolbar.width / 2, 0, Math.max(0, host.width - toolbar.width))

  const aboveTop = selection.top - toolbar.height - gap
  const belowTop = selection.top + selection.height + gap
  const fitsAbove = aboveTop >= 0
  const fitsBelow = belowTop + toolbar.height <= host.height
  const placement: 'above' | 'below' = fitsAbove || !fitsBelow ? 'above' : 'below'

  const top = placement === 'above' ? Math.max(0, aboveTop) : belowTop
  const arrowLeft = clamp(centerX - left, ARROW_EDGE, Math.max(ARROW_EDGE, toolbar.width - ARROW_EDGE))
  return { left, top, arrowLeft, placement }
}

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

/** `#abc` / `abc` / `#aabbcc` を `#aabbcc` に寄せる。不正なら null */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = [raw[0], raw[1], raw[2]]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return null
}

/** 採取したスウォッチの inline style を再現するための `rgb(r, g, b)`。不正な色は null */
export function hexToRgbCss(hex: string): string | null {
  const normalized = normalizeHex(hex)
  if (normalized === null) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

export interface Hsv {
  readonly h: number
  readonly s: number
  readonly v: number
}

/** HSV → `#rrggbb`（h: 0-360, s/v: 0-1） */
export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 1)
  const val = clamp(v, 0, 1)
  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c
  const sectors: readonly (readonly [number, number, number])[] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ]
  const rgb = sectors[Math.floor(hue / 60) % 6] ?? [c, x, 0]
  const hex = rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

/** `#rrggbb` → HSV。不正なら null */
export function hexToHsv(hex: string): Hsv | null {
  const normalized = normalizeHex(hex)
  if (normalized === null) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta + 6) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

/** 採取したスウォッチ1つ分のマークアップ（toolbar-color-open/dom.html と同じ形） */
export function swatchMarkup(hex: string): string {
  const rgb = hexToRgbCss(hex)
  const background = rgb === null ? '' : `background: ${rgb}; `
  return (
    '<span><div style="width: 25px; height: 25px; font-size: 0px;"><span>' +
    `<div title="${hex}" tabindex="0" style="${background}height: 100%; width: 100%; ` +
    'cursor: pointer; position: relative; outline: none;"></div></span></div></span>'
  )
}

// ───────────────────────────── 配線 ─────────────────────────────

/**
 * 採取済みのツールバーを Quill に配線する。
 * `root` は土台（採取した実DOM）を差し込んだ要素、`quill` はそこに立っている Quill。
 */
export function mountEditorToolbar(root: HTMLElement, quill: Quill): void {
  const found = root.querySelector<HTMLElement>(HOOK.wrapper)
  if (found === null) {
    console.warn('[editor-toolbar] 土台に EditorToolbar-EditorToolbarWrapper が見つからないので配線しない')
    return
  }
  const wrapper: HTMLElement = found
  if (wrapper.dataset['sbToolbar'] === 'mounted') return
  wrapper.dataset['sbToolbar'] = 'mounted'

  allowPxSizeAndFreeFont(quill)
  insertExpandedOnlyItems(wrapper)

  const state = { lastRange: null as QuillRange | null, keepOpen: false }

  const setItemShown = (node: Element | null, shown: boolean): void => {
    node?.closest(HOOK.item)?.setAttribute('data-is-show', shown ? 'true' : 'false')
  }

  /** 折りたたみ / 展開（実物は `data-is-show` の付け替えで出し入れしている） */
  const setExpanded = (expanded: boolean): void => {
    setItemShown(wrapper.querySelector(HOOK.more), !expanded)
    for (const selector of [HOOK.header, HOOK.fontSize, HOOK.fontFamily, HOOK.removeFormat, HOOK.shrink]) {
      setItemShown(wrapper.querySelector(selector), expanded)
    }
  }

  /**
   * 選択がある状態の見え方に合わせる（editor-text-selected/dom.html と同じ）:
   * リンクは出る / 画像は消える。
   */
  setItemShown(wrapper.querySelector(HOOK.link), true)
  setItemShown(wrapper.querySelector(HOOK.photo), false)
  setExpanded(false)

  // ツールバー内の mousedown で編集中の選択が消えないようにする（入力欄だけは例外）
  wrapper.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, select, textarea') !== null) return
    event.preventDefault()
  })

  const dropdowns = wireDropdowns(wrapper, state)

  const applyInline = (name: string, value: unknown): void => {
    const range = state.lastRange
    if (range === null || range.length === 0) return
    quill.formatText(range.index, range.length, name, value, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    refresh()
  }
  const applyBlock = (name: string, value: unknown): void => {
    const range = state.lastRange
    if (range === null) return
    quill.formatLine(range.index, range.length, name, value, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    refresh()
  }
  const currentFormats = (): Record<string, unknown> => {
    const range = state.lastRange
    return range === null ? {} : quill.getFormat(range.index, range.length)
  }

  // ── 折りたたみ時の11個 ──
  const toggleInline = (name: string): void => {
    applyInline(name, currentFormats()[name] === true ? false : true)
  }
  wrapper.querySelector(HOOK.bold)?.addEventListener('click', () => toggleInline('bold'))
  // アイコンは入れ違いのまま。フォーマットは要素の素性（data-test名）に従う（§3-5）
  wrapper.querySelector(HOOK.italic)?.addEventListener('click', () => toggleInline('italic'))
  wrapper.querySelector(HOOK.underline)?.addEventListener('click', () => toggleInline('underline'))
  wrapper.querySelector(HOOK.strike)?.addEventListener('click', () => toggleInline('strike'))
  wrapper.querySelector(HOOK.scriptSuper)?.addEventListener('click', () => {
    applyInline('script', currentFormats()['script'] === 'super' ? false : 'super')
  })
  wrapper.querySelector(HOOK.scriptSub)?.addEventListener('click', () => {
    applyInline('script', currentFormats()['script'] === 'sub' ? false : 'sub')
  })
  wrapper.querySelector(HOOK.link)?.addEventListener('click', () => {
    toast('リンクのドロップダウンは未採取のため未実装です', 'error')
  })
  wrapper.querySelector(HOOK.photo)?.addEventListener('click', () => {
    toast('ツールバーからの画像挿入は未実装です', 'error')
  })

  // ── 色パレット ──
  const colorButton = wrapper.querySelector<HTMLElement>(HOOK.color)
  colorButton?.addEventListener('click', () => {
    openColorPicker(colorButton, '文字色', (hex) => applyInline('color', hex), state, refresh)
  })
  const backgroundButton = wrapper.querySelector<HTMLElement>(HOOK.background)
  backgroundButton?.addEventListener('click', () => {
    openColorPicker(backgroundButton, '背景色', (hex) => applyInline('background', hex), state, refresh)
  })

  // ── 整列 ──
  const alignIcons = dropdowns.align?.body.querySelectorAll<HTMLElement>(HOOK.alignIcon) ?? []
  alignIcons.forEach((icon, index) => {
    icon.addEventListener('click', () => {
      applyBlock('align', ALIGN_VALUES[index] ?? false)
      dropdowns.align?.close()
    })
  })

  // ── 書式（Normal / 見出し1-3） ──
  for (const heading of dropdowns.header?.body.querySelectorAll<HTMLElement>('h1, h2, h3') ?? []) {
    const level = Number(heading.tagName.slice(1))
    heading.addEventListener('click', () => {
      applyBlock('header', currentFormats()['header'] === level ? false : level)
      dropdowns.header?.close()
    })
  }

  // ── 文字サイズ（10段 ＋ 自由設定） ──
  for (const tab of dropdowns.fontSize?.body.querySelectorAll<HTMLElement>(HOOK.fontSizeTab) ?? []) {
    tab.addEventListener('click', () => {
      applyInline('size', (tab.textContent ?? '').trim())
      dropdowns.fontSize?.close()
    })
  }
  wireFreeFontSize(dropdowns.fontSize, applyInline)

  // ── フォント ──
  const fontOptions = dropdowns.fontFamily?.body.querySelector(HOOK.fontOptions)
  for (const option of fontOptions?.querySelectorAll<HTMLElement>(':scope > div') ?? []) {
    option.addEventListener('click', () => {
      applyInline('font', cssFontFamilyValue((option.textContent ?? '').trim()))
      dropdowns.fontFamily?.close()
    })
  }

  // ── 書式クリア / 展開 / 折りたたみ ──
  wrapper.querySelector(HOOK.removeFormat)?.addEventListener('click', () => {
    const range = state.lastRange
    if (range === null || range.length === 0) return
    quill.removeFormat(range.index, range.length, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    refresh()
  })
  wrapper.querySelector(HOOK.more)?.addEventListener('click', () => {
    setExpanded(true)
    refresh()
  })
  wrapper.querySelector(HOOK.shrink)?.addEventListener('click', () => {
    setExpanded(false)
    refresh()
  })

  /** 選択に合わせて 表示 / 位置 / 押下状態 を更新する */
  function refresh(): void {
    const range = quill.getSelection()
    if (range !== null && range.length > 0) state.lastRange = { index: range.index, length: range.length }

    const hasSelection = range !== null && range.length > 0
    const visible = hasSelection || (state.keepOpen && state.lastRange !== null)
    wrapper.classList.toggle(CLS.wrapperActive, visible)
    if (!visible) {
      closeAllDropdowns(dropdowns)
      return
    }
    const target = state.lastRange
    if (target === null) return
    positionToolbar(wrapper, quill, target)
    syncActiveState(wrapper, quill.getFormat(target.index, target.length))
  }

  quill.on('selection-change', () => refresh())
  quill.on('text-change', () => refresh())
  refresh()
}

/**
 * `size` を px で、`font` を任意のファミリ名で扱えるようにする。
 * Quill の既定はクラス方式（`ql-size-small` / `ql-font-serif`）でホワイトリスト固定なので、
 * style 方式に差し替えてホワイトリストを外す（自由設定を通すため）。
 */
function allowPxSizeAndFreeFont(quill: Quill): void {
  const Ctor = quill.constructor as unknown as QuillConstructor
  for (const name of ['size', 'font']) {
    // parchment の Attributor。ホワイトリストを外すためだけに触る
    const attributor = Ctor.import(`attributors/style/${name}`) as { whitelist: string[] | undefined }
    attributor.whitelist = undefined
    Ctor.register(`formats/${name}`, attributor, true)
  }
}

/** 展開時だけ現れる部分を、実物と同じ位置（`_tooltip_` の直前）に差し込む */
function insertExpandedOnlyItems(wrapper: HTMLElement): void {
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

interface Dropdown {
  readonly body: HTMLElement
  readonly open: () => void
  readonly close: () => void
  readonly isOpen: () => boolean
}

type DropdownMap = Partial<Record<'align' | 'header' | 'fontSize' | 'fontFamily', Dropdown>>

interface ToolbarState {
  lastRange: QuillRange | null
  keepOpen: boolean
}

function wireDropdowns(wrapper: HTMLElement, ctx: ToolbarState): DropdownMap {
  const alignItem = [...wrapper.querySelectorAll<HTMLElement>(HOOK.align)].find(
    (node) => node.querySelector(HOOK.alignIcon) !== null,
  )
  const map: DropdownMap = {
    align: alignItem === undefined ? undefined : createDropdown(alignItem, ctx),
    header: createDropdown(wrapper.querySelector<HTMLElement>(HOOK.header), ctx),
    fontSize: createDropdown(wrapper.querySelector<HTMLElement>(HOOK.fontSize), ctx),
    fontFamily: createDropdown(wrapper.querySelector<HTMLElement>(HOOK.fontFamily), ctx),
  }
  // 1つ開いたら他は閉じる
  for (const [name, dropdown] of Object.entries(map)) {
    if (dropdown === undefined) continue
    dropdown.body.addEventListener('sb-dropdown-open', () => {
      for (const [other, otherDropdown] of Object.entries(map)) {
        if (other !== name) otherDropdown?.close()
      }
    })
  }
  return map
}

function createDropdown(item: HTMLElement | null, ctx: ToolbarState): Dropdown | undefined {
  if (item === null) return undefined
  const trigger = item.querySelector<HTMLElement>(HOOK.trigger)
  const body = item.querySelector<HTMLElement>(HOOK.bodyWrapper)
  if (trigger === null || body === null) return undefined

  const arrow = body.querySelector<HTMLElement>(HOOK.dropdownArrow)
  const isOpen = (): boolean => body.classList.contains(CLS.dropdownOpen)

  const close = (): void => {
    if (!isOpen()) return
    body.classList.remove(CLS.dropdownOpen)
    body.removeAttribute('style')
    arrow?.classList.remove(CLS.dropdownArrowTop)
    arrow?.removeAttribute('style')
    ctx.keepOpen = false
  }
  const open = (): void => {
    body.classList.add(CLS.dropdownOpen)
    body.setAttribute('style', DROPDOWN_OPEN_STYLE)
    arrow?.classList.add(CLS.dropdownArrowTop)
    arrow?.setAttribute('style', DROPDOWN_ARROW_STYLE)
    ctx.keepOpen = true
    body.dispatchEvent(new Event('sb-dropdown-open'))
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isOpen()) close()
    else open()
  })
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target !== null && item.contains(target)) return
    close()
  })
  return { body, open, close, isOpen }
}

function closeAllDropdowns(dropdowns: DropdownMap): void {
  for (const dropdown of Object.values(dropdowns)) dropdown?.close()
}

/** 「自由設定」（数値 ＋ px/%/em/rem ＋ 適用する） */
function wireFreeFontSize(dropdown: Dropdown | undefined, apply: (name: string, value: unknown) => void): void {
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

/** 実物と同じく、ツールバー本体に `left` / `top` を直接書き込む */
function positionToolbar(wrapper: HTMLElement, quill: Quill, range: QuillRange): void {
  const bounds = quill.getBounds(range.index, range.length)
  if (bounds === null) return

  const host = (wrapper.offsetParent ?? wrapper.parentElement) as HTMLElement | null
  if (host === null) return
  const hostRect = host.getBoundingClientRect()
  const editorRect = quill.container.getBoundingClientRect()

  const selection: Box = {
    left: editorRect.left + bounds.left - hostRect.left,
    top: editorRect.top + bounds.top - hostRect.top,
    width: bounds.width,
    height: bounds.height,
  }
  const placement = computeToolbarPosition(
    selection,
    { width: wrapper.offsetWidth, height: wrapper.offsetHeight },
    { width: hostRect.width, height: hostRect.height },
  )

  wrapper.style.setProperty('left', `${placement.left}px`)
  wrapper.style.setProperty('top', `${placement.top}px`)

  const arrow = wrapper.querySelector<HTMLElement>(HOOK.arrow)
  if (arrow === null) return
  arrow.classList.remove(CLS.arrowTop, CLS.arrowBottom)
  arrow.classList.add(placement.placement === 'above' ? CLS.arrowBottom : CLS.arrowTop)
  // 実物も矢印には `left` だけを inline で書いていた（中央寄せの margin-left は実CSS側にある）
  arrow.style.setProperty('left', `${placement.arrowLeft}px`)
}

/** 押下状態（白丸背景＋黒アイコン）を現在の書式に合わせる */
function syncActiveState(wrapper: HTMLElement, formats: Record<string, unknown>): void {
  const mark = (selector: string, active: boolean, iconKey?: string): void => {
    const node = wrapper.querySelector(selector)
    const item = node?.closest(HOOK.item)
    item?.classList.toggle(CLS.itemActive, active)
    const swap = iconKey === undefined ? undefined : ICON_SWAP[iconKey]
    if (swap !== undefined) node?.setAttribute('src', active ? swap.on : swap.off)
  }
  mark(HOOK.bold, formats['bold'] === true, 'bold')
  mark(HOOK.italic, formats['italic'] === true)
  mark(HOOK.underline, formats['underline'] === true)
  mark(HOOK.strike, formats['strike'] === true, 'strike')
  mark(HOOK.scriptSuper, formats['script'] === 'super')
  mark(HOOK.scriptSub, formats['script'] === 'sub')

  setTriggerLabel(wrapper, HOOK.header, headerLabel(formats['header']))
  setTriggerLabel(wrapper, HOOK.fontSize, fontSizeLabel(formats['size']))
  setTriggerLabel(wrapper, HOOK.fontFamily, fontFamilyLabel(formats['font']))
}

function setTriggerLabel(wrapper: HTMLElement, itemSelector: string, label: string): void {
  const node = wrapper.querySelector<HTMLElement>(`${itemSelector} ${HOOK.selectForm}`)
  if (node !== null) node.textContent = label
}

// ───────────────────────────── カラーピッカー ─────────────────────────────

/** ポップオーバーは document.body 直下（実物と同じく `#root` の外）に1つだけ出す */
function openColorPicker(
  anchor: HTMLElement,
  title: string,
  apply: (hex: string) => void,
  ctx: ToolbarState,
  refresh: () => void,
): void {
  injectPickerCss()
  document.querySelector('.editor-toolbar-color-picker')?.remove()

  const rect = anchor.getBoundingClientRect()
  const left = clamp(rect.left + rect.width / 2 - PICKER_WIDTH / 2, 8, Math.max(8, window.innerWidth - PICKER_WIDTH - 8))
  const top = clamp(rect.bottom + 8, 8, Math.max(8, window.innerHeight - 320))

  const popover = document.createElement('div')
  popover.setAttribute('role', 'presentation')
  popover.className = 'MuiPopover-root editor-toolbar-color-picker MuiModal-root css-mwpql5'
  popover.setAttribute('aria-label', title)
  popover.innerHTML =
    '<div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop css-esi9ax"></div>' +
    '<div tabindex="0" data-testid="sentinelStart"></div>' +
    '<div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation8 MuiPopover-paper css-1dmzujt" ' +
    `tabindex="-1" style="top: ${top}px; left: ${left}px;">` +
    '<div class="MuiBox-root css-1xyx5ni">' +
    CHROME_PICKER_HTML +
    githubPickerMarkup() +
    '<div class="MuiBox-root css-170de7g"><button class="MuiButtonBase-root MuiButton-root MuiButton-contained ' +
    'MuiButton-containedPrimary MuiButton-sizeMedium MuiButton-containedSizeMedium MuiButton-fullWidth css-1yaowxx" ' +
    'tabindex="0" type="button">適用する<span class="MuiTouchRipple-root css-w0pj6f"></span></button></div>' +
    '</div></div><div tabindex="0" data-testid="sentinelEnd"></div>'
  document.body.append(popover)

  ctx.keepOpen = true
  const close = (): void => {
    popover.remove()
    ctx.keepOpen = false
    refresh()
  }
  popover.querySelector('.MuiBackdrop-root')?.addEventListener('click', close)

  const picker = wireChromePicker(popover)
  for (const swatch of popover.querySelectorAll<HTMLElement>('.github-picker [title]')) {
    swatch.addEventListener('click', () => {
      const hex = swatch.getAttribute('title') ?? ''
      const normalized = normalizeHex(hex)
      if (normalized === null) return // `#fffff66` のような不正な色は実物でも何も起きない
      picker.set(normalized)
      apply(normalized)
    })
  }
  popover.querySelector('.css-1yaowxx')?.addEventListener('click', () => {
    const hex = normalizeHex(picker.get())
    if (hex !== null) apply(hex)
    close()
  })
}

function githubPickerMarkup(): string {
  return (
    '<div class="github-picker " style="width: 200px; background: rgb(255, 255, 255); ' +
    'border: 1px solid rgba(0, 0, 0, 0.2); box-shadow: rgba(0, 0, 0, 0.15) 0px 3px 12px; border-radius: 4px; ' +
    'position: relative; padding: 5px; display: flex; flex-wrap: wrap;">' +
    TOOLBAR_SWATCHES.map(swatchMarkup).join('') +
    '</div>'
  )
}

interface ChromePicker {
  readonly get: () => string
  readonly set: (hex: string) => void
}

/** 採取した ChromePicker のマークアップ（彩度面 / 色相バー / hex入力）を動かす */
function wireChromePicker(popover: HTMLElement): ChromePicker {
  const saturation = popover.querySelector<HTMLElement>('.saturation-white')
  const saturationBg = saturation?.parentElement ?? null
  const saturationMarker = saturation?.querySelector<HTMLElement>(':scope > div:nth-child(2)') ?? null
  const hue = popover.querySelector<HTMLElement>('.hue-horizontal')
  const hueMarker = hue?.querySelector<HTMLElement>(':scope > div:last-child') ?? null
  const hexInput = popover.querySelector<HTMLInputElement>('#rc-editable-input-1')
  const preview = popover.querySelector<HTMLElement>('.flexbox-fix div[style*="z-index: 2"]')

  let hsv: Hsv = { h: 0, s: 0, v: 0 }

  const render = (): void => {
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v)
    if (hexInput !== null) hexInput.value = hex
    saturationBg?.style.setProperty('background', hsvToHex(hsv.h, 1, 1))
    saturationMarker?.style.setProperty('left', `${hsv.s * 100}%`)
    saturationMarker?.style.setProperty('top', `${(1 - hsv.v) * 100}%`)
    hueMarker?.style.setProperty('left', `${(hsv.h / 360) * 100}%`)
    preview?.style.setProperty('background', hex)
  }

  const dragOn = (surface: HTMLElement | null, onMove: (ratioX: number, ratioY: number) => void): void => {
    if (surface === null) return
    const update = (event: MouseEvent): void => {
      const box = surface.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      onMove(clamp((event.clientX - box.left) / box.width, 0, 1), clamp((event.clientY - box.top) / box.height, 0, 1))
      render()
    }
    surface.addEventListener('mousedown', (event) => {
      event.preventDefault()
      update(event)
      const move = (moveEvent: MouseEvent): void => update(moveEvent)
      const up = (): void => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    })
  }

  dragOn(saturation, (x, y) => {
    hsv = { h: hsv.h, s: x, v: 1 - y }
  })
  dragOn(hue, (x) => {
    hsv = { h: x * 360, s: hsv.s, v: hsv.v }
  })
  hexInput?.addEventListener('change', () => {
    const parsed = hexToHsv(hexInput.value)
    if (parsed === null) {
      render()
      return
    }
    hsv = parsed
    render()
  })

  render()
  return {
    get: () => hexInput?.value ?? hsvToHex(hsv.h, hsv.s, hsv.v),
    set: (hex: string) => {
      const parsed = hexToHsv(hex)
      if (parsed === null) return
      hsv = parsed
      render()
    },
  }
}

function injectPickerCss(): void {
  const id = 'sb-editor-toolbar-color-picker-css'
  if (document.getElementById(id) !== null) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = PICKER_CSS
  document.head.append(style)
}
