/**
 * 画像と動画のどちらにも付けられる設定（属性）。2026-10-27 指示㉑ 本人「動画にもリンク入れたい」「画像でできること全部入れて」。
 * それまでリンク・計測URL・アニメーションは画像だけで、動画に差し替えると外れていた。
 *
 *   data-link-url       … リンクの行き先（配信で <a> で包む・delivery-image-links.ts）
 *   data-link-target    … 開き方（_blank / _self）
 *   data-tracking-urls  … 計測URL（押したときに送る先・JSON の配列）
 *   data-anim / data-anim-speed / data-anim-loop … アニメーション（anim-presets.ts）
 * 動画の代替テキストは aria-label（画像は alt）。
 *
 * Quill を読み込まない（本文の部品 media-blots.ts と、node のテストの両方から読む）。
 */
export const MEDIA_SETTING_ATTRS = [
  'data-link-url',
  'data-link-target',
  'data-tracking-urls',
  'data-anim',
  'data-anim-speed',
  'data-anim-loop',
] as const

/** 動画の代替テキスト（画像の alt にあたる） */
export const VIDEO_LABEL_ATTR = 'aria-label'

const ALL_ATTRS: readonly string[] = [...MEDIA_SETTING_ATTRS, VIDEO_LABEL_ATTR]

/** 要素の設定（値のある物だけ） */
export function mediaSettingsOf(el: Element): Record<string, string> {
  return Object.fromEntries(
    MEDIA_SETTING_ATTRS.flatMap((name) => {
      const value = el.getAttribute(name) ?? ''
      return value === '' ? [] : [[name, value]]
    }),
  )
}

/** 設定を当てる（渡していない物は外す）。動画の代替テキスト（aria-label）も同じく */
export function applyMediaSettings(el: Element, settings: Readonly<Record<string, string>>): void {
  for (const name of ALL_ATTRS) {
    const value = settings[name] ?? ''
    if (value === '') el.removeAttribute(name)
    else el.setAttribute(name, value)
  }
}
