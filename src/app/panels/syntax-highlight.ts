/**
 * 構文ハイライト（Material Theme 系カラー）。
 *
 * 正規表現ベースの軽量なトークナイザ。
 * widget-editor.ts と exit-popup.ts の両方から使う。
 */

/* ── ハイライト色 ── */
export const HL = {
  tag: '#89ddff',
  tagName: '#f07178',
  attr: '#c792ea',
  string: '#c3e88d',
  text: '#eeffff',
  comment: '#546e7a',
  selector: '#82aaff',
  property: '#b2ccd6',
  value: '#f78c6c',
  punctuation: '#89ddff',
  keyword: '#c792ea',
  number: '#f78c6c',
} as const

/* ── ヘルパー ── */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function span(color: string, text: string): string {
  return `<span style="color:${color}">${text}</span>`
}

/* ── HTML ── */

export function highlightHtml(code: string): string {
  return code.replace(
    /(<!\-\-[\s\S]*?\-\->)|(<\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)(\s*\/?>)|([^<]+)/g,
    (_m, comment?: string, open?: string, tagName?: string, attrs?: string, close?: string, text?: string) => {
      if (comment !== undefined) return span(HL.comment, esc(comment))
      if (text !== undefined) return span(HL.text, esc(text))
      if (tagName === undefined) return esc(_m)
      let result = span(HL.tag, esc(open ?? ''))
      result += span(HL.tagName, esc(tagName))
      if (attrs !== undefined && attrs !== '') {
        result += highlightAttributes(attrs)
      }
      result += span(HL.tag, esc(close ?? ''))
      return result
    },
  )
}

function highlightAttributes(attrs: string): string {
  return attrs.replace(
    /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(\s*=\s*)((?:"[^"]*"|'[^']*'|[^\s>]+))|(\s+)/g,
    (_m, name?: string, eq?: string, val?: string, ws?: string) => {
      if (ws !== undefined) return ws
      if (name === undefined) return esc(_m)
      let r = span(HL.attr, esc(name))
      r += span(HL.punctuation, esc(eq ?? ''))
      r += span(HL.string, esc(val ?? ''))
      return r
    },
  )
}

/* ── CSS ── */

export function highlightCss(code: string): string {
  return code.replace(
    /(\/\*[\s\S]*?\*\/)|([.#:@]?[a-zA-Z_-][\w-]*(?:\s*[,+~>]\s*[.#:@]?[a-zA-Z_-][\w-]*)*\s*)(\{)|(\})|([a-zA-Z-]+)(\s*:\s*)((?:[^;{}](?!\/\*))*)(;)?|(\s+)|([^{}:;/\s]+)/g,
    (...args) => {
      const [_m] = args
      const comment = args[1] as string | undefined
      const selector = args[2] as string | undefined
      const openBrace = args[3] as string | undefined
      const closeBrace = args[4] as string | undefined
      const propName = args[5] as string | undefined
      const colon = args[6] as string | undefined
      const propVal = args[7] as string | undefined
      const semi = args[8] as string | undefined
      const ws = args[9] as string | undefined
      const other = args[10] as string | undefined

      if (comment !== undefined) return span(HL.comment, esc(comment))
      if (ws !== undefined) return ws
      if (closeBrace !== undefined) return span(HL.punctuation, esc(closeBrace))
      if (selector !== undefined && openBrace !== undefined) {
        return span(HL.selector, esc(selector)) + span(HL.punctuation, esc(openBrace))
      }
      if (propName !== undefined) {
        let r = span(HL.property, esc(propName))
        r += span(HL.punctuation, esc(colon ?? ''))
        r += highlightCssValue(propVal ?? '')
        if (semi !== undefined) r += span(HL.punctuation, esc(semi))
        return r
      }
      if (other !== undefined) return span(HL.text, esc(other))
      return esc(_m)
    },
  )
}

function highlightCssValue(val: string): string {
  return val.replace(
    /([0-9]+(?:\.[0-9]+)?)(px|em|rem|%|vw|vh|s|ms|deg)?|(#[0-9a-fA-F]{3,8})|(\b(?:auto|none|inherit|initial|unset|block|flex|grid|center|left|right|top|bottom|bold|normal|solid|hidden|visible|absolute|relative|fixed|sticky)\b)|([a-zA-Z-]+\s*\()|(\))|([^0-9#a-zA-Z()\s]+)|(\s+)/g,
    (_m, num?: string, unit?: string, hex?: string, keyword?: string, fn?: string, paren?: string, punct?: string, ws?: string) => {
      if (ws !== undefined) return ws
      if (num !== undefined) return span(HL.number, esc(num)) + (unit !== undefined ? span(HL.keyword, esc(unit)) : '')
      if (hex !== undefined) return span(HL.number, esc(hex))
      if (keyword !== undefined) return span(HL.keyword, esc(keyword))
      if (fn !== undefined) return span(HL.selector, esc(fn))
      if (paren !== undefined) return span(HL.punctuation, esc(paren))
      if (punct !== undefined) return span(HL.text, esc(punct))
      return esc(_m)
    },
  )
}

/* ── JavaScript（簡易） ── */

export function highlightJs(code: string): string {
  return code.replace(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b(?:function|return|var|let|const|if|else|for|while|do|switch|case|break|continue|new|this|typeof|instanceof|in|of|class|extends|import|export|default|try|catch|finally|throw|async|await|yield|void|delete|null|undefined|true|false|NaN|Infinity)\b)|(\b[0-9]+(?:\.[0-9]+)?\b)|([a-zA-Z_$][a-zA-Z0-9_$]*\s*(?=\())|([{}()[\];,.])|([^/'"`\s{}()[\];,.0-9a-zA-Z_$]+)|(\s+)/g,
    (_m, comment?: string, str?: string, kw?: string, num?: string, fn?: string, punct?: string, other?: string, ws?: string) => {
      if (comment !== undefined) return span(HL.comment, esc(comment))
      if (str !== undefined) return span(HL.string, esc(str))
      if (kw !== undefined) return span(HL.keyword, esc(kw))
      if (num !== undefined) return span(HL.number, esc(num))
      if (fn !== undefined) return span(HL.selector, esc(fn))
      if (punct !== undefined) return span(HL.punctuation, esc(punct))
      if (ws !== undefined) return ws
      if (other !== undefined) return span(HL.text, esc(other))
      return esc(_m)
    },
  )
}

/**
 * 言語を自動判定してハイライト適用。
 *
 * @param lang - 'html' | 'css' | 'javascript' | その他（html扱い）
 */
export function highlight(code: string, lang: string): string {
  if (lang === 'css') return highlightCss(code)
  if (lang === 'javascript') return highlightJs(code)
  return highlightHtml(code)
}
