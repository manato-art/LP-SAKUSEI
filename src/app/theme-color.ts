/**
 * テーマカラー（アクセント色）。
 *
 * 画面のあちこちに色を直書きすると、変えたときに一部だけ古い色が残る。
 * ここで CSS カスタムプロパティに1回だけ流し込み、各画面は `var(--sb-accent)` を見る。
 *
 * 保存は2段構え:
 *   localStorage … 起動直後に同期で当てて、既定色がちらっと見えるのを防ぐ
 *   サーバー     … アカウントに紐づけて、別のブラウザでも同じ色にする
 * 食い違ったらサーバー側を正とする（設定画面で変えた値が本体）。
 */

/** 既定のアクセント色（採取した実物の青） */
export const DEFAULT_ACCENT = '#0091FF'

/** 設定画面に並べる色 */
export const ACCENT_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#0091FF', label: 'ブルー' },
  { value: '#4F46E5', label: 'インディゴ' },
  { value: '#7C3AED', label: 'パープル' },
  { value: '#0D9488', label: 'ティール' },
  { value: '#12A150', label: 'グリーン' },
  { value: '#F0960A', label: 'オレンジ' },
  { value: '#E4432B', label: 'レッド' },
  { value: '#475467', label: 'グレー' },
]

const STORAGE_KEY = 'sb-accent-color'

/** `#RGB` / `#RRGGBB` を受ける。それ以外は色として扱わない。 */
export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

/** `#RGB` を `#RRGGBB` に伸ばす */
function expand(hex: string): string {
  const v = hex.trim()
  if (v.length !== 4) return v.toUpperCase()
  const [, r, g, b] = v
  return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
}

function toRgb(hex: string): { r: number; g: number; b: number } {
  const v = expand(hex).slice(1)
  return {
    r: Number.parseInt(v.slice(0, 2), 16),
    g: Number.parseInt(v.slice(2, 4), 16),
    b: Number.parseInt(v.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const part = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

/** ホバー用に少し暗くする */
export function darken(hex: string, amount = 0.18): string {
  const { r, g, b } = toRgb(hex)
  return toHex({ r: r * (1 - amount), g: g * (1 - amount), b: b * (1 - amount) })
}

/** 薄い背景色（選択中の行やバッジの地に使う） */
export function tint(hex: string, amount = 0.9): string {
  const { r, g, b } = toRgb(hex)
  return toHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  })
}

/**
 * その色を背景にしたとき、白と濃色のどちらの文字が読めるか。
 * 明るい色を選ばれたときに白文字のままだと読めなくなるので、ここで切り替える。
 * 相対輝度は WCAG の定義に従う。
 */
export function readableInk(hex: string): string {
  const { r, g, b } = toRgb(hex)
  const channel = (n: number): number => {
    const s = n / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  /**
   * 明るい背景のときだけ濃い文字にする。
   * 厳密なコントラスト比（4.5）で切ると、実物が白文字で使っている青まで
   * 暗い文字に倒れて見た目が変わってしまうので、明るさで切る。
   */
  return luminance > 0.55 ? '#151515' : '#FFFFFF'
}

/** その色を画面全体に効かせる */
export function applyAccent(hex: string): void {
  const color = isHexColor(hex) ? expand(hex) : DEFAULT_ACCENT
  const root = document.documentElement
  root.style.setProperty('--sb-accent', color)
  root.style.setProperty('--sb-accent-dark', darken(color))
  root.style.setProperty('--sb-accent-tint', tint(color))
  root.style.setProperty('--sb-accent-ink', readableInk(color))
}

/** ブラウザに覚えている色（無ければ既定） */
export function storedAccent(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved !== null && isHexColor(saved) ? expand(saved) : DEFAULT_ACCENT
  } catch {
    // プライベートモード等で localStorage が使えなくても画面は出す
    return DEFAULT_ACCENT
  }
}

function remember(hex: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, hex)
  } catch {
    /* 覚えられなくても、その場の見た目は変わっている */
  }
}

/**
 * 起動時に呼ぶ。まず覚えている色を同期で当ててから、サーバーの値に合わせ直す。
 * 先に当てるのは、既定色が一瞬見えてから切り替わるのを防ぐため。
 */
export function initAccent(fetchFromServer: () => Promise<string | null>): void {
  applyAccent(storedAccent())
  void fetchFromServer().then(
    (serverValue) => {
      if (serverValue === null || !isHexColor(serverValue)) return
      applyAccent(serverValue)
      remember(expand(serverValue))
    },
    () => {
      /* 取れなければ覚えている色のまま */
    },
  )
}

/** 設定画面から色を変えたとき */
export function setAccent(hex: string, save: (hex: string) => Promise<unknown>): Promise<unknown> {
  const color = expand(hex)
  applyAccent(color)
  remember(color)
  return save(color)
}
