/**
 * 「新しいタスク」の作成画面。
 *
 * 実物はモーダルではなく、タスク一覧の中身がそのまま差し替わる2段構え
 * （2026-09-09 に 実物のタスク画面 を開いて確認）:
 *   1段目 … テンプレート選択（4枚のカード）
 *   2段目 … 設定フォーム（テンプレートの初期値が入った状態）
 * URLは変わらず、各段に「戻る」リンクが付く。
 */
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { buildNotifyTarget } from '../panels/notify-target.ts'
import {
  MINUTES,
  SCHEDULES,
  TASK_TEMPLATES,
  WEEKDAYS,
  needsHour,
  needsMinute,
  type ScheduleKind,
  type TaskTemplate,
} from './task-templates.ts'

const CSS_ID = 'sb-task-create-css'

function injectCss(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .tc { padding:24px 28px; font-family:${T.font}; color:${T.text}; }
    .tc-back {
      display:inline-flex; align-items:center; gap:6px; border:0; background:transparent;
      color:${T.sub}; font:inherit; font-size:12px; cursor:pointer; padding:0; margin-bottom:14px;
    }
    .tc-back:hover { color:${T.text}; }
    .tc h1 { font-size:22px; font-weight:700; margin:0 0 6px; }
    .tc-lead { font-size:12px; color:${T.sub}; line-height:1.8; margin:0 0 20px; }
    .tc-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
    @media (max-width:1100px) { .tc-cards { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:720px) { .tc-cards { grid-template-columns:minmax(0,1fr); } }
    .tc-card {
      text-align:left; background:${T.surface}; border:1px solid #E6E9F0; border-radius:10px;
      padding:16px 18px; cursor:pointer; font:inherit; color:inherit;
      display:flex; flex-direction:column; gap:8px; min-height:118px;
    }
    .tc-card:hover { border-color:var(--sb-accent, #0091FF); box-shadow:0 2px 10px rgba(0,0,0,.06); }
    .tc-card-title { font-size:14px; font-weight:700; }
    .tc-card-desc { font-size:12px; color:${T.sub}; line-height:1.8; flex:1; }
    .tc-badge {
      align-self:flex-start; font-size:11px; padding:3px 10px; border-radius:999px;
      background:#EEF2F7; color:#5B6472;
    }
    .tc-badge.on { background:var(--sb-accent-tint, #E6F4FF); color:var(--sb-accent, #0091FF); }

    /* ── フォーム ── */
    .tc-form { max-width:720px; display:flex; flex-direction:column; gap:20px; }
    .tc-of { font-size:12px; color:${T.sub}; margin:-14px 0 0; }
    .tc-field { display:flex; flex-direction:column; gap:6px; }
    .tc-label { font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px; }
    .tc-req { font-size:10px; color:#D0021B; border:1px solid #F5C2C7; border-radius:3px; padding:1px 5px; }
    .tc-input, .tc-select, .tc-textarea {
      border:1px solid #DDD; border-radius:6px; padding:9px 11px; font:inherit; font-size:13px;
      background:${T.surface}; color:${T.text}; outline:none; box-sizing:border-box; width:100%;
    }
    .tc-input:focus, .tc-select:focus, .tc-textarea:focus { border-color:var(--sb-accent, #0091FF); }
    .tc-textarea { min-height:180px; resize:vertical; line-height:1.8; }
    .tc-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .tc-row .tc-select { width:auto; min-width:160px; }
    .tc-days { display:flex; gap:6px; }
    .tc-day {
      width:34px; height:32px; border:1px solid #DDD; border-radius:6px; background:${T.surface};
      color:${T.sub}; font:inherit; font-size:12px; cursor:pointer;
    }
    .tc-day.on {
      background:var(--sb-accent, #0091FF); border-color:var(--sb-accent, #0091FF);
      color:var(--sb-accent-ink, #fff); font-weight:700;
    }
    .tc-link { border:0; background:transparent; color:var(--sb-accent, #0091FF);
      font:inherit; font-size:12px; cursor:pointer; padding:0; }
    .tc-link:hover { text-decoration:underline; }
    .tc-submit {
      align-self:flex-start; border:0; border-radius:6px; padding:10px 24px; cursor:pointer;
      background:var(--sb-accent, #0091FF); color:var(--sb-accent-ink, #fff);
      font:inherit; font-size:13px; font-weight:700;
    }
    .tc-submit:disabled { opacity:.5; cursor:default; }
  `
  document.head.append(s)
}

/** 「‹ ◯◯に戻る」 */
function backLink(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'tc-back'
  b.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>'
  b.append(document.createTextNode(label))
  b.addEventListener('click', onClick)
  return b
}

function labelled(text: string, required: boolean, control: HTMLElement): HTMLElement {
  const field = el('div', { class: 'tc-field' })
  const label = el('div', { class: 'tc-label' })
  label.append(document.createTextNode(text))
  if (required) label.append(el('span', { class: 'tc-req', text: '必須' }))
  field.append(label, control)
  return field
}

function select(options: readonly { value: string; label: string }[]): HTMLSelectElement {
  const s = document.createElement('select')
  s.className = 'tc-select'
  for (const o of options) {
    const opt = document.createElement('option')
    opt.value = o.value
    opt.textContent = o.label
    s.append(opt)
  }
  return s
}

export interface TaskCreateDeps {
  /** 一覧へ戻る（作成後もこれで戻る） */
  onDone: () => void
}

/** 1段目: テンプレート選択 */
export function renderTemplatePicker(host: HTMLElement, deps: TaskCreateDeps): void {
  injectCss()
  const root = el('div', { class: 'tc' })
  root.append(backLink('タスク一覧に戻る', deps.onDone))
  root.append(
    el('h1', { text: '新しいタスクを作成' }),
    el('p', {
      class: 'tc-lead',
      text: 'テンプレートを選ぶと、目的に合わせた設定があらかじめ入った状態で始められます。',
    }),
  )

  const cards = el('div', { class: 'tc-cards' })
  for (const template of TASK_TEMPLATES) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'tc-card'
    card.dataset['template'] = template.id
    card.append(
      el('div', { class: 'tc-card-title', text: template.title }),
      el('div', { class: 'tc-card-desc', text: template.description }),
      el('div', {
        class: `tc-badge${template.badge === 'スポット' ? ' on' : ''}`,
        text: template.badge,
      }),
    )
    card.addEventListener('click', () => renderTaskForm(host, template, deps))
    cards.append(card)
  }
  root.append(cards)
  host.replaceChildren(root)
}

/** 2段目: 設定フォーム */
export function renderTaskForm(
  host: HTMLElement,
  template: TaskTemplate,
  deps: TaskCreateDeps,
): void {
  injectCss()
  const root = el('div', { class: 'tc' })
  root.append(backLink('テンプレート選択に戻る', () => renderTemplatePicker(host, deps)))
  root.append(el('h1', { text: '新しいタスク' }))

  const form = el('div', { class: 'tc-form' })
  form.append(el('p', { class: 'tc-of', text: `テンプレート: ${template.title}` }))

  // タスク名
  const name = document.createElement('input')
  name.type = 'text'
  name.className = 'tc-input'
  name.placeholder = '例: 週次レポート'
  name.value = template.preset.name

  // スケジュール（種類 → 曜日 → 時 → 分 の順に、必要なものだけ出す）
  const scheduleRow = el('div', { class: 'tc-row' })
  const kind = select(SCHEDULES.map((s) => ({ value: s.value, label: s.label })))
  kind.value = template.preset.schedule
  const days = el('div', { class: 'tc-days' })
  const chosenDays = new Set<number>()
  WEEKDAYS.forEach((d, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tc-day'
    b.textContent = d
    b.addEventListener('click', () => {
      if (chosenDays.has(i)) chosenDays.delete(i)
      else chosenDays.add(i)
      b.classList.toggle('on', chosenDays.has(i))
    })
    days.append(b)
  })
  const hour = select(
    Array.from({ length: 24 }, (_, i) => {
      const v = String(i).padStart(2, '0')
      return { value: v, label: `${v}時` }
    }),
  )
  hour.value = template.preset.hour
  const minute = select(MINUTES.map((m) => ({ value: m, label: `${m}分` })))
  minute.value = template.preset.minute
  scheduleRow.append(kind, days, hour, minute)

  const syncSchedule = (): void => {
    const k = kind.value as ScheduleKind
    days.style.display = k === 'weekly' ? '' : 'none'
    hour.style.display = needsHour(k) ? '' : 'none'
    minute.style.display = needsMinute(k) ? '' : 'none'
  }
  kind.addEventListener('change', syncSchedule)
  syncSchedule()

  // 通知先。未設定なら取得手順、設定済みなら送り先の選択が出る
  const notifyField = buildNotifyTarget()

  const desc = document.createElement('input')
  desc.type = 'text'
  desc.className = 'tc-input'
  desc.placeholder = 'タスクの概要'

  const prompt = document.createElement('textarea')
  prompt.className = 'tc-textarea'
  prompt.placeholder = 'AIへの指示内容'
  prompt.value = template.preset.prompt

  const submit = document.createElement('button')
  submit.type = 'button'
  submit.className = 'tc-submit'
  submit.textContent = 'タスクを作成'
  submit.addEventListener('click', () => {
    const title = name.value.trim()
    if (title === '') {
      toast('タスク名を入力してください', 'error')
      name.focus()
      return
    }
    if (prompt.value.trim() === '') {
      toast('beyondAIへの指示を入力してください', 'error')
      prompt.focus()
      return
    }
    if ((kind.value as ScheduleKind) === 'weekly' && chosenDays.size === 0) {
      toast('曜日を1つ以上選んでください', 'error')
      return
    }
    submit.disabled = true
    submit.textContent = '作成中…'
    void api.createTask(title).then(
      () => {
        toast('タスクを作成しました')
        deps.onDone()
      },
      (error: Error) => {
        submit.disabled = false
        submit.textContent = 'タスクを作成'
        toast(error.message, 'error')
      },
    )
  })

  form.append(
    labelled('タスク名', true, name),
    labelled('スケジュール', true, scheduleRow),
    labelled('実行結果の通知', false, notifyField.el),
    labelled('説明', false, desc),
    labelled('beyondAIへの指示（プロンプト）', true, prompt),
    submit,
  )
  root.append(form)
  host.replaceChildren(root)
}
