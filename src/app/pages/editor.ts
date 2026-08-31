/**
 * LPエディタ（企画書 §9-1 / beyondエディター＝editor_version 2）。
 *
 * 実機の構造に合わせる:
 *   左レール4タブ（基本情報 / Version / ポップアップ / レポート）
 *   左パネル = Version一覧（名前 + 配信割合 + 更新 + Version追加）
 *   中央     = LPプレビュー（PC 620×486 / SP 430×640）※編集はQuill
 *   右レール = ツール群（コード編集 / undo / redo / 公開 …）
 * 文字を選択すると**バブルツールバー**が出る（実機と同じQuillのbubbleテーマ）。
 */
import Quill from 'quill'
import 'quill/dist/quill.bubble.css'
import { api, type Version } from '../api.ts'
import { T, button, el, toast } from '../ui.ts'

const PC_W = 620
const PC_H = 486
const SP_W = 430
const SP_H = 640

interface EditorState {
  abTestUid: string
  articleUid: string
  versions: Version[]
  currentUid: string
  preview: 'pc' | 'sp'
}

export async function renderEditor(container: HTMLElement, abTestUid: string): Promise<void> {
  container.innerHTML = ''
  const [{ ab_test }, { articles }] = await Promise.all([
    api.abTest(abTestUid),
    api.articles(abTestUid),
  ])
  const articleUid = articles[0]?.uid
  if (articleUid === undefined) {
    container.append(el('div', { text: '記事が見つかりません', style: 'padding:40px' }))
    return
  }
  const { versions } = await api.versions(articleUid)
  const state: EditorState = {
    abTestUid,
    articleUid,
    versions: [...versions],
    currentUid: versions[0]?.uid ?? '',
    preview: 'pc',
  }

  const page = el('div', { style: `display:flex;flex-direction:column;height:100vh;font-family:${T.font}` })
  page.append(topBar(ab_test.title, ab_test.ad_status, abTestUid))

  const main = el('div', { style: 'flex:1;display:flex;min-height:0' })
  const rail = leftRail()
  const versionPanel = el('div', {
    style: `width:280px;flex-shrink:0;background:${T.surface};border-right:1px solid #E5E5E5;
      display:flex;flex-direction:column`,
  })
  const canvas = el('div', {
    style: 'flex:1;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto',
  })
  const toolRail = el('div', {
    style: `width:64px;flex-shrink:0;background:${T.surface};border-left:1px solid #E5E5E5;
      display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:12px`,
  })

  main.append(rail, versionPanel, canvas, toolRail)
  page.append(main)
  container.append(page)

  // ── Quill（実機と同じ bubble テーマ＝文字選択で出るツールバー）──
  const frame = el('div', {
    style: `background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15);border-radius:4px;overflow:hidden`,
  })
  const editorHost = el('div', {})
  frame.append(editorHost)
  canvas.append(frame)

  const quill = new Quill(editorHost, {
    theme: 'bubble',
    placeholder: 'ここにLPの内容を入力してください',
    modules: {
      toolbar: [
        ['bold', 'underline', 'italic', 'strike'],
        [{ script: 'super' }, { script: 'sub' }],
        ['link'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ header: [1, 2, 3, false] }],
        [{ size: ['10px', '13px', '15px', '17px', '19px', '21px', '23px', '25px', '27px', '29px'] }],
        [{ font: [] }],
        ['clean'],
      ],
    },
  })

  const applyPreviewSize = (): void => {
    const w = state.preview === 'pc' ? PC_W : SP_W
    const h = state.preview === 'pc' ? PC_H : SP_H
    frame.style.width = `${w}px`
    editorHost.style.height = `${h}px`
    editorHost.style.overflow = 'auto'
  }
  applyPreviewSize()

  const loadVersion = (uid: string): void => {
    const v = state.versions.find((x) => x.uid === uid)
    if (v === undefined) return
    state.currentUid = uid
    quill.root.innerHTML = v.html
    renderVersionPanel()
  }

  // ── Versionパネル ──
  function renderVersionPanel(): void {
    versionPanel.innerHTML = ''
    const head = el('div', {
      style: 'padding:12px 14px;border-bottom:1px solid #EEE;display:flex;align-items:center',
    })
    head.append(
      el('strong', { text: 'Version', style: 'font-size:13px;flex:1' }),
      el('span', { text: '配信割合', style: `font-size:11px;color:${T.sub}` }),
    )
    versionPanel.append(head)

    const body = el('div', { style: 'flex:1;overflow:auto;padding:8px' })
    const total = state.versions.reduce((s, v) => s + v.distribution_ratio, 0)
    for (const v of state.versions) {
      const active = v.uid === state.currentUid
      const row = el('div', {
        style: `border:1px solid ${active ? T.primary : '#E5E5E5'};border-radius:4px;padding:10px;
          margin-bottom:8px;cursor:pointer;${active ? 'background:#F0F8FF' : ''}`,
      })
      const line = el('div', { style: 'display:flex;align-items:center;gap:8px' })
      const name = el('input', {
        style: `flex:1;min-width:0;border:1px solid #DDD;border-radius:3px;padding:5px 7px;font-size:13px;font-family:${T.font}`,
      })
      name.value = v.name
      const ratio = el('input', {
        style: 'width:56px;border:1px solid #DDD;border-radius:3px;padding:5px;font-size:13px;text-align:right',
      })
      ratio.type = 'number'
      ratio.min = '0'
      ratio.max = '100'
      ratio.value = String(v.distribution_ratio)
      line.append(name, ratio)

      const meta = el('div', {
        style: `display:flex;align-items:center;gap:8px;margin-top:8px`,
      })
      meta.append(el('span', { text: v.status, style: `font-size:11px;color:${T.sub};flex:1` }))
      const update = button('更新', 'ghost')
      update.style.padding = '4px 12px'
      update.style.fontSize = '12px'
      meta.append(update)
      row.append(line, meta)

      row.addEventListener('click', (e) => {
        if (e.target === name || e.target === ratio) return
        saveCurrent().then(() => loadVersion(v.uid))
      })
      update.addEventListener('click', async (e) => {
        e.stopPropagation()
        try {
          const r = await api.setRatio(v.uid, Number(ratio.value))
          await api.saveVersion(v.uid, { name: name.value })
          v.distribution_ratio = r.version.distribution_ratio
          v.name = name.value
          toast(r.distribution_warning ?? '更新しました', r.distribution_warning === null ? 'success' : 'error')
          renderVersionPanel()
        } catch (error) {
          toast((error as Error).message, 'error')
        }
      })
      body.append(row)
    }
    versionPanel.append(body)

    const foot = el('div', { style: 'padding:10px;border-top:1px solid #EEE' })
    const warn = el('div', {
      text: total === 100 ? '配信割合 合計 100%' : `配信割合の合計が${total}%です。100%になるよう調整してください。`,
      style: `font-size:11px;margin-bottom:8px;color:${total === 100 ? '#2FA84F' : '#D0021B'}`,
    })
    const addBtn = button('＋ Version追加', 'ghost')
    addBtn.style.width = '100%'
    addBtn.addEventListener('click', async () => {
      await saveCurrent()
      const { version } = await api.addVersion(state.articleUid)
      state.versions = [...state.versions, version]
      toast(`${version.name} を追加しました`)
      loadVersion(version.uid)
    })
    foot.append(warn, addBtn)
    versionPanel.append(foot)
  }

  async function saveCurrent(): Promise<void> {
    if (state.currentUid === '') return
    const html = quill.root.innerHTML
    await api.saveVersion(state.currentUid, { html })
    const v = state.versions.find((x) => x.uid === state.currentUid)
    if (v !== undefined) v.html = html
  }

  // ── 右レールのツール ──
  const tool = (label: string, title: string, onClick: () => void): HTMLElement => {
    const b = el('button', {
      text: label,
      style: `width:44px;height:44px;border:none;background:transparent;border-radius:6px;
        cursor:pointer;font-size:17px`,
    })
    b.title = title
    b.addEventListener('mouseenter', () => (b.style.background = T.neutral))
    b.addEventListener('mouseleave', () => (b.style.background = 'transparent'))
    b.addEventListener('click', onClick)
    return b
  }

  toolRail.append(
    tool('PC', 'PCプレビュー(620×486)', () => {
      state.preview = 'pc'
      applyPreviewSize()
    }),
    tool('SP', 'SPプレビュー(430×640)', () => {
      state.preview = 'sp'
      applyPreviewSize()
    }),
    tool('</>', 'コード編集', () => openCodeEditor(quill)),
    tool('↶', '元に戻す', () => quill.history.undo()),
    tool('↷', 'やり直す', () => quill.history.redo()),
    tool('🖼', '画像を追加', () => insertImage(quill)),
    tool('💾', '保存', async () => {
      await saveCurrent()
      toast('保存しました')
    }),
    tool('🚀', '公開', () => openPublishConfirm(state, () => renderVersionPanel())),
  )

  loadVersion(state.currentUid)

  // Ctrl+S で保存（実機にはないが、作業用の利便として明示的に足している）
  page.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      void saveCurrent().then(() => toast('保存しました'))
    }
  })
}

