/**
 * 型の探し方（2026-09-22・ノーコードでWidgetを作る③）。
 * 型の一覧そのものは list.ts（「部品を積んで作る」からも読むので、輪にならないよう分けてある）。
 */
import { BUILDER_TEMPLATE } from './builder.ts'
import { TEMPLATES } from './list.ts'
import type { NocodeTemplate } from './types.ts'

export { TEMPLATES } from './list.ts'

/** 型の名前から型を探す（「部品を積んで作る」も含む。Widgetの名前を出すときに使う） */
export function templateById(id: string): NocodeTemplate | undefined {
  return id === BUILDER_TEMPLATE.id ? BUILDER_TEMPLATE : TEMPLATES.find((t) => t.id === id)
}
