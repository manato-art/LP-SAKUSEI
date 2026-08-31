/**
 * リンクドロップダウン（テキスト選択ツールバーの鎖アイコン・`LinkDropdown-BtnOpenDropdown`）。
 *
 * **マークアップは書かない。** `fragments/link-dropdown.html` は採取した実DOM
 * （`ab_tests__UID__articles__toolbar-link-open.html` の `.css-1rfivp` 部分木）そのもので、
 * 実uidを持ち込まないために `href` を空にした以外は1文字も変えていない。
 * EmotionのランタイムCSSも採取物から切り出して `link-dropdown.emotion.css` に置いてある。
 *
 * 採取物から読み取れた実挙動:
 *   - パネルは `_editorWrapper_` の直下に出る（`position:absolute` / 700px幅 / 背景に暗幕）
 *   - パネルが開いている間、ツールバーは**鎖アイコン以外を全部隠す**
 *     （採取物で `data-is-show="true"` なのは `EditorToolbarLinkDropdown` だけ）
 *   - 初期チェックは「レポート計測しない」「現在のウィンドウ（推奨）」
 *
 * 採取できていないもの（推測で埋めない・触ると正直にそう出す）:
 *   - `ページ内移動` タブの中身（採取物では空のtabpanel。Radixが遅延描画している）
 *   - 成果単価の通貨セレクトの選択肢（`aria-expanded="false"` のままで一覧が出ていない）
 *   - リンク名・成果単価・計測設定・外部連携設定の保存先API
 */
import type Quill from 'quill'
import panelHtml from '../../fragments/link-dropdown.html?raw'
import '../../fragments/link-dropdown.emotion.css'
import { toast } from '../../ui.ts'
import { DEFAULT_LINK_FORM, parseLinkForm, type LinkAttributes, type LinkFormValues } from './link-form.ts'
import type { QuillRange } from './placement.ts'

/** 採取したパネル内の目印（Emotionのターゲットクラス＝コンポーネント単位で安定する方） */
const HOOK = {
  root: '.css-1rfivp',
  header: '.ejqwej81',
  tabTrigger: '[data-radix-collection-item]',
  externalPanel: '[id$="-content-external"]',
  innerPanel: '[id$="-content-inner"]',
  section: '.emozpqo16',
  sectionTitle: '.emozpqo14',
  urlInput: 'input[placeholder="https://..."]',
  nameInput: 'input[placeholder="例: ページ最下部のリンク"]',
  unitPriceInput: 'input[placeholder="単価を入力"]',
  currencyTrigger: '[role="combobox"]',
  checkboxGroup: '.emozpqo13',
  checkbox: '[role="checkbox"]',
  trackingLink: 'a.e1sedio45',
  footer: '.emozpqo5',
  remove: '.emozpqo3',
  cancel: 'button.css-3p742q',
  submit: 'button.css-1l1lghn',
} as const

/** タブの見た目（採取物 verbatim。active / inactive でクラスごと入れ替わる） */
const TAB_CLASS = { active: 'css-1abc55u', inactive: 'css-rzgjf5' } as const

/** 採取物の見出し文言。ここでチェック群を特定する */
const SECTION = { measure: '計測設定', target: 'ページ遷移設定' } as const

export interface LinkDropdownOptions {
  /** 「計測ツールの変更 ※別タブが開きます」の遷移先（クローンのルートに張り替える） */
  readonly trackingSettingsHref: string
  /** 閉じたとき（× / キャンセル / 追加 / 削除のいずれでも）に呼ばれる */
  readonly onClose?: () => void
}

export interface LinkDropdown {
  readonly open: (range: QuillRange) => void
  readonly close: () => void
  readonly isOpen: () => boolean
}

