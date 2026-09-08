/**
 * 右パネルの「動画」プロパティ。
 *
 * キャンバスの動画をクリックすると、画像と同じようにここへ設定が出る。
 * 出すのは動画そのものが持っている機能だけ:
 *   再生設定（ループ / 自動再生 / ミュート）・サイズ・複製
 *
 * 保存は DOM から直列化される（editor.ts の `serializeQuillBody`）ので、
 * `<video>` の属性・スタイルを書き換えれば保存HTMLにそのまま入る。
 * 変更後は `quill.update()` で Quill にも知らせる（画像リンクと同じ手順）。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { readFileAsDataUrl } from './webp-convert.ts'
import { group, row } from './properties-panel.ts'
import { duplicateVideo, hasFlag, toggleFlag, willBlockAutoplay, type VideoFlag } from './video-controls.ts'

/** ON/OFF のスイッチ1つ */
function switchRow(
  label: string,
  hint: string,
  onToggle: () => boolean,
): { el: HTMLElement; sync: (on: boolean) => void } {
  const r = row(label)
  r.title = hint
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText =
    'margin-left:auto;min-width:56px;border-radius:5px;border:1px solid #d5d5db;' +
    'background:#fff;color:#555;font:inherit;font-size:11px;font-weight:600;' +
    'padding:4px 10px;cursor:pointer'
  const sync = (on: boolean): void => {
    btn.textContent = on ? 'ON' : 'OFF'
    btn.style.background = on ? '#0091ff' : '#fff'
    btn.style.borderColor = on ? '#0091ff' : '#d5d5db'
    btn.style.color = on ? '#fff' : '#555'
  }
  btn.addEventListener('click', () => sync(onToggle()))
  r.append(btn)
  return { el: r, sync }
}

export interface VideoBodyDeps {
  quill: Quill
  getVideo: () => HTMLVideoElement | null
  /** 複製したあとに選択を移すため */
  setVideo: (video: HTMLVideoElement | null) => void
}

interface VideoBody extends HTMLElement {
  /** 選択中の動画に表示を合わせる */
  sync?: (video: HTMLVideoElement) => void
}

