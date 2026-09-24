/**
 * 下部バーのステップの「…」（2026-09-24・全体点検の「あった方がいい」）。
 * 以前はステップを作ることしかできず、間違えて作ったステップの名前を直す・消すことができなかった。
 */
import { stepsApi } from '../api-steps.ts'
import { chooseCard, confirmCard, promptCard } from '../dialog.ts'
import { toast } from '../ui.ts'
import type { EditorContext } from './editor-context.ts'
import { stepLabel } from './editor-step-list.ts'

/** ステップを作るときの見本と同じ色（採取物の7色） */
const STEP_COLORS: readonly { value: string; label: string }[] = [
  { value: '', label: '色なし' },
  { value: '#000000', label: '黒' },
  { value: '#6236ff', label: '紫' },
  { value: '#32c5ff', label: '水色' },
  { value: '#6dd400', label: '緑' },
  { value: '#f7b500', label: '黄' },
  { value: '#fa7400', label: 'オレンジ' },
  { value: '#ff0000', label: '赤' },
]

export interface StepActionDeps {
  /** ステップ一覧を取り直して描き直す（いま開いているステップはそのまま） */
  readonly refresh: () => Promise<void>
  /** index のステップを開く */
  readonly open: (index: number) => Promise<void>
}

export async function openStepMenu(ctx: EditorContext, index: number, deps: StepActionDeps): Promise<void> {
  const step = ctx.articles[index]
  if (step === undefined) return
  const name = stepLabel(step, index)
  const isFirst = index === 0
  const choice = await chooseCard({
    title: name,
    options: [
      { value: 'rename', label: '名前を変える' },
      { value: 'color', label: '色を変える' },
      ...(isFirst ? [] : [{ value: 'delete', label: 'このステップを削除', hint: 'ステップの中のVersionもまとめて消えます' }]),
    ],
  })
  try {
    if (choice === 'rename') {
      const next = await promptCard({
        title: 'ステップ名',
        value: step.memo ?? '',
        placeholder: `ステップ${String(index + 1)}`,
        submitLabel: '変える',
        validate: (value) => ([...value.trim()].length > 50 ? '50文字までです' : null),
      })
      if (next === null) return
      await stepsApi.update(step.uid, { memo: next.trim() })
      await deps.refresh()
      toast('ステップ名を変えました')
    } else if (choice === 'color') {
      const color = await chooseCard({
        title: '目印の色',
        options: STEP_COLORS,
        value: step.color ?? '',
      })
      if (color === null) return
      await stepsApi.update(step.uid, { color })
      await deps.refresh()
    } else if (choice === 'delete') {
      const ok = await confirmCard({
        title: `「${name}」を削除しますか？`,
        message: 'このステップと、中のVersion・計測の記録がまとめて消えます。',
        detail: 'このステップへのVersionリンクを置いたボタンは、最初のステップを開くようになります。元に戻せません。',
        submitLabel: '削除する',
        danger: true,
      })
      if (!ok) return
      const wasOpen = ctx.stepIndex === index
      await stepsApi.remove(step.uid)
      await deps.refresh()
      if (wasOpen) await deps.open(0)
      toast('ステップを削除しました')
    }
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}