export function mountLinkDropdown(
  root: HTMLElement,
  quill: Quill,
  options: LinkDropdownOptions,
): LinkDropdown | null {
  const host = root.querySelector<HTMLElement>('[data-test="editorWrapper"]')
  if (host === null) {
    console.warn('[link-dropdown] 土台に editorWrapper が無いのでリンクパネルを出せない')
    return null
  }

  const template = document.createElement('template')
  template.innerHTML = panelHtml.trim()
  const panel = template.content.querySelector<HTMLElement>(HOOK.root)
  if (panel === null) {
    console.warn('[link-dropdown] 採取したパネルの根（css-1rfivp）が見つからない')
    return null
  }

  const form = wireForm(panel, options)
  let range: QuillRange | null = null

  const isOpen = (): boolean => panel.isConnected
  const close = (): void => {
    if (!isOpen()) return
    panel.remove()
    range = null
    options.onClose?.()
  }
  const open = (target: QuillRange): void => {
    range = target
    form.reset()
    host.append(panel)
  }

  // 閉じるのは ヘッダーの× と フッターのキャンセル の2つだけ。
  // 暗幕（`.ekeyuhd6`）を押したら閉じるかどうかは採取物から分からないので配線しない。
  panel.querySelector(`${HOOK.header} button`)?.addEventListener('click', close)
  panel.querySelector(`${HOOK.footer} ${HOOK.cancel}`)?.addEventListener('click', close)

  panel.querySelector(`${HOOK.footer} ${HOOK.remove}`)?.addEventListener('click', () => {
    if (range === null) return
    quill.formatText(range.index, range.length, 'link', false, 'user')
    quill.setSelection(range.index, range.length, 'silent')
    close()
    toast('リンクを削除しました')
  })

  panel.querySelector(`${HOOK.footer} ${HOOK.submit}`)?.addEventListener('click', () => {
    if (range === null) return
    const parsed = parseLinkForm(form.values())
    if (!parsed.ok) {
      toast(parsed.reason, 'error')
      return
    }
    applyLink(quill, range, parsed.link)
    close()
    toast('リンクを追加しました')
  })

  return { open, close, isOpen }
}

/**
 * Quill の Link blot は `href` に加えて `target="_blank"` と `rel` を必ず付ける。
 * 採取物の「現在のウィンドウ（推奨）」を選んだときは `target` を外す。
 *
 * リンク名 / 成果単価 / 計測設定 / 外部連携設定は、実物がDOMのどこへ書くのかも
 * どのAPIへ送るのかも採取できていない。**それらしい属性名を作らない**ため、ここでは書かない。
 */
function applyLink(quill: Quill, range: QuillRange, link: LinkAttributes): void {
  quill.formatText(range.index, range.length, 'link', link.url, 'user')
  quill.setSelection(range.index, range.length, 'silent')
  if (link.opensInNewTab) return
  for (const line of quill.getLines(range.index, range.length)) {
    const node = line.domNode as HTMLElement
    for (const anchor of node.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
      if (anchor.getAttribute('href') === link.url) anchor.removeAttribute('target')
    }
  }
}

interface LinkForm {
  readonly values: () => LinkFormValues
  readonly reset: () => void
}

function wireForm(panel: HTMLElement, options: LinkDropdownOptions): LinkForm {
  const url = panel.querySelector<HTMLInputElement>(HOOK.urlInput)
  const name = panel.querySelector<HTMLInputElement>(HOOK.nameInput)
  const unitPrice = panel.querySelector<HTMLInputElement>(HOOK.unitPriceInput)
  const measure = wireCheckboxGroup(panel, SECTION.measure)
  const target = wireCheckboxGroup(panel, SECTION.target)

  const tracking = panel.querySelector<HTMLAnchorElement>(HOOK.trackingLink)
  if (tracking !== null) tracking.href = options.trackingSettingsHref

  wireTabs(panel)
  panel.querySelector(HOOK.currencyTrigger)?.addEventListener('click', () => {
    toast('成果単価の通貨の選択肢は未採取のため未実装です', 'error')
  })

  return {
    values: () => ({
      url: url?.value ?? '',
      name: name?.value ?? '',
      unitPrice: unitPrice?.value ?? '',
      // 並び順は採取物どおり: 計測設定 = [する, しない] / ページ遷移設定 = [現在のウィンドウ, 新しいタブ]
      isReportMeasured: measure?.selected() === 0,
      opensInNewTab: target?.selected() === 1,
    }),
    reset: () => {
      if (url !== null) url.value = ''
      if (name !== null) name.value = ''
      if (unitPrice !== null) unitPrice.value = ''
      measure?.select(DEFAULT_LINK_FORM.isReportMeasured ? 0 : 1)
      target?.select(DEFAULT_LINK_FORM.opensInNewTab ? 1 : 0)
    },
  }
}

