/**
 * スマホで下から出すシートの合図（2026-09-14）。
 *
 * CSS（mobile-css.ts）と配線（editor-mobile.ts）の両方が使う。
 * 配線側は Quill を読み込むので、CSS側がそれを巻き込まないよう名前だけここに分けてある
 * （テストは node で動くため、Quill を読むと document が無くて落ちる）。
 */

/** Version一覧を下から出しているときに body へ付ける */
export const VERSIONS_OPEN_CLASS = 'sb-m-versions-open'
/** プロパティを下から出しているときに body へ付ける */
export const PROPS_OPEN_CLASS = 'sb-m-props-open'
