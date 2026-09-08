/**
 * Meta広告連携（媒体実績の取り込み）。
 *
 * このLPに対応する広告アカウント／キャンペーン等のIDを保存し、指定期間の
 * 配信金額 / IMP / 媒体Click / 媒体CV を取り込む。取り込んだ値は日別に**上書き**されるので、
 * 何度実行しても二重計上にならない。
 *
 * 【重要】アクセストークンはこの画面では一切扱わない。サーバー側が環境変数
 * `META_ACCESS_TOKEN` から読む。未設定なら取り込み時にその旨が返る。
 */
import { api, type AbTest } from '../api.ts'
import { toast } from '../ui.ts'
import { defaultRange, resolvePreset, type DateRange } from '../pages/report-period.ts'

const CSS_ID = 'sb-meta-link-css'
let isOpen = false

const LEVELS: readonly { value: string; label: string }[] = [
  { value: 'account', label: '広告アカウント' },
  { value: 'campaign', label: 'キャンペーン' },
  { value: 'adset', label: '広告セット' },
  { value: 'ad', label: '広告' },
]

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .sb-ml-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:100000;
      display:flex; align-items:center; justify-content:center; padding:24px;
    }
    .sb-ml-card {
      background:#fff; border-radius:8px; width:min(520px,100%); max-height:84vh; overflow:auto;
      padding:22px 24px; box-shadow:0 8px 32px rgba(0,0,0,.22); box-sizing:border-box;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif; color:#1a1a1a;
    }
    .sb-ml-title { font-size:15px; font-weight:700; margin:0 0 4px; }
    .sb-ml-lead { font-size:12px; color:#666; line-height:1.7; margin:0 0 16px; }
    .sb-ml-field { margin-bottom:12px; }
    .sb-ml-field label { display:block; font-size:11px; font-weight:600; color:#666; margin-bottom:5px; }
    .sb-ml-field input, .sb-ml-field select {
      width:100%; height:32px; box-sizing:border-box; border:1px solid #e5e5ea; border-radius:5px;
      padding:0 9px; font-size:13px; font-family:inherit; color:#1a1a1a; background:#fff;
    }
    .sb-ml-row { display:flex; gap:8px; }
    .sb-ml-row > * { flex:1; min-width:0; }
    .sb-ml-presets { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 0; }
    .sb-ml-preset {
      font-size:12px; padding:4px 10px; border:1px solid #e5e5ea; border-radius:14px;
      background:#fff; cursor:pointer; font-family:inherit; color:#333;
    }
    .sb-ml-preset:hover { background:#f0f7ff; border-color:#0091ff; color:#0091ff; }
    .sb-ml-note { font-size:11px; color:#888; line-height:1.8; margin:12px 0 0; padding-left:16px; }
    .sb-ml-msg { font-size:12px; margin:10px 0 0; min-height:16px; }
    .sb-ml-msg.err { color:#d32f2f; }
    .sb-ml-msg.ok { color:#0a8f3c; }
    .sb-ml-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
    .sb-ml-btn {
      font-size:13px; padding:8px 16px; border-radius:5px; cursor:pointer;
      border:1px solid #e5e5ea; background:#fff; color:#333; font-family:inherit;
    }
    .sb-ml-btn.primary { background:#0091ff; border-color:#0091ff; color:#fff; }
    .sb-ml-btn[disabled] { opacity:.55; cursor:default; }
  `
  document.head.append(s)
}

export function openMetaLinkModal(abTestUid: string, abTestTitle: string): void {
  if (isOpen) return
  injectStyles()
  isOpen = true

  const overlay = document.createElement('div')
  overlay.className = 'sb-ml-overlay'
  const card = document.createElement('div')
  card.className = 'sb-ml-card'

  const title = document.createElement('h3')
  title.className = 'sb-ml-title'
  title.textContent = 'Meta広告連携'
  const lead = document.createElement('p')
  lead.className = 'sb-ml-lead'
  lead.textContent =
    `「${abTestTitle}」に対応する広告を紐付けて、配信金額・IMP・媒体Click・媒体CV を取り込みます。` +
    'アクセストークンはサーバーの環境変数で管理するため、ここには入力しません。'

  // 紐付け
  const levelField = document.createElement('div')
  levelField.className = 'sb-ml-field'
  const levelLabel = document.createElement('label')
  levelLabel.textContent = '紐付ける階層'
  const levelSelect = document.createElement('select')
  for (const l of LEVELS) {
    const o = document.createElement('option')
    o.value = l.value
    o.textContent = l.label
    levelSelect.append(o)
  }
  levelField.append(levelLabel, levelSelect)

  const idField = document.createElement('div')
  idField.className = 'sb-ml-field'
  const idLabel = document.createElement('label')
  idLabel.textContent = 'ID（広告アカウントは act_ を除いた数字でも可）'
  const idInput = document.createElement('input')
  idInput.type = 'text'
  idInput.placeholder = '例: 1869210184060400'
  idField.append(idLabel, idInput)

  // 期間
  const range: DateRange = defaultRange()
  const periodField = document.createElement('div')
  periodField.className = 'sb-ml-field'
  const periodLabel = document.createElement('label')
  periodLabel.textContent = '取り込む期間'
  const periodRow = document.createElement('div')
  periodRow.className = 'sb-ml-row'
  const startInput = document.createElement('input')
  startInput.type = 'date'
  startInput.value = range.startDate
  const endInput = document.createElement('input')
  endInput.type = 'date'
  endInput.value = range.endDate
  periodRow.append(startInput, endInput)
  const presets = document.createElement('div')
  presets.className = 'sb-ml-presets'
  for (const p of [
    { value: 'today', label: '今日' },
    { value: 'yesterday', label: '昨日' },
    { value: 'last_three_days', label: '過去3日間' },
    { value: 'last_seven_days', label: '過去7日間' },
  ]) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'sb-ml-preset'
    b.textContent = p.label
    b.addEventListener('click', () => {
      const r = resolvePreset(p.value)
      if (r === null) return
      startInput.value = r.startDate
      endInput.value = r.endDate
    })
    presets.append(b)
  }
  periodField.append(periodLabel, periodRow, presets)

  const msg = document.createElement('p')
  msg.className = 'sb-ml-msg'

  const notes = document.createElement('ul')
  notes.className = 'sb-ml-note'
  for (const t of [
    '取り込んだ日の値は上書きされます（何度実行しても二重計上になりません）',
    'PV・Click・CVは計測タグ側の実測値で、この取り込みでは変わりません',
    'CVとして数える媒体側のイベントは購入・リード系の標準的なものです',
  ]) {
    const li = document.createElement('li')
    li.textContent = t
    notes.append(li)
  }

  const actions = document.createElement('div')
  actions.className = 'sb-ml-actions'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'sb-ml-btn'
  closeBtn.textContent = '閉じる'
  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'sb-ml-btn'
  saveBtn.textContent = '紐付けを保存'
  const syncBtn = document.createElement('button')
  syncBtn.type = 'button'
  syncBtn.className = 'sb-ml-btn primary'
  syncBtn.textContent = '媒体データを取り込む'
  actions.append(closeBtn, saveBtn, syncBtn)

  const close = (): void => {
    isOpen = false
    overlay.remove()
  }
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  const setMsg = (text: string, kind: 'ok' | 'err' | '' = ''): void => {
    msg.textContent = text
    msg.className = `sb-ml-msg${kind === '' ? '' : ` ${kind}`}`
  }

  const saveLink = async (): Promise<boolean> => {
    const id = idInput.value.trim()
    if (id === '') {
      setMsg('IDを入力してください', 'err')
      return false
    }
    try {
      await api.setMetaLink(abTestUid, { meta_level: levelSelect.value, meta_object_id: id })
      return true
    } catch (err) {
      setMsg((err as Error).message, 'err')
      return false
    }
  }

  saveBtn.addEventListener('click', () => {
    void saveLink().then((ok) => {
      if (ok) {
        setMsg('紐付けを保存しました', 'ok')
        toast('Meta広告の紐付けを保存しました')
      }
    })
  })

  syncBtn.addEventListener('click', () => {
    syncBtn.disabled = true
    syncBtn.textContent = '取り込み中…'
    setMsg('')
    void (async () => {
      // 先に紐付けを保存してから取り込む（入力したまま押しても動くように）
      const saved = await saveLink()
      if (!saved) {
        syncBtn.disabled = false
        syncBtn.textContent = '媒体データを取り込む'
        return
      }
      try {
        const out = await api.metaSync(abTestUid, {
          start_date: startInput.value,
          end_date: endInput.value,
        })
        setMsg(`${out.days}日ぶんの媒体実績を取り込みました（${out.start_date} 〜 ${out.end_date}）`, 'ok')
        toast('媒体データを取り込みました')
      } catch (err) {
        setMsg((err as Error).message, 'err')
      } finally {
        syncBtn.disabled = false
        syncBtn.textContent = '媒体データを取り込む'
      }
    })()
  })

  card.append(title, lead, levelField, idField, periodField, msg, notes, actions)
  overlay.append(card)
  document.body.append(overlay)

  // 保存済みの紐付けを反映する
  void api.abTest(abTestUid).then(
    ({ ab_test }: { ab_test: AbTest }) => {
      if (typeof ab_test.meta_level === 'string') levelSelect.value = ab_test.meta_level
      if (typeof ab_test.meta_object_id === 'string') idInput.value = ab_test.meta_object_id
    },
    () => {
      /* 取れなくても入力はできるので黙って続行 */
    },
  )
}