interface CheckboxGroup {
  readonly selected: () => number
  readonly select: (index: number) => void
}

/**
 * 採取物のチェック群は `role="checkbox"` だが、中身は2択の排他選択
 * （片方が `data-state="checked"` でもう片方が `unchecked"`）。
 * チェック済み / 未チェックのSVGは採取物の中に両方あるので、それを複製して入れ替える。
 */
function wireCheckboxGroup(panel: HTMLElement, title: string): CheckboxGroup | undefined {
  const section = [...panel.querySelectorAll<HTMLElement>(HOOK.section)].find(
    (node) => node.querySelector(HOOK.sectionTitle)?.textContent?.trim() === title,
  )
  const group = section?.querySelector<HTMLElement>(HOOK.checkboxGroup)
  if (group === undefined || group === null) return undefined

  const boxes = [...group.querySelectorAll<HTMLElement>(HOOK.checkbox)]
  const checkedIcon = group.querySelector('[data-testid="checked-icon"]')
  const uncheckedIcon = group.querySelector('[data-testid="unchecked-icon"]')
  if (boxes.length !== 2 || checkedIcon === null || uncheckedIcon === null) return undefined

  const select = (index: number): void => {
    boxes.forEach((box, position) => {
      const isChecked = position === index
      box.setAttribute('aria-checked', isChecked ? 'true' : 'false')
      box.setAttribute('data-state', isChecked ? 'checked' : 'unchecked')
      box.replaceChildren((isChecked ? checkedIcon : uncheckedIcon).cloneNode(true))
    })
  }
  boxes.forEach((box, index) => {
    const label = box.parentElement?.querySelector('label')
    box.addEventListener('click', () => select(index))
    label?.addEventListener('click', (event) => {
      event.preventDefault()
      select(index)
    })
  })
  return { selected: () => boxes.findIndex((box) => box.getAttribute('data-state') === 'checked'), select }
}

/**
 * タブの切り替え。`ページ内移動` 側の中身は採取物では空（Radixが遅延描画するため）なので、
 * 中身を作らずに「未採取」と伝える。
 */
function wireTabs(panel: HTMLElement): void {
  const triggers = [...panel.querySelectorAll<HTMLElement>(HOOK.tabTrigger)]
  const panels = [
    panel.querySelector<HTMLElement>(HOOK.externalPanel),
    panel.querySelector<HTMLElement>(HOOK.innerPanel),
  ]
  triggers.forEach((trigger, index) => {
    trigger.addEventListener('click', () => {
      triggers.forEach((node, position) => {
        const isActive = position === index
        node.setAttribute('aria-selected', isActive ? 'true' : 'false')
        node.setAttribute('data-state', isActive ? 'active' : 'inactive')
        node.classList.toggle(TAB_CLASS.active, isActive)
        node.classList.toggle(TAB_CLASS.inactive, !isActive)
      })
      panels.forEach((node, position) => {
        if (node === null) return
        const isActive = position === index
        node.setAttribute('data-state', isActive ? 'active' : 'inactive')
        node.toggleAttribute('hidden', !isActive)
      })
      if (index === 1) toast('「ページ内移動」の中身は未採取のため空です', 'error')
    })
  })
}
