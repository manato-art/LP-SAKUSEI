/**
 * Widget編集（部品で作る）の小さな道具（widget-studio-builder.ts から分けた・2026-09-24）。
 */
import { BUILDER_TEMPLATE } from './nocode/templates/builder.ts'
import { items, str, type TemplateData } from './nocode/templates/types.ts'
import { FONT } from './widget-editor-theme.ts'

/** 登録するときの名前の初期値（「組み立てたWidget（最初の見出し）」。見本1つなら見本の名前） */
export function suggestBuilderName(data: TemplateData): string {
  const blocks = items(data, 'screens').flatMap((screen) => items(screen, 'blocks'))
  const only = blocks.length === 1 ? blocks[0] : undefined
  if (only !== undefined && str(only, 'type') === 'sample' && str(only, 'title').trim() !== '') return str(only, 'title').trim()
  const firstHeading = blocks.find((block) => str(block, 'type') === 'heading')
  const hint = str(firstHeading ?? {}, 'text')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 20)
  return hint === '' ? BUILDER_TEMPLATE.name : `${BUILDER_TEMPLATE.name}（${hint}）`
}

/** 部品が1つも無いときの左の案内 */
export function emptyHint(): HTMLElement {
  const hint = document.createElement('div')
  hint.dataset['widgetEmpty'] = 'true'
  hint.setAttribute('contenteditable', 'false')
  hint.textContent = '左の「部品を足す」から部品をここへ運ぶか、右の「何から作りますか？」から選ぶと、ここに出ます'
  hint.style.cssText =
    `margin:24px 16px;padding:40px 16px;border:1.5px dashed #C9CFD6;border-radius:10px;text-align:center;` +
    `color:#6B7480;font:14px/1.8 ${FONT};user-select:none`
  return hint
}