export function buildVideoBody(deps: VideoBodyDeps): VideoBody {
  const container: VideoBody = document.createElement('div')
  container.className = 'sb-props-body'
  container.style.display = 'none'
  container.setAttribute('data-video-body', 'true')

  // ── ソース ──
  const srcRow = row('ソース')
  const srcField = document.createElement('div')
  srcField.style.cssText =
    'flex:1;font-size:10px;color:#999;height:26px;line-height:26px;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;border:1px solid #e5e5ea;border-radius:4px;' +
    'padding:0 6px;background:#f5f6f8'
  srcRow.append(srcField)

  // ── サイズ ──
  const sizeGroup = group('サイズ')
  const sizeRow = row('幅')
  const wInput = document.createElement('input')
  wInput.type = 'number'
  wInput.min = '30'
  wInput.className = 'sb-pr-input'
  wInput.style.maxWidth = '90px'
  const wUnit = document.createElement('span')
  wUnit.style.cssText = 'font-size:10px;color:#999;margin-left:4px'
  wUnit.textContent = 'px'
  const fitBtn = document.createElement('button')
  fitBtn.type = 'button'
  fitBtn.style.cssText =
    'margin-left:auto;border-radius:5px;border:1px solid #d5d5db;background:#fff;color:#555;' +
    'font:inherit;font-size:11px;padding:4px 10px;cursor:pointer'
  fitBtn.textContent = '幅いっぱい'
  fitBtn.title = '横幅を親要素いっぱい（100%）にします'
  sizeRow.append(wInput, wUnit, fitBtn)
  sizeGroup.append(sizeRow)

  /** 幅を px で決める */
  const applyWidth = (px: number): void => {
    const video = deps.getVideo()
    if (video === null) return
    const w = Math.max(30, Math.round(px))
    video.style.width = `${w}px`
    video.style.height = 'auto'
    video.setAttribute('width', String(w))
    video.removeAttribute('height')
    wInput.value = String(w)
    deps.quill.update()
  }
  /**
   * 「幅いっぱい」＝横幅を親要素いっぱい（100%）にする。
   * 幅指定を消すだけだと動画そのものの大きさに戻るだけで、
   * 押しても何も起きないように見える（実際にそう報告された）。
   */
  const applyFullWidth = (): void => {
    const video = deps.getVideo()
    if (video === null) return
    video.style.width = '100%'
    video.style.height = 'auto'
    video.removeAttribute('width')
    video.removeAttribute('height')
    deps.quill.update()
    // 100% が何pxになったかを入力欄に映す
    wInput.value = String(Math.round(video.getBoundingClientRect().width))
    toast('横幅を親要素いっぱいにしました')
  }
  wInput.addEventListener('change', () => {
    const n = Number(wInput.value)
    if (Number.isFinite(n) && n > 0) applyWidth(n)
  })
  fitBtn.addEventListener('click', applyFullWidth)

  // ── 再生設定 ──
  const playGroup = group('再生設定')
  const flip = (flag: VideoFlag): boolean => {
    const video = deps.getVideo()
    if (video === null) return false
    const next = toggleFlag(video, flag)
    // 音ありの自動再生はブラウザが止める。黙って効かないままにしない。
    if (willBlockAutoplay(video)) {
      toast('音ありの自動再生はブラウザに止められます。ミュートを戻すか自動再生を切ってください', 'error')
    }
    deps.quill.update()
    return next
  }
  const loop = switchRow('ループ再生', '最後まで再生したら先頭から繰り返します', () => flip('loop'))
  const auto = switchRow('自動再生', '表示されたら自動で再生します', () => flip('autoplay'))
  const mute = switchRow('ミュート', '音を出しません。自動再生と併用する場合は必要です', () =>
    flip('muted'),
  )
  playGroup.append(loop.el, auto.el, mute.el)

  // ── 複製 ──
  const actionGroup = group('操作')
  const dupBtn = document.createElement('button')
  dupBtn.type = 'button'
  dupBtn.style.cssText =
    'width:100%;border-radius:5px;border:1px solid #d5d5db;background:#fff;color:#333;' +
    'font:inherit;font-size:12px;padding:7px 10px;cursor:pointer'
  dupBtn.textContent = 'この動画を複製する'
  dupBtn.title = 'すぐ下に同じ設定の動画をもう1つ置きます'
  dupBtn.addEventListener('click', () => {
    const video = deps.getVideo()
    if (video === null) return
    const copy = duplicateVideo(video)
    deps.quill.update()
    deps.setVideo(copy)
    container.sync?.(copy)
    toast('動画を複製しました')
  })
  const swapBtn = document.createElement('button')
  swapBtn.type = 'button'
  swapBtn.style.cssText = dupBtn.style.cssText + ';margin-top:6px'
  swapBtn.textContent = '動画を差し替える'
  swapBtn.title = '大きさや再生設定はそのままに、中身の動画だけを入れ替えます'
  swapBtn.addEventListener('click', () => {
    const video = deps.getVideo()
    if (video === null) return
    const picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = 'video/*'
    picker.addEventListener('change', () => {
      const file = picker.files?.[0]
      if (file === undefined) return
      if (!file.type.startsWith('video/')) {
        toast('動画ファイルを選んでください', 'error')
        return
      }
      void readFileAsDataUrl(file).then((url) => {
        if (url === '') {
          toast('動画を読み込めませんでした', 'error')
          return
        }
        // 差し替えるのは中身だけ。大きさと再生設定は今のまま残す。
        video.setAttribute('src', url)
        video.src = url
        video.load()
        deps.quill.update()
        container.sync?.(video)
        toast('動画を差し替えました')
      })
    })
    picker.click()
  })

  actionGroup.append(dupBtn, swapBtn)

  container.append(srcRow, sizeGroup, playGroup, actionGroup)

  container.sync = (video: HTMLVideoElement): void => {
    const src = video.getAttribute('src') ?? ''
    // data: URL は非常に長いので、頭だけ見せる（パネルを壊さない）
    srcField.textContent = src.startsWith('data:') ? `${src.slice(0, 40)}…（埋め込み）` : src
    srcField.title = srcField.textContent
    const w = Math.round(video.getBoundingClientRect().width)
    wInput.value = w > 0 ? String(w) : ''
    loop.sync(hasFlag(video, 'loop'))
    auto.sync(hasFlag(video, 'autoplay'))
    mute.sync(hasFlag(video, 'muted'))
  }
  return container
}
