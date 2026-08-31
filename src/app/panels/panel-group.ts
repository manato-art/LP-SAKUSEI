/**
 * サイドパネルの開閉をまとめる。
 *
 * 実物は右レールのツールを押すと**そのパネルだけ**が開く。
 * 採取した各状態（tool-version-settings / tool-link-replace / tool-history …）も、
 * どれも「1枚だけ開いている」姿で採れている。
 *
 * クローンは全パネルを開いた状態で置いていたため、画面上で重なっていた。
 *
 * 開閉の仕組みは**実物のCSSをそのまま使う**（手書きしない）:
 *   ._bodyWrapper_x4j8w_8 { display: none }
 *   ._open_x4j8w_84       { display: block }
 */

/** 採取CSSにある開いた状態のクラス。 */
export const PANEL_OPEN_CLASS = '_open_x4j8w_84'

/** パネルを包む要素のクラス（既定で display:none）。 */
export const PANEL_BODY_CLASS = '_bodyWrapper_x4j8w_8'

/**
 * 次にどのパネルが開いているべきかを決める。
 * @param current いま開いているパネル名（無ければ null）
 * @param clicked 押されたパネル名
 */
export function nextOpenPanel(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked
}

/** 開閉をまとめて面倒みる入れ物。 */
export interface PanelGroup {
  register: (name: string, panel: HTMLElement) => void
  toggle: (name: string) => void
  closeAll: () => void
}

export function createPanelGroup(): PanelGroup {
  const panels = new Map<string, HTMLElement>()
  let openName: string | null = null

  function apply(): void {
    for (const [name, panel] of panels) {
      const body = panel.classList.contains(PANEL_BODY_CLASS)
        ? panel
        : panel.querySelector<HTMLElement>(`.${PANEL_BODY_CLASS}`)
      body?.classList.toggle(PANEL_OPEN_CLASS, name === openName)
    }
  }

  return {
    register(name, panel) {
      panels.set(name, panel)
      apply()
    },
    toggle(name) {
      openName = nextOpenPanel(openName, name)
      apply()
    },
    closeAll() {
      openName = null
      apply()
    },
  }
}