function topBar(title: string, adStatus: string, abTestUid: string): HTMLElement {
  const labels: Readonly<Record<string, string>> = {
    prepared: '準備中',
    delivered: '配信中',
    stopping: '停止中',
    finished: '終了',
  }
  const bar = el('div', {
    style: `height:64px;flex-shrink:0;background:${T.surface};border-bottom:1px solid #E5E5E5;
      display:flex;align-items:center;gap:12px;padding:0 16px`,
  })
  const back = button('‹ 戻る', 'ghost')
  back.addEventListener('click', () => {
    location.hash = '/folders'
  })
  bar.append(
    back,
    el('strong', { text: title, style: 'font-size:15px' }),
    el('span', {
      text: labels[adStatus] ?? adStatus,
      style: `font-size:11px;background:${T.neutral};padding:3px 10px;border-radius:10px;color:${T.sub}`,
    }),
    el('span', { text: abTestUid, style: `margin-left:auto;font-size:11px;color:${T.sub};font-family:monospace` }),
  )
  return bar
}

function leftRail(): HTMLElement {
  const rail = el('div', {
    style: `width:74px;flex-shrink:0;background:${T.surface};border-right:1px solid #E5E5E5;
      display:flex;flex-direction:column;align-items:center;padding-top:10px;gap:4px`,
  })
  const tabs = [
    { label: '基本情報', active: false },
    { label: 'Version', active: true },
    { label: 'ポップ\nアップ', active: false },
    { label: 'レポート', active: false },
  ]
  for (const tab of tabs) {
    const item = el('div', {
      text: tab.label,
      style: `width:60px;padding:10px 4px;text-align:center;font-size:10px;border-radius:6px;
        white-space:pre-line;cursor:pointer;${tab.active ? `background:#E8F4FF;color:${T.primary};font-weight:600` : `color:${T.sub}`}`,
    })
    if (!tab.active) {
      item.addEventListener('click', () => toast('このタブはまだ未実装です（Versionタブを先に作っています）', 'error'))
    }
    rail.append(item)
  }
  return rail
}

