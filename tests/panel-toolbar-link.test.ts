/**
 * リンクドロップダウン（テキスト選択ツールバーの鎖アイコン）と Widget管理 の開き方。
 *
 * `vitest.config.ts` の environment は node（DOM無し）なので、
 * ここで検証するのは「純粋関数」と「採取物そのもの」の2種類だけ。
 * 採取物を読んで assert することで、実装が推測でなく採取物に基づいていることを機械で示す。
 */
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_LINK_FORM,
  LINK_MEASURE_LABELS,
  LINK_TAB_LABELS,
  LINK_TARGET_LABELS,
  parseLinkForm,
  shouldCrashOnLinkOpen,
} from '../src/app/panels/toolbar/link-form.ts'
import { WIDGET_MENU_OPEN_CLASS } from '../src/app/panels/widget-manager.ts'

const LINK_FRAGMENT = 'src/app/fragments/link-dropdown.html'
const ERROR_FRAGMENT = 'src/app/fragments/global__app-error.html'
const CAPTURED_LINK_OPEN = 'src/app/fragments/ab_tests__UID__articles__toolbar-link-open.html'
const CAPTURED_EDITOR_CSSOM = 'capture/clean/ab_tests__UID__articles/editor-target/cssom.css'

describe('選択が無いままリンクを開くとアプリが落ちる（実物の挙動をそのまま再現する）', () => {
  test('選択そのものが無ければ落ちる', () => {
    expect(shouldCrashOnLinkOpen(null)).toBe(true)
  })

  test('キャレットだけ（長さ0）でも落ちる', () => {
    expect(shouldCrashOnLinkOpen({ index: 3, length: 0 })).toBe(true)
  })

  test('文字が選択されていれば落ちない', () => {
    expect(shouldCrashOnLinkOpen({ index: 3, length: 2 })).toBe(false)
  })

  test('エラー画面の断片は採取された文言をそのまま持っている', () => {
    const html = readFileSync(ERROR_FRAGMENT, 'utf8')
    expect(html).toContain('_errorPanel_1xgol_1')
    expect(html).toContain('_container_1xgol_16')
    expect(html).toContain('何らかのエラーが発生しました。')
    expect(html).toContain('しばらく時間をおいてからもう一度アクセスして下さい。')
  })

  test('エラー画面のCSSは採取済みのバンドルCSSに入っている（書き足す必要がない）', () => {
    const css = readFileSync('capture/assets/css/index-cb391eb6.css', 'utf8')
    expect(css).toContain('_errorPanel_1xgol_1{')
    expect(css).toContain('_container_1xgol_16 h1{')
  })
})

describe('採取したラベル・初期値をそのまま持っている', () => {
  test('タブは 外部リンク / ページ内移動 の2つ', () => {
    expect(LINK_TAB_LABELS).toEqual(['外部リンク', 'ページ内移動'])
  })

  test('計測設定は2択', () => {
    expect(LINK_MEASURE_LABELS).toEqual(['レポート計測する', 'レポート計測しない'])
  })

  test('ページ遷移設定は2択', () => {
    expect(LINK_TARGET_LABELS).toEqual(['現在のウィンドウ（推奨）', '新しいタブ'])
  })

  test('採取時のチェック状態が初期値（計測しない・現在のウィンドウ）', () => {
    expect(DEFAULT_LINK_FORM.isReportMeasured).toBe(false)
    expect(DEFAULT_LINK_FORM.opensInNewTab).toBe(false)
    expect(DEFAULT_LINK_FORM.url).toBe('')
    expect(DEFAULT_LINK_FORM.name).toBe('')
    expect(DEFAULT_LINK_FORM.unitPrice).toBe('')
  })
})

