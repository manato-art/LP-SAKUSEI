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

/**
 * ON/OFF のスイッチ1つ。
 *
 * 表示は**押した結果の返り値ではなく、必ずDOMの実体**から塗り直す。
 * 返り値で塗ると、`quill.update()` の再構築で属性が戻ったときに
 * 表示だけOFFのまま実体はONになり、次に押しても見た目が変わらず
 * 「一度OFFにすると押せない」ように見える（実際にそう報告された）。
 */
function switchRow(
  label: string,
  hint: string,
  onToggle: () => void,
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
    btn.style.background = on ? 'var(--sb-accent, #0091FF)' : '#fff'
    btn.style.borderColor = on ? 'var(--sb-accent, #0091FF)' : '#d5d5db'
    btn.style.color = on ? '#fff' : '#555'
  }
  btn.addEventListener('click', onToggle)
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

  /**
   * 動画をひとつ操作する共通の段取り。
   *
   * `quill.update()` は取り込みのときに要素を作り直すことがある。作り直されると
   * こちらが持っている参照は DOM から外れた古いノードになり、以後どのボタンを
   * 押しても画面上の動画は変わらない（＝押せないように見える）。
   * そこで、操作の前に**何番目の動画か**を覚えておき、更新後に同じ位置の
   * 実体を選び直してから表示を塗り直す。
   */
  const withVideo = (change: (video: HTMLVideoElement) => void): void => {
    const video = deps.getVideo()
    if (video === null) return
    const videosBefore = [...deps.quill.root.querySelectorAll('video')]
    const at = videosBefore.indexOf(video)

    change(video)
    deps.quill.update()

    let current: HTMLVideoElement = video
    if (!current.isConnected && at >= 0) {
      const again = deps.quill.root.querySelectorAll('video')[at]
      if (again instanceof HTMLVideoElement) current = again
    }
    deps.setVideo(current)
    container.sync?.(current)
  }

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
    const w = Math.max(30, Math.round(px))
    withVideo((video) => {
      /* eslint-disable no-param-reassign -- 渡された動画の見た目を変えるのがこの関数の責務 */
      video.style.width = `${w}px`
      video.style.height = 'auto'
      /* eslint-enable no-param-reassign */
      video.setAttribute('width', String(w))
      video.removeAttribute('height')
    })
  }
  /**
   * 「幅いっぱい」＝横幅を親要素いっぱい（100%）にする。
   * 幅指定を消すだけだと動画そのものの大きさに戻るだけで、
   * 押しても何も起きないように見える（実際にそう報告された）。
   */
  const applyFullWidth = (): void => {
    withVideo((video) => {
      /* eslint-disable no-param-reassign -- 渡された動画の見た目を変えるのがこの関数の責務 */
      video.style.width = '100%'
      video.style.height = 'auto'
      /* eslint-enable no-param-reassign */
      video.removeAttribute('width')
      video.removeAttribute('height')
    })
    toast('横幅を親要素いっぱいにしました')
  }
  wInput.addEventListener('change', () => {
    const n = Number(wInput.value)
    if (Number.isFinite(n) && n > 0) applyWidth(n)
  })
  fitBtn.addEventListener('click', applyFullWidth)

  // ── 再生設定 ──
  const playGroup = group('再生設定')
  const flip = (flag: VideoFlag): void => {
    let blocked = false
    withVideo((video) => {
      toggleFlag(video, flag)
      // 音ありの自動再生はブラウザが止める。黙って効かないままにしない。
      blocked = willBlockAutoplay(video)
    })
    if (blocked) {
      toast('音ありの自動再生はブラウザに止められます。ミュートを戻すか自動再生を切ってください', 'error')
    }
  }
  const loop = switchRow('ループ再生', '最後まで再生したら先頭から繰り返します', () => {
    flip('loop')
  })
  const auto = switchRow('自動再生', '表示されたら自動で再生します', () => {
    flip('autoplay')
  })
  const mute = switchRow('ミュート', '音を出しません。自動再生と併用する場合は必要です', () => {
    flip('muted')
  })
  playGroup.append(loop.el, auto.el, mute.el)

  // ── 操作（差し替え → 複製の順） ──
  const actionGroup = group('操作')
  const ACTION_BTN_CSS =
    'width:100%;border-radius:5px;border:1px solid #d5d5db;background:#fff;color:#333;' +
    'font:inherit;font-size:12px;padding:7px 10px;cursor:pointer'
  const dupBtn = document.createElement('button')
  dupBtn.type = 'button'
  dupBtn.style.cssText = `${ACTION_BTN_CSS};margin-top:6px`
  dupBtn.textContent = 'この動画を複製する'
  dupBtn.title = 'すぐ下に同じ設定の動画をもう1つ置きます'
  dupBtn.addEventListener('click', () => {
    const video = deps.getVideo()
    if (video === null) return
    const copy = duplicateVideo(video)
    deps.quill.update()
    // 複製したものを選択に移す（続けて設定を触れるように）
    deps.setVideo(copy.isConnected ? copy : video)
    container.sync?.(copy.isConnected ? copy : video)
    toast('動画を複製しました')
  })
  const swapBtn = document.createElement('button')
  swapBtn.type = 'button'
  swapBtn.style.cssText = ACTION_BTN_CSS
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
        withVideo((target) => {
          target.setAttribute('src', url)
          // eslint-disable-next-line no-param-reassign -- 中身の差し替えがこの関数の責務
          target.src = url
          target.load()
        })
        toast('動画を差し替えました')
      })
    })
    picker.click()
  })

  // 指示: 差し替えを先、複製を後
  actionGroup.append(swapBtn, dupBtn)

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
