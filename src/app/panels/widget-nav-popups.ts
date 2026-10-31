/**
 * Versionの編集画面の左の「設置済み」の「離脱ポップ▼」（指示41・2026-10-31 本人「ここに離脱ポップの項目も設けて
 * 確認できるようにしたい。Widget▼ 離脱ポップ▼ って感じで、それぞれプルダウンみたいな感じで開けるようにしたい」
 * → 本人の選択「3つとも（離脱防止・追従型・表示直後）」「押したら LP の上で確認」）。
 *
 * カード（見え方の小さな絵・名前・種類・配信ON/OFF）を押すと、新しいタブで、いま直している Version の LP の上に
 * そのポップを出す（配信OFFでも出る＝「LPの上で確認」と同じ・draftCheckUrl）。「編集」でポップアップの編集画面へ。
 * 見出し（navSection）は「Widget▼」と共通（widget-nav.ts）。
 */
import type { ExitPopup, FollowPopup } from '../api-popups.ts'
import { draftCheckUrl } from '../pages/popup-draft.ts'
import { drawPopupThumb } from '../pages/popup-content-card.ts'

export interface NavPopup {
  readonly uid: string
  readonly name: string
  readonly kind: 'exit' | 'instant' | 'follow'
  readonly enabled: boolean
  readonly html: string
  readonly css: string
  /** 絵に描くときの幅（離脱防止・表示直後＝箱 500px／追従型の帯＝620px／角＝360px） */
  readonly width: number
}

const KIND_LABEL: Readonly<Record<NavPopup['kind'], string>> = { exit: '離脱防止', instant: '表示直後', follow: '追従型' }
const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif'

/** 並べるポップアップ（離脱防止・表示直後・追従型の順） */
export function navPopupsOf(exitPopups: readonly ExitPopup[], followPopups: readonly FollowPopup[]): NavPopup[] {
  const exits = exitPopups.map((p): NavPopup => ({
    uid: p.uid,
    name: p.name,
    kind: p.popup_kind === 'instant' ? 'instant' : 'exit',
    enabled: p.enabled,
    html: p.html,
    css: '',
    width: 500,
  }))
  const follows = followPopups.map((p): NavPopup => ({
    uid: p.uid,
    name: p.name,
    kind: 'follow',
    enabled: p.enabled,
    html: p.html,
    css: p.css,
    width: p.position === 'bottom-right' || p.position === 'bottom-left' ? 360 : 620,
  }))
  return [...exits.filter((p) => p.kind === 'exit'), ...exits.filter((p) => p.kind === 'instant'), ...follows]
}

/** ポップアップの画面を、そのポップを開いた状態で開くアドレス（exit-popup.ts の ?open=） */
export function popupEditHash(abTestUid: string, popupUid: string): string {
  return `#/ab_tests/${encodeURIComponent(abTestUid)}/articles/exit_popups?open=${encodeURIComponent(popupUid)}`
}

/** 開け閉めの見出し（「Widget（2）▼」「離脱ポップ（1）▼」）。押すと onToggle */
export function navSection(label: string, count: number, open: boolean, onToggle: () => void): { el: HTMLElement; body: HTMLElement } {
  const el = document.createElement('div')
  el.dataset['navSection'] = label
  el.style.cssText = 'display:flex;flex-direction:column;gap:6px'
  const header = document.createElement('button')
  header.type = 'button'
  header.setAttribute('aria-expanded', String(open))
  header.style.cssText =
    `display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;padding:4px 12px;border:0;` +
    `background:transparent;color:#555;font:600 11px/1.4 ${FONT};cursor:pointer;text-align:left`
  const text = document.createElement('span')
  text.textContent = `${label}（${String(count)}）`
  const mark = document.createElement('span')
  mark.textContent = open ? '▼' : '▶'
  mark.setAttribute('aria-hidden', 'true')
  mark.style.cssText = 'font-size:9px;color:#999'
  header.append(text, mark)
  header.addEventListener('click', onToggle)
  const body = document.createElement('div')
  // 閉じるときは display で消す（style の display:flex は hidden 属性より強く、hidden だけでは見えたままだった）
  body.style.cssText = `display:${open ? 'flex' : 'none'};flex-direction:column;gap:8px`
  body.hidden = !open
  el.append(header, body)
  return { el, body }
}

export interface PopupCardsDeps {
  /** いま直している Version（確認する LP） */
  readonly versionUid: () => string
  /** 押したとき（確認のアドレス・新しいタブで開く） */
  readonly onCheck: (url: string) => void
  /** 「編集」を押したとき */
  readonly onEdit: (popupUid: string) => void
}

/** ポップアップのカードの並び */
export function popupCards(popups: readonly NavPopup[], deps: PopupCardsDeps): HTMLElement {
  const list = document.createElement('div')
  list.style.cssText = 'display:flex;flex-direction:column;gap:8px'
  if (popups.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = 'このページのポップアップはまだありません'
    empty.style.cssText = `margin:0;padding:0 12px;color:#999;font:11px/1.6 ${FONT}`
    list.append(empty)
    return list
  }
  for (const popup of popups) list.append(popupCard(popup, deps))
  return list
}

function popupCard(popup: NavPopup, deps: PopupCardsDeps): HTMLElement {
  const card = document.createElement('div')
  card.dataset['navPopup'] = popup.uid
  card.title = 'LP の上で確認する（新しいタブ・配信OFFでも出ます）'
  card.style.cssText =
    'display:flex;flex-direction:column;gap:4px;padding:4px 12px;cursor:pointer;border-radius:4px;box-sizing:border-box;max-width:100%'
  card.addEventListener('mouseenter', () => { card.style.background = '#f5f5f5' })
  card.addEventListener('mouseleave', () => { card.style.background = 'transparent' })

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;align-items:center;gap:6px'
  const name = document.createElement('span')
  name.textContent = popup.name
  name.title = popup.name
  name.style.cssText = `color:var(--sb-accent, #0091FF);font:10px/1.4 ${FONT};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0`
  const edit = document.createElement('button')
  edit.type = 'button'
  edit.dataset['navPopupEdit'] = 'true'
  edit.textContent = '編集'
  edit.title = 'ポップアップの編集画面で直す'
  edit.style.cssText =
    `margin-left:auto;flex-shrink:0;padding:2px 8px;border:1px solid #d5d5d5;border-radius:4px;background:#fff;color:#555;font:600 10px/1.4 ${FONT};cursor:pointer`
  edit.addEventListener('click', (event) => {
    // カードを押したとき（確認）にしない
    event.stopPropagation()
    deps.onEdit(popup.uid)
  })
  row.append(name, edit)

  const meta = document.createElement('span')
  meta.textContent = `${KIND_LABEL[popup.kind]}・${popup.enabled ? '配信ON' : '配信OFF'}`
  meta.style.cssText = `color:${popup.enabled ? '#4B5563' : '#9AA0A6'};font:10px/1.4 ${FONT}`

  const thumb = document.createElement('div')
  thumb.style.cssText = 'width:196px;max-width:100%;height:64px;background:#f7f7f8;border:1px solid #eaeaea;border-radius:4px;overflow:hidden;box-sizing:border-box'
  drawPopupThumb(thumb, { html: popup.html, css: popup.css }, popup.width)

  card.append(row, meta, thumb)
  card.addEventListener('click', () => deps.onCheck(draftCheckUrl(deps.versionUid(), popup.uid)))
  return card
}