describe('リンクフォームの入力チェック', () => {
  const base = DEFAULT_LINK_FORM

  test('URLが空なら追加できない', () => {
    expect(parseLinkForm({ ...base, url: '   ' })).toEqual({ ok: false, reason: 'URLを入力してください' })
  })

  test('http / https のURLは通る', () => {
    const result = parseLinkForm({ ...base, url: ' https://sample.example.test/lp ' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.link.url).toBe('https://sample.example.test/lp')
  })

  test('スキーム無しは通さない（入力欄が type="url" で placeholder が https://...）', () => {
    expect(parseLinkForm({ ...base, url: 'sample.example.test' }).ok).toBe(false)
  })

  test('javascript: は通さない', () => {
    expect(parseLinkForm({ ...base, url: 'javascript:alert(1)' }).ok).toBe(false)
  })

  test('リンク名は前後の空白を落とし、空なら null', () => {
    const named = parseLinkForm({ ...base, url: 'https://sample.example.test/', name: '  ページ最下部  ' })
    expect(named.ok && named.link.name).toBe('ページ最下部')
    const empty = parseLinkForm({ ...base, url: 'https://sample.example.test/', name: '   ' })
    expect(empty.ok && empty.link.name).toBe(null)
  })

  test('成果単価は空なら null、数値なら数値、数値でなければ弾く', () => {
    const empty = parseLinkForm({ ...base, url: 'https://sample.example.test/', unitPrice: '' })
    expect(empty.ok && empty.link.unitPrice).toBe(null)
    const priced = parseLinkForm({ ...base, url: 'https://sample.example.test/', unitPrice: '1200' })
    expect(priced.ok && priced.link.unitPrice).toBe(1200)
    expect(parseLinkForm({ ...base, url: 'https://sample.example.test/', unitPrice: 'たかい' }).ok).toBe(false)
    expect(parseLinkForm({ ...base, url: 'https://sample.example.test/', unitPrice: '-1' }).ok).toBe(false)
  })

  test('チェックの選択はそのまま持ち越す', () => {
    const result = parseLinkForm({
      ...base,
      url: 'https://sample.example.test/',
      isReportMeasured: true,
      opensInNewTab: true,
    })
    expect(result.ok && result.link.isReportMeasured).toBe(true)
    expect(result.ok && result.link.opensInNewTab).toBe(true)
  })
})

describe('リンクパネルの土台は採取物そのもの', () => {
  const fragment = readFileSync(LINK_FRAGMENT, 'utf8')

  test('採取した実DOMの部分木がそのまま入っている', () => {
    const captured = readFileSync(CAPTURED_LINK_OPEN, 'utf8')
    // href だけは採取物のuidを持ち込まないために空にしてある。それ以外は1文字も変えていない。
    const blankHrefs = (html: string): string => html.replace(/href="\/folders\/[^"]*"/g, 'href=""')
    expect(blankHrefs(captured)).toContain(fragment.trimEnd())
  })

  test('採取物のuidは断片に転記していない', () => {
    expect(fragment).toContain('href=""')
    expect(fragment).not.toContain('/folders/')
  })

  test('配線に使う目印がすべて揃っている', () => {
    for (const hook of [
      'css-1rfivp',
      'radix-:r1b:-trigger-external',
      'radix-:r1b:-trigger-inner',
      'placeholder="https://..."',
      'placeholder="例: ページ最下部のリンク"',
      'placeholder="単価を入力"',
      'data-testid="checked-icon"',
      'data-testid="unchecked-icon"',
      'リンクを削除',
      'キャンセル',
      'リンクを追加',
    ]) {
      expect(fragment).toContain(hook)
    }
  })
})

describe('リンクパネルのCSSは採取した実ファイルをそのまま読む', () => {
  it('コード側にCSSを写し持たない（再スクラブで実物とズレるため）', () => {
    expect(existsSync('src/app/fragments/link-dropdown.emotion.css')).toBe(false)
  })

  it('index.html が採取済みのCSSOM（統合版）を参照している', () => {
    const html = readFileSync('src/index.html', 'utf8')
    // 画面別cssomは重複除去して _merged/cssom.css に統合済み（本番アップロード安定化）。
    expect(html).toContain('/clean/_merged/cssom.css')
    // 統合cssomにリンクパネルのクラスが含まれることを確認（採取物由来）
    const merged = readFileSync('capture/clean/_merged/cssom.css', 'utf8')
    expect(merged).toContain('_bodyWrapper_x4j8w')
  })
})

describe('リンクを開くとツールバーは鎖アイコン以外を隠す（採取物から読み取った挙動）', () => {
  test('data-is-show="true" のツールバー項目はリンクだけ', () => {
    const captured = readFileSync(CAPTURED_LINK_OPEN, 'utf8')
    const toolbar = captured.slice(captured.indexOf('data-test="EditorToolbar-EditorToolbarWrapper"'))
    const items = [...toolbar.matchAll(/_toolbarActionWrapper_1snng_54[^>]*data-is-show="(true|false)"/g)]
    expect(items.length).toBeGreaterThan(5)
    expect(items.filter((m) => m[1] === 'true')).toHaveLength(1)
    const shownIndex = items.findIndex((m) => m[1] === 'true')
    expect(items[shownIndex]?.[0]).toContain('EditorToolbarLinkDropdown')
  })
})

describe('Widget管理のメニューは採取CSSが定義したクラスだけで開く', () => {
  test('開く時に足すクラスは採取CSSに定義がある', () => {
    expect(WIDGET_MENU_OPEN_CLASS).toBe('_open_1ti69_52')
    const css = readFileSync(CAPTURED_EDITOR_CSSOM, 'utf8')
    expect(css).toContain('._actionDropdown_1ti69_1 ._actionDropdownBody_1ti69_5._open_1ti69_52 { display: block; }')
  })

  test('採取CSSはメニューの幅を持っている（推測しない）', () => {
    const css = readFileSync(CAPTURED_EDITOR_CSSOM, 'utf8')
    const rule = css.slice(css.indexOf('._actionDropdown_1ti69_1 ._actionDropdownBody_1ti69_5 {'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('width: 200px')
  })

  test('開く位置を推測したinline styleを持っていない', () => {
    const source = readFileSync('src/app/panels/widget-manager.ts', 'utf8')
    expect(source).not.toMatch(/right:\s*40px/)
    expect(source).not.toMatch(/rotate\(135deg\)/)
    expect(source).not.toMatch(/translateY\(-50%\)/)
  })
})
