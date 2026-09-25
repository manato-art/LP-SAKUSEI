/**
 * 流入元（utm_source）に、そのサービスの色の付いたロゴの形を添える（2026-09-25・本人「アプリアイコンにすることで、
 * もっと視覚的にわかりやすくならないかな」→「各サービスの色がついたロゴの形にしてほしい」）。
 *
 * utm_source は広告を出す人が自由に書くので、よく使う書き方（fb・facebook・fb_story…）を名前で見分ける。
 * 知らない名前には付けない（文字だけ）。キャンペーンなど他の種類には付けない。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { sourceKindOf } from '../src/app/pages/source-icons.ts'
import type { ReportVersionRow } from '../src/app/api.ts'

describe('流入元の名前からサービスを見分ける', () => {
  it.each([
    ['fb', 'facebook'],
    ['Facebook', 'facebook'],
    ['fb_story', 'facebook'],
    ['meta', 'facebook'],
    ['ig', 'instagram'],
    ['Instagram', 'instagram'],
    ['google', 'google'],
    ['gdn', 'google'],
    ['youtube', 'youtube'],
    ['yt', 'youtube'],
    ['yahoo', 'yahoo'],
    ['yda', 'yahoo'],
    ['line', 'line'],
    ['LINE_ads', 'line'],
    ['tiktok', 'tiktok'],
    ['twitter', 'x'],
    ['x', 'x'],
  ])('%s → %s', (value, kind) => {
    expect(sourceKindOf(value)).toBe(kind)
  })

  it.each(['newsletter', 'xyz', 'mail', ''])('知らない名前（%s）は見分けない', (value) => {
    expect(sourceKindOf(value)).toBeNull()
  })
})

describe('一覧の流入元にアイコンが付く', () => {
  beforeAll(() => {
    installDom()
  })

  it('知っている流入元だけにアイコン、キャンペーンには付けない', async () => {
    const { renderVersionItems } = await import('../src/app/pages/heatmap-version-list.ts')
    const ul = document.createElement('ul')
    renderVersionItems(ul, [{ entity_uid: 'V1', name: 'A', pv: 10 } as unknown as ReportVersionRow], {
      selection: new Set(),
      onToggle: () => undefined,
      registerMetric: () => undefined,
      params: {
        parameters: [
          { version_uid: 'V1', param: 'utm_source=fb', pv: 5 },
          { version_uid: 'V1', param: 'utm_source=newsletter', pv: 3 },
          { version_uid: 'V1', param: 'utm_campaign=google', pv: 2 },
        ],
        selected: new Set(),
        onToggle: () => undefined,
        register: () => undefined,
      },
    })
    const chips = [...ul.querySelectorAll('.hm-vl-chip')]
    const iconOf = (text: string) =>
      chips.find((c) => c.querySelector('.hm-vl-chip-value')?.textContent === text)?.querySelector('.hm-vl-src-icon')
    expect(iconOf('fb')?.getAttribute('data-source')).toBe('facebook')
    expect(iconOf('fb')?.querySelector('svg')).not.toBeNull()
    expect(iconOf('newsletter')).toBeNull()
    // キャンペーン名が google でも、流入元ではないのでアイコンは付けない
    expect(iconOf('google')).toBeNull()
  })
})

describe('Instagram のグラデーション', () => {
  beforeAll(() => {
    installDom()
  })

  it('アイコンごとに別の名前（id）にする（最初の1つが隠れても、ほかの色が消えない）', async () => {
    const { sourceIconFor } = await import('../src/app/pages/source-icons.ts')
    const a = sourceIconFor('ig')!
    const b = sourceIconFor('instagram')!
    const idOf = (el: HTMLElement) => /id="([^"]+)"/.exec(el.innerHTML)?.[1]
    const refOf = (el: HTMLElement) => /url\(#([^)]+)\)/.exec(el.innerHTML)?.[1]
    expect(idOf(a)).not.toBe(idOf(b))
    expect(refOf(a)).toBe(idOf(a))
    expect(refOf(b)).toBe(idOf(b))
  })
})
