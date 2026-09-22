/**
 * 「型から作る」の8つの型（2026-09-22・本人の依頼。ノーコードでWidgetを作る③）。
 *
 * 入力欄を埋めるだけで、ボタン・カウントダウン・よくある質問・お客様の声・比較表・ご利用の流れ・
 * お悩みチェック・画像スライダーを作る。どの型も
 *  - 見本の中身のままでもLPに入れられる（画像が要る型は除く）
 *  - 入力に <script> や onerror を書かれても、文字として出るだけ
 *  - CSS はこのWidgetの中だけに効く（同じ型を2つ入れても色がまざらない）
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATES, templateById } from '../src/app/panels/nocode/templates/index.ts'
import type { ItemData, NocodeTemplate, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

/** 2026-09-22 12:00 JST */
const NOW = new Date(Date.UTC(2026, 8, 22, 3, 0))
const UID = 'nc-test0001'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>'

function tpl(id: string): NocodeTemplate {
  const t = templateById(id)
  if (t === undefined) throw new Error(`型がありません: ${id}`)
  return t
}

function withData(id: string, patch: Record<string, unknown>): { t: NocodeTemplate; data: TemplateData } {
  const t = tpl(id)
  return { t, data: { ...t.defaults(NOW), ...patch } as TemplateData }
}

/** 文字の入力（並びの中も）を全部 XSS の文字に */
function poisonText(t: NocodeTemplate, data: TemplateData): TemplateData {
  const next: Record<string, unknown> = { ...data }
  for (const field of t.fields) {
    if (field.kind === 'text' || field.kind === 'textarea' || field.kind === 'symbols') next[field.key] = XSS
    if (field.kind === 'url') next[field.key] = 'javascript:alert(3)'
    if (field.kind === 'list') {
      const list = (data[field.key] as readonly ItemData[] | undefined) ?? []
      next[field.key] = list.map((item) => {
        const poisoned: Record<string, unknown> = { ...item }
        for (const sub of field.fields) {
          if (sub.kind === 'text' || sub.kind === 'textarea' || sub.kind === 'symbols') poisoned[sub.key] = XSS
          if (sub.kind === 'url') poisoned[sub.key] = 'javascript:alert(4)'
          if (sub.kind === 'image') poisoned[sub.key] = PNG
        }
        return poisoned
      })
    }
  }
  return next as TemplateData
}

describe('8つの型がそろっている', () => {
  it('ボタン・カウントダウン・よくある質問・お客様の声・比較表・ご利用の流れ・お悩みチェック・画像スライダー', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['cta', 'countdown', 'faq', 'reviews', 'compare', 'steps', 'checklist', 'slider'])
  })
})

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('どの型でも（%s）', (_id, t) => {
  it('見本の中身で書き出せて、外側にこのWidgetだけのクラスと型の名前が付く', () => {
    const html = t.render(t.defaults(NOW), UID)
    expect(html).toMatch(new RegExp(`^<style>[\\s\\S]*</style><div class="nc nc-${t.id} ${UID}" data-nocode="${t.id}"`))
  })

  it('CSS はこのWidgetの中だけに効く（すべての指定の頭にこのWidgetのクラス）', () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(t.render(t.defaults(NOW), UID))?.[1] ?? ''
    const selectors = css
      .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '')
      .replace(/@media[^{]*\{/g, '')
      .split('}')
      .map((rule) => rule.split('{')[0]?.trim() ?? '')
      .filter((sel) => sel !== '')
    expect(selectors.length).toBeGreaterThan(0)
    for (const group of selectors) {
      for (const sel of group.split(',')) expect(sel.trim().startsWith(`.${UID}`), sel).toBe(true)
    }
  })

  it('入力に <script> や onerror を書かれても文字として出るだけ（リンクの javascript: は # になる）', () => {
    const html = t.render(poisonText(t, t.defaults(NOW)), UID)
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('javascript:')
    // タグに onclick などの属性が無い。引用符の中の値（エスケープ済みの「onerror=」は無害）と固定のスクリプトは見ない
    const tags = html.replace(/<(script|style)>[\s\S]*?<\/\1>/g, '').match(/<[a-z][^>]*>/gi) ?? []
    for (const tag of tags) expect(tag.replace(/"[^"]*"|'[^']*'/g, '""'), tag).not.toMatch(/\son[a-z]+\s*=/i)
  })

  it('スクリプトはJavaScriptとして読める（書き間違いでLPのほかの動きまで止めない）', () => {
    const html = t.render(t.defaults(NOW), UID)
    for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      // 文法の確かめだけ（実行はしない）
      expect(() => new Function(code ?? '')).not.toThrow()
    }
  })

  it('スクリプトは型ごとに決まった文だけ（入力の文字は入らない）', () => {
    const html = t.render(poisonText(t, t.defaults(NOW)), UID)
    for (const script of html.match(/<script>[\s\S]*?<\/script>/g) ?? []) {
      expect(script).not.toContain('alert')
      expect(script).not.toContain(UID)
    }
  })
})

