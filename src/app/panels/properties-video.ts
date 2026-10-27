/**
 * 右パネルの「動画」プロパティ。
 *
 * キャンバスの動画をクリックすると、画像と同じようにここへ設定が出る。
 * 再生設定（ループ / 自動再生 / ミュート）・サイズ・複製に加えて、画像と同じこと
 * （プレビュー・代替テキスト・リンク設定・計測URL・アニメーション・削除）もできる
 * （2026-10-27 指示㉑ 本人「動画にもリンク入れたい」「画像でできること全部入れて」・共通の欄は properties-media-extras.ts）
 *
 * 保存は DOM から直列化される（editor.ts の `serializeQuillBody`）ので、
 * `<video>` の属性・スタイルを書き換えれば保存HTMLにそのまま入る。
 * 変更後は `quill.update()` で Quill にも知らせる（画像リンクと同じ手順）。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { convertImageToWebP, readFileAsDataUrl } from './webp-convert.ts'
import { group, row } from './properties-parts.ts'
import { applyVideoAlign, videoAlignOf } from './media-align.ts'
import { buildMediaAlignGroup, syncMediaAlign } from './properties-media-align.ts'
import { duplicateVideo, hasFlag, toggleFlag, willBlockAutoplay, type VideoFlag } from './video-controls.ts'
import { swapBodyVideoForImage } from './body-media-swap.ts'
import { buildMediaAnimGroup, buildMediaLinkGroup, buildMediaTrackingGroup } from './properties-media-extras.ts'
import { VIDEO_LABEL_ATTR } from './media-settings.ts'

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
    'margin-left:auto;min-width:56px;border-radius:5px;border:1px solid var(--sb-c-d5d5db, #D5D5DB);' +
    'background:var(--sb-c-ffffff, #FFFFFF);color:var(--sb-c-555555, #555555);font:inherit;font-size:11px;font-weight:600;' +
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
  /** 画像に差し替えたあと、右の欄を画像の設定にする */
  showImage: (img: HTMLImageElement) => void
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

  // ── プレビュー（画像と同じく小さく見せる。音なし・止めたまま） ──
  const previewGroup = group('プレビュー')
  const preview = document.createElement('video')
  preview.muted = true
  preview.setAttribute('muted', '')
  preview.setAttribute('playsinline', '')
  preview.setAttribute('preload', 'metadata')
  preview.style.cssText =
    'display:block;width:100%;max-height:140px;object-fit:contain;border:1px solid var(--sb-c-e5e5ea, #E5E5EA);' +
    'border-radius:4px;background:var(--sb-c-f5f6f8, #F5F6F8);pointer-events:none'
  previewGroup.append(preview)

  // ── ソース ──
  const srcRow = row('ソース')
  const srcField = document.createElement('div')
  srcField.style.cssText =
    'flex:1;font-size:10px;color:#999999;height:26px;line-height:26px;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--sb-c-e5e5ea, #E5E5EA);border-radius:4px;' +
    'padding:0 6px;background:var(--sb-c-f5f6f8, #F5F6F8)'
  srcRow.append(srcField)

  // ── 代替テキスト（画像の alt にあたる・aria-label） ──
  const altRow = row('alt')
  const altInput = document.createElement('input')
  altInput.className = 'sb-pr-input'
  altInput.placeholder = '代替テキスト'
  altInput.addEventListener('change', () => {
    const label = altInput.value.trim()
    withVideo((video) => {
      if (label === '') video.removeAttribute(VIDEO_LABEL_ATTR)
      else video.setAttribute(VIDEO_LABEL_ATTR, label)
    })
  })
  altRow.append(altInput)

  // ── サイズ ──
  const sizeGroup = group('サイズ')
  const sizeRow = row('幅')
  const wInput = document.createElement('input')
  wInput.type = 'number'
  wInput.min = '30'
  wInput.className = 'sb-pr-input'
  wInput.style.maxWidth = '90px'
  const wUnit = document.createElement('span')
  wUnit.style.cssText = 'font-size:10px;color:#999999;margin-left:4px'
  wUnit.textContent = 'px'
  const fitBtn = document.createElement('button')
  fitBtn.type = 'button'
  fitBtn.style.cssText =
    'margin-left:auto;border-radius:5px;border:1px solid var(--sb-c-d5d5db, #D5D5DB);background:var(--sb-c-ffffff, #FFFFFF);color:var(--sb-c-555555, #555555);' +
    'font:inherit;font-size:11px;padding:4px 10px;cursor:pointer'
  fitBtn.textContent = '幅いっぱい'
  fitBtn.title = '横幅を親要素いっぱい（100%）にします'
  sizeRow.append(wInput, wUnit, fitBtn)
  sizeGroup.append(sizeRow)

  /** 幅を px で決める */
  const applyWidth = (px: number): void => {
    const w = Math.max(30, Math.round(px))
    withVideo((video) => {
      // 渡された動画の見た目を変えるのがこの関数の責務
      video.style.width = `${w}px`
      video.style.height = 'auto'
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
      // 渡された動画の見た目を変えるのがこの関数の責務
      video.style.width = '100%'
      video.style.height = 'auto'
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

  // ── 配置（左・中央・右。動画自身を寄せる・2026-10-18 本人「動画や画像の位置も左右で選びたい」） ──
  const alignGroup = buildMediaAlignGroup((align) => withVideo((video) => applyVideoAlign(video, align)))

  // ── アニメーション・リンク設定・計測URL（画像と共通の欄） ──
  const extrasDeps = { current: (): HTMLElement | null => deps.getVideo(), apply: withVideo }
  const animSection = buildMediaAnimGroup(extrasDeps)
  const linkSection = buildMediaLinkGroup(extrasDeps)
  const linkNote = document.createElement('div')
  linkNote.style.cssText = 'font-size:10px;color:#999999;line-height:1.5'
  linkNote.textContent = 'リンクを付けた動画は、押すとリンク先へ移ります（再生ボタンは出しません）'
  linkSection.el.append(linkNote)
  const trackSection = buildMediaTrackingGroup(extrasDeps)

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
    'width:100%;border-radius:5px;border:1px solid var(--sb-c-d5d5db, #D5D5DB);background:var(--sb-c-ffffff, #FFFFFF);color:var(--sb-c-333333, #333333);' +
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
  swapBtn.textContent = '動画・画像に差し替える'
  swapBtn.title = '動画なら大きさや再生設定はそのままに中身だけを、画像ならこの場所を画像にします（位置と幅はそのまま）'
  swapBtn.addEventListener('click', () => {
    const video = deps.getVideo()
    if (video === null) return
    const picker = document.createElement('input')
    picker.type = 'file'
    // 動画でも画像でも（2026-10-27 本人「動画を入れられる所は画像も入ればいい」）
    picker.accept = 'video/*,image/*'
    picker.addEventListener('change', () => {
      const file = picker.files?.[0]
      if (file === undefined) return
      if (file.type.startsWith('image/')) {
        // 本文に入れる画像と同じく WebP にしてから（media-insert.ts）
        void convertImageToWebP(file).then((src) => {
          const target = deps.getVideo()
          const img = src === '' || target === null ? null : swapBodyVideoForImage(deps.quill, target, src)
          if (img === null) {
            toast('画像に差し替えられませんでした', 'error')
            return
          }
          deps.setVideo(null)
          deps.showImage(img)
          toast('画像に差し替えました')
        })
        return
      }
      if (!file.type.startsWith('video/')) {
        toast('動画か画像のファイルを選んでください', 'error')
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

  // 削除（画像の「画像を削除」と同じ）
  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.className = 'sb-pr-action danger'
  removeBtn.style.marginTop = '6px'
  removeBtn.textContent = '動画を削除'
  removeBtn.addEventListener('click', () => {
    const video = deps.getVideo()
    if (video === null) return
    // Quill の部品として消す（DOMを直接消すと Quill の中身とずれる）。Widget の中の動画は DOM で
    const blot = deps.quill.scroll.find(video)
    if (blot !== null) deps.quill.deleteText(deps.quill.getIndex(blot), 1, 'user')
    else video.remove()
    deps.setVideo(null)
    container.style.display = 'none'
  })

  // 指示: 差し替えを先、複製を後
  actionGroup.append(swapBtn, dupBtn, removeBtn)

  container.append(previewGroup, srcRow, altRow, sizeGroup, alignGroup, animSection.el, linkSection.el, trackSection.el, playGroup, actionGroup)

  container.sync = (video: HTMLVideoElement): void => {
    const src = video.getAttribute('src') ?? ''
    // data: URL は非常に長いので、頭だけ見せる（パネルを壊さない）
    srcField.textContent = src.startsWith('data:') ? `${src.slice(0, 40)}…（埋め込み）` : src
    srcField.title = srcField.textContent
    if (preview.getAttribute('src') !== src) preview.setAttribute('src', src)
    altInput.value = video.getAttribute(VIDEO_LABEL_ATTR) ?? ''
    for (const section of [animSection, linkSection, trackSection]) section.sync(video)
    const w = Math.round(video.getBoundingClientRect().width)
    wInput.value = w > 0 ? String(w) : ''
    loop.sync(hasFlag(video, 'loop'))
    auto.sync(hasFlag(video, 'autoplay'))
    mute.sync(hasFlag(video, 'muted'))
    syncMediaAlign(alignGroup, videoAlignOf(video))
  }
  return container
}