function openCodeEditor(quill: Quill): void {
  const area = el('textarea', {
    style: `width:100%;height:340px;font-family:monospace;font-size:12px;padding:10px;
      border:1px solid #DDD;border-radius:4px;box-sizing:border-box`,
  })
  area.value = quill.root.innerHTML
  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;display:flex;
      align-items:center;justify-content:center`,
  })
  const panel = el('div', {
    style: `background:#fff;border-radius:8px;padding:18px;width:720px;max-width:94vw;font-family:${T.font}`,
  })
  const head = el('div', { style: 'display:flex;align-items:center;margin-bottom:12px' })
  const close = button('閉じる', 'ghost')
  const apply = button('反映する')
  head.append(close, el('strong', { text: 'コード編集', style: 'flex:1;text-align:center' }), apply)
  panel.append(head, area)
  overlay.append(panel)
  document.body.append(overlay)
  close.addEventListener('click', () => overlay.remove())
  apply.addEventListener('click', () => {
    quill.root.innerHTML = area.value
    overlay.remove()
    toast('コードを反映しました')
  })
}

function insertImage(quill: Quill): void {
  const input = el('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file === undefined) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const range = quill.getSelection(true)
      quill.insertEmbed(range.index, 'image', String(reader.result))
      toast('画像を挿入しました（ローカル保持のみ）')
    })
    reader.readAsDataURL(file)
  })
  input.click()
}

function openPublishConfirm(state: EditorState, onDone: () => void): void {
  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;display:flex;
      align-items:center;justify-content:center;font-family:${T.font}`,
  })
  const panel = el('div', { style: 'background:#fff;border-radius:8px;padding:24px;width:420px' })
  const cancel = button('閉じる', 'ghost')
  const ok = button('公開する')
  panel.append(
    el('strong', { text: 'このVersionを公開しますか？', style: 'display:block;margin-bottom:10px' }),
    el('div', {
      text: '状態バッジが「準備中 → 公開中」に変わります。クローンなので実際には配信されません。',
      style: `font-size:12px;color:${T.sub};line-height:1.8;margin-bottom:18px`,
    }),
    el('div', { style: 'display:flex;gap:10px;justify-content:flex-end' }, [cancel, ok]),
  )
  overlay.append(panel)
  document.body.append(overlay)
  cancel.addEventListener('click', () => overlay.remove())
  ok.addEventListener('click', async () => {
    const { version } = await api.publish(state.currentUid)
    const v = state.versions.find((x) => x.uid === state.currentUid)
    if (v !== undefined) v.status = version.status
    overlay.remove()
    onDone()
    toast('公開しました（状態バッジが変わります）')
  })
}
