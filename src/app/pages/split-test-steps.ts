/**
 * Versionオプション設定の「どのステップの Version を設定するか」（2026-09-24）。
 *
 * 以前は1つ目のステップの Version しか出しておらず、2つ目以降のステップは設定できなかった。
 * ステップが2つ以上あるときは、Version一覧の上でステップを選べるようにする。
 * 選んだステップはタブ（デバイス別 / 流入元別 …）を移っても覚えておく。
 */
import { api, type Version } from '../api.ts'
import { T } from '../ui.ts'
import { stepLabel } from './editor-step-list.ts'

interface Step {
  uid: string
  memo?: string
  archived?: boolean
}

/** beyondページ → 選んだステップ（画面をまたいで覚える） */
const chosenStepByPage = new Map<string, string>()

export interface StepVersions {
  steps: readonly Step[]
  step: Step
  /** アーカイブしていない Version（この画面で設定する対象） */
  versions: Version[]
}

/** 選んでいるステップ（無い・消えたときは最初のステップ）と、その Version を読む */
export async function loadStepVersions(abTestUid: string): Promise<StepVersions | null> {
  const { articles } = await api.articles(abTestUid)
  const steps = articles.filter((a) => a.archived !== true)
  const step = steps.find((s) => s.uid === chosenStepByPage.get(abTestUid)) ?? steps[0]
  if (step === undefined) return null
  const { versions } = await api.versions(step.uid)
  return { steps, step, versions: versions.filter((v) => v.archived !== true) }
}

/**
 * ステップを選ぶ欄。ステップが1つなら出さない。選び直したら画面を描き直す（同じタブのまま）。
 * `before` の直前に置く。
 */
export function stepChooser(abTestUid: string, loaded: StepVersions, before: HTMLElement): void {
  if (loaded.steps.length < 2) return
  const wrap = document.createElement('label')
  wrap.style.cssText = `display:flex;align-items:center;gap:8px;margin:8px 0 12px;font-size:13px;color:${T.text};font-family:${T.font}`
  wrap.append('設定するステップ')
  const select = document.createElement('select')
  select.style.cssText = 'padding:6px 10px;border:1px solid #d6dae1;border-radius:6px;font-size:13px;background:var(--sb-c-ffffff, #FFFFFF)'
  loaded.steps.forEach((step, index) => {
    const option = document.createElement('option')
    option.value = step.uid
    option.textContent = stepLabel(step, index)
    option.selected = step.uid === loaded.step.uid
    select.append(option)
  })
  select.addEventListener('change', () => {
    chosenStepByPage.set(abTestUid, select.value)
    dispatchEvent(new HashChangeEvent('hashchange'))
  })
  wrap.append(select)
  before.before(wrap)
}
