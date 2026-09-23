/**
 * 「型から作る」の書き出しの土台（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 入力欄に書いた文字・リンク・色・画像を、LPに入れても安全なHTMLにする。
 *  - 文字はすべてエスケープする（<script> などを書かれても文字として出る）
 *  - リンクは使えるもの（http・https・mailto・tel・ページ内の#）だけ。javascript: などは # にする
 *  - 「クリック数をレポートで数える」は、今のリンク設定と同じ計測の目印（sb_tracking）を付ける
 *  - 色は #RRGGBB だけ。画像は選んだファイル（data:image/…）だけ
 */
import { describe, expect, it } from 'vitest'
import { esc, inkOn, linkAttrs, newUid, rekeyUid, safeColor, safeImage, safeVideo, shade, textHtml } from '../src/app/panels/nocode/templates/kit.ts'

describe('文字', () => {
  it('HTMLとして読まれる文字をすべてエスケープする', () => {
    expect(esc(`<img src=x onerror="alert(1)">'&`)).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;')
  })

  it('改行は <br> にする（エスケープしたあとで）', () => {
    expect(textHtml('1行目\n<b>2行目</b>')).toBe('1行目<br>&lt;b&gt;2行目&lt;/b&gt;')
  })
})

describe('リンク', () => {
  it('https のリンクに、計測の目印を付ける／付けない', () => {
    expect(linkAttrs('https://shop.example.test/cart', { track: true, newTab: false })).toBe(
      ' href="https://shop.example.test/cart?sb_tracking=true"',
    )
    expect(linkAttrs(' https://shop.example.test/cart ', { track: false, newTab: false })).toBe(' href="https://shop.example.test/cart"')
  })

  it('新しいタブで開くときは noopener を付ける', () => {
    expect(linkAttrs('https://a.example.test/', { track: false, newTab: true })).toBe(
      ' href="https://a.example.test/" target="_blank" rel="noopener"',
    )
  })

  it('電話のリンクは、計測を属性で表す（今のリンク設定と同じ）', () => {
    expect(linkAttrs('tel:0120000000', { track: true, newTab: false })).toBe(' href="tel:0120000000" data-sb-tracking="true"')
  })

  it('ページ内の移動（#）には計測の目印を付けない（付けるとページが読み込み直される）', () => {
    expect(linkAttrs('#order', { track: true, newTab: false })).toBe(' href="#order"')
  })

  it('空・javascript: ・data: は # にする', () => {
    expect(linkAttrs('', { track: true, newTab: false })).toBe(' href="#"')
    expect(linkAttrs('javascript:alert(1)', { track: true, newTab: false })).toBe(' href="#"')
    expect(linkAttrs('data:text/html,<b>x</b>', { track: false, newTab: false })).toBe(' href="#"')
  })

  it('URLの中の " や < は属性を壊さない', () => {
    expect(linkAttrs('https://a.example.test/?q="><script>', { track: false, newTab: false })).not.toContain('"><script>')
  })
})

describe('色・画像', () => {
  it('色は #RRGGBB だけ受け付ける', () => {
    expect(safeColor('#e5573f', '#000000')).toBe('#E5573F')
    expect(safeColor('red;background:url(x)', '#000000')).toBe('#000000')
    expect(safeColor('#fff', '#000000')).toBe('#000000')
  })

  it('画像は選んだファイル（data:image/…;base64）だけ', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    expect(safeImage(png)).toBe(png)
    expect(safeImage('https://example.test/a.png')).toBe('')
    expect(safeImage('data:text/html;base64,PHNjcmlwdD4=')).toBe('')
    expect(safeImage('data:image/png;base64,AAA" onerror="x')).toBe('')
  })

  it('保存で別ファイルになった画像・動画（/uploads/ハッシュ.拡張子）も受け付ける（開き直したときの形）', () => {
    const hash = 'a'.repeat(64)
    expect(safeImage(`/uploads/${hash}.webp`)).toBe(`/uploads/${hash}.webp`)
    expect(safeImage(`/uploads/${hash}.mp4`)).toBe('')
    expect(safeImage('/uploads/../x.png')).toBe('')
    expect(safeImage(`https://example.test/uploads/${hash}.png`)).toBe('')
    expect(safeVideo(`/uploads/${hash}.mp4`)).toBe(`/uploads/${hash}.mp4`)
    expect(safeVideo(`/uploads/${hash}.png`)).toBe('')
    expect(safeVideo('data:video/mp4;base64,AAAA')).toBe('data:video/mp4;base64,AAAA')
    expect(safeVideo('data:video/quicktime;base64,AAAA')).toBe('')
  })

  it('濃くする・薄くする', () => {
    expect(shade('#808080', -0.5)).toBe('#404040')
    expect(shade('#808080', 0.5)).toBe('#C0C0C0')
    expect(shade('#FFFFFF', -1)).toBe('#000000')
  })

  it('地の色に合わせて読める文字色を選ぶ（濃い地は白・淡い地は濃い色）', () => {
    expect(inkOn('#1F2A37')).toBe('#FFFFFF')
    expect(inkOn('#E5573F')).toBe('#FFFFFF')
    expect(inkOn('#FFE14D')).toBe('#1F2A37')
    expect(inkOn('#F4F4F4')).toBe('#1F2A37')
  })
})

describe('Widgetごとの名前', () => {
  it('毎回ちがう、CSSのクラスに使える名前', () => {
    const a = newUid()
    expect(a).toMatch(/^nc-[a-z0-9]{8}$/)
    expect(newUid()).not.toBe(a)
  })
})

describe('作成したWidgetから入れるときの名前の付け直し', () => {
  it('型で作ったWidgetは、入れるたびに新しい名前にする（同じLPに2つ入れて片方の色を変えても、もう片方は変わらない）', () => {
    const html =
      '<style>.nc-abcd1234{color:red}.nc-abcd1234 .nc-cta__btn{animation:nc-abcd1234-press 2s}@keyframes nc-abcd1234-press{}</style>' +
      '<div class="nc nc-cta nc-abcd1234" data-nocode="cta"><a class="nc-cta__btn" href="#">x</a></div>'
    const next = rekeyUid(html, 'nc-zzzz9999')
    expect(next).not.toContain('nc-abcd1234')
    expect(next).toContain('.nc-zzzz9999 .nc-cta__btn{animation:nc-zzzz9999-press 2s}')
    expect(next).toContain('class="nc nc-cta nc-zzzz9999"')
  })

  it('型で作っていないWidgetはそのまま', () => {
    const html = '<div class="faq nc-abcd1234">x</div>'
    expect(rekeyUid(html, 'nc-zzzz9999')).toBe(html)
  })
})