describe('ボタン', () => {
  it('クリック数を数えるなら、今のリンク設定と同じ計測の目印を付ける', () => {
    const { t, data } = withData('cta', { url: 'https://shop.example.test/cart', track: true })
    expect(t.render(data, UID)).toContain('href="https://shop.example.test/cart?sb_tracking=true"')
  })

  it('選んだ色がボタンの地になり、濃い色の下の縁で押せるボタンに見せる', () => {
    const { t, data } = withData('cta', { color: '#1F7AE0' })
    const html = t.render(data, UID)
    expect(html).toContain('background:#1F7AE0')
    expect(html).toMatch(/box-shadow:0 6px 0 #[0-9A-F]{6}/)
  })

  it('「ときどき押し込む」は動きを減らす設定の人には止める', () => {
    const press = withData('cta', { motion: 'press' })
    const html = press.t.render(press.data, UID)
    expect(html).toContain('@keyframes')
    expect(html).toContain('prefers-reduced-motion:reduce')
    const none = withData('cta', { motion: 'none' })
    expect(none.t.render(none.data, UID)).not.toContain('@keyframes')
  })

  it('ボタンの文字が空なら入れられない', () => {
    const { t, data } = withData('cta', { label: '  ' })
    expect(t.validate(data, NOW)).toContain('ボタンの文字')
  })
})

describe('カウントダウン', () => {
  it('決まった日時で終わる: 日本時間の日時を書き、止まっていても締切の日時は読める', () => {
    const { t, data } = withData('countdown', { mode: 'fixed', deadline: '2026-09-30T23:59' })
    const html = t.render(data, UID)
    expect(html).toContain('data-nc-countdown="fixed"')
    expect(html).toContain('data-nc-deadline="2026-09-30T23:59:00+09:00"')
    expect(html).toContain('9月30日（水）23:59まで')
  })

  it('見た人ごと: 初めて見てからの時間を、このWidgetの名前で覚える', () => {
    const { t, data } = withData('countdown', { mode: 'evergreen', hours: 48 })
    const html = t.render(data, UID)
    expect(html).toContain('data-nc-countdown="evergreen"')
    expect(html).toContain('data-nc-hours="48"')
    expect(html).toContain(`data-nc-key="${UID}"`)
  })

  it('締切が過ぎている・日時が空なら入れられない', () => {
    const past = withData('countdown', { mode: 'fixed', deadline: '2026-09-01T10:00' })
    expect(past.t.validate(past.data, NOW)).toContain('過ぎ')
    const empty = withData('countdown', { mode: 'fixed', deadline: '' })
    expect(empty.t.validate(empty.data, NOW)).not.toBeNull()
  })

  it('動かす目印をHTMLに書き残さない（編集画面で動いた状態が保存されると、LPで動かなくなる）', () => {
    const { t, data } = withData('countdown', {})
    const script = /<script>([\s\S]*?)<\/script>/.exec(t.render(data, UID))?.[1] ?? ''
    expect(script).not.toMatch(/setAttribute\(\s*['"]data-nc-ready/)
    expect(script).toContain('.ql-editor')
  })
})

describe('よくある質問', () => {
  it('1問ずつ開け閉めできる（details）。答えの改行はそのまま', () => {
    const { t, data } = withData('faq', {
      items: [
        { q: '送料は？', a: '全国無料です。\n沖縄も無料です。' },
        { q: '解約は？', a: 'いつでも。' },
      ],
      openFirst: true,
    })
    const html = t.render(data, UID)
    expect(html.match(/<details class="nc-faq__item"/g)?.length).toBe(2)
    expect(html).toContain('<details class="nc-faq__item" open>')
    expect(html).toContain('全国無料です。<br>沖縄も無料です。')
  })
})

describe('お客様の声', () => {
  it('星の数は読み上げでも分かる。注意書きも出す', () => {
    const { t, data } = withData('reviews', {
      items: [{ image: '', name: '30代・女性', rating: '4', headline: '良い', body: '本文' }],
      note: '※個人の感想です',
    })
    const html = t.render(data, UID)
    expect(html).toContain('aria-label="5段階中4"')
    expect(html).toContain('★★★★☆')
    expect(html).toContain('※個人の感想です')
  })

  it('写真を選んだらその写真、無ければ人の形のアイコン', () => {
    const { t, data } = withData('reviews', {
      items: [
        { image: PNG, name: 'A', rating: '5', headline: 'h', body: 'b' },
        { image: '', name: 'B', rating: 'none', headline: 'h', body: 'b' },
      ],
    })
    const html = t.render(data, UID)
    expect(html).toContain(`src="${PNG}"`)
    expect(html).toContain('<svg')
    expect(html.match(/class="nc-rv__stars"/g)?.length).toBe(1)
  })
})

describe('比較表', () => {
  it('列は「自社＋比べる相手の数」。◎○△×は記号で出し、読み上げでは言葉にする', () => {
    const { t, data } = withData('compare', {
      ours: '当社',
      others: [{ name: 'A社' }],
      rows: [{ label: '料金', c0: '◎', c1: '×', c2: '', c3: '' }],
    })
    const html = t.render(data, UID)
    expect(html.match(/<th scope="col"/g)?.length).toBe(3)
    expect(html).toContain('とても良い')
    expect(html).toContain('なし')
    expect(html).toContain('nc-cmp__ours')
  })
})

describe('ご利用の流れ', () => {
  it('番号は 01・02… を別の文字にしておく（②の並べ替えで付け直せる）', () => {
    const { t, data } = withData('steps', {
      label: 'STEP',
      items: [
        { title: '申し込む', body: '', image: '' },
        { title: '届く', body: '', image: '' },
      ],
    })
    const html = t.render(data, UID)
    expect(html).toContain('<span class="nc-st__num">01</span>')
    expect(html).toContain('<span class="nc-st__num">02</span>')
    expect(html).toContain('<span class="nc-st__label">STEP</span>')
  })
})

describe('お悩みチェック', () => {
  it('1つずつチェックの印を付けて並べる', () => {
    const { t, data } = withData('checklist', { items: [{ text: '朝が弱い' }, { text: '時間がない' }, { text: '続かない' }] })
    expect(t.render(data, UID).match(/<li class="nc-ck__item"/g)?.length).toBe(3)
  })
})

describe('画像スライダー', () => {
  it('画像が1枚も無ければ入れられない', () => {
    const { t, data } = withData('slider', { items: [{ image: '', alt: '', caption: '', url: '' }] })
    expect(t.validate(data, NOW)).toContain('画像')
  })

  it('選んだ画像を並べ、自動で送る秒数を data 属性で渡す', () => {
    const { t, data } = withData('slider', {
      items: [
        { image: PNG, alt: '商品', caption: '', url: '' },
        { image: PNG, alt: '使い方', caption: '', url: '' },
      ],
      autoplay: '5',
    })
    const html = t.render(data, UID)
    expect(html.match(/<figure class="nc-sl__slide"/g)?.length).toBe(2)
    expect(html).toContain('data-nc-autoplay="5"')
    expect(html).toContain('alt="商品"')
  })
})
