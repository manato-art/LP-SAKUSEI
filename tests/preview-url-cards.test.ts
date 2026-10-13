/**
 * プレビュー画面の上にある2枚のURLカード（プレビューURL / 配信URL）。
 *
 * 【起きていたこと】配信URLのカードだけ、どのページでも
 * 「ドメインを設定すると使えるようになります」と出て、コピーと開くのボタンも押せなかった。
 * 同じページの配信URLは、編集画面・基本情報・ページ一覧ではちゃんと出ている。
 *
 * 【原因】この表示は、フォルダごとのドメインを決める機能が無かった頃に入れたもの（指示111）。
 * あとでドメインの機能ができ、ほかの画面は `deliveryUrlFor` で本当のURLを出すようになったが、
 * この画面だけ決め打ちの文のまま残っていた。
 *
 * ほかの画面と同じにする（2026-10-13 本人が選んだ）:
 * フォルダにドメインがあれば配信URLを出して使えるようにし、無いときだけ、ほかの画面と同じ案内を出す。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { DELIVERY_DOMAIN_UNSET_NOTE } from '../src/app/pages/basic-info-form.ts'
import { wireUrlCards } from '../src/app/pages/preview-url-cards.ts'

const FRAGMENT = readFileSync(
  'src/app/fragments/ab_tests__UID__articles__UID__previews__default.html',
  'utf8',
)
const PREVIEW_URL = 'http://localhost:5180/preview/VERSION_0001'
const DELIVERY_URL = 'http://localhost:5180/lp/AB_0001'
const OLD_FIXED_TEXT = 'ドメインを設定すると使えるようになります'

interface Cards {
  root: HTMLElement
  preview: HTMLElement
  delivery: HTMLElement
}

/** 採取した土台を置いて、2枚のカード（URLの <p> の親）を取り出す */
function mount(): Cards {
  const document = installDom()
  document.body.innerHTML = FRAGMENT
  const urls = [...document.body.querySelectorAll<HTMLElement>('p')].filter((p) =>
    /^https?:\/\//.test((p.textContent ?? '').trim()),
  )
  const preview = urls[0]?.parentElement ?? null
  const delivery = urls[1]?.parentElement ?? null
  if (preview === null || delivery === null) throw new Error('土台にURLカードが2枚ありません')
  return { root: document.body, preview, delivery }
}

const urlText = (card: HTMLElement): string => card.querySelector('p')?.textContent ?? ''
const controls = (card: HTMLElement): HTMLElement[] => [...card.querySelectorAll<HTMLElement>('button, a')]
const styleOf = (el: Element | null): string => el?.getAttribute('style') ?? ''
/** 押せない（隠してある） */
const isOff = (el: HTMLElement): boolean => /display:\s*none/.test(styleOf(el))

describe('プレビュー画面のURLカード', () => {
  let cards: Cards
  beforeEach(() => {
    cards = mount()
  })

  it('フォルダにドメインがあれば、配信URLを出す（決め打ちの「使えるようになります」は出さない）', () => {
    wireUrlCards(cards.root, { previewUrl: PREVIEW_URL, deliveryUrl: DELIVERY_URL })

    expect(urlText(cards.delivery)).toBe(DELIVERY_URL)
    expect(cards.root.textContent).not.toContain(OLD_FIXED_TEXT)
  })

  it('配信URLがあるときは、コピーと開くが使える（開く先は配信URL）', () => {
    wireUrlCards(cards.root, { previewUrl: PREVIEW_URL, deliveryUrl: DELIVERY_URL })

    expect(controls(cards.delivery).length).toBeGreaterThan(0)
    expect(controls(cards.delivery).filter(isOff)).toEqual([])
    expect(cards.delivery.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe(DELIVERY_URL)
  })

  it('フォルダにドメインが無いときは、ほかの画面と同じ案内を出し、押せるものは出さない', () => {
    wireUrlCards(cards.root, { previewUrl: PREVIEW_URL, deliveryUrl: null })

    expect(urlText(cards.delivery)).toBe(DELIVERY_DOMAIN_UNSET_NOTE)
    expect(cards.root.textContent).not.toContain(OLD_FIXED_TEXT)
    expect(controls(cards.delivery).every(isOff)).toBe(true)
  })

  /**
   * URLの枠は採取CSSで「1行・幅200pxまで・はみ出しは…」。案内は47文字あるので、そのままだと
   * 「フォルダにドメインが設定さ…」で切れて、どこで設定するのかが読めなかった（ブラウザで実測）。
   */
  it('案内は途中で切らずに、折り返して全部見せる', () => {
    wireUrlCards(cards.root, { previewUrl: PREVIEW_URL, deliveryUrl: null })

    const style = styleOf(cards.delivery.querySelector('p'))
    expect(style).toMatch(/white-space:\s*normal/)
    expect(style).toMatch(/max-width:\s*none/)
    // 狭い画面でも、1文字幅の縦長にならない（下限が無いと 12px 幅・773px の高さになった）
    expect(style).toMatch(/min-width:\s*300px/)
  })

  it('プレビューURLのカードは今までどおり（URLと「※計測されません」・開く先はプレビュー）', () => {
    wireUrlCards(cards.root, { previewUrl: PREVIEW_URL, deliveryUrl: DELIVERY_URL })

    expect(urlText(cards.preview)).toBe(PREVIEW_URL)
    expect(cards.preview.textContent).toContain('※計測されません')
    expect(cards.preview.textContent).toContain('プレビューURL')
    expect(cards.preview.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe(PREVIEW_URL)
    expect(controls(cards.preview).filter(isOff)).toEqual([])
  })

  it('採取したときの見本のURL（example.test）は、どのリンクにも残さない', () => {
    wireUrlCards(cards.root, { previewUrl: PREVIEW_URL, deliveryUrl: DELIVERY_URL })

    expect([...cards.root.querySelectorAll('a[href*="example.test"]')]).toEqual([])
  })
})
