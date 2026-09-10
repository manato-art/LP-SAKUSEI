/**
 * ヒートマップの列（実物の採取に合わせた作り）。
 *
 * 実物（`/ab_tests/:uid/reports/lp?tab=heatmap`）の構造:
 *   左のVersionごとに「離脱 / CLICK / CV」のチェックがあり、**チェックした数だけ右に列が増える**。
 *   各列は  Version名 / 指標名 + PV・CTR・CV / 「全パラメータ合算」 /
 *          スマホ・PC切替 + 期間 + ラインのモード選択  を持ち、
 *   その下にLPを縦スクロールで表示し、上にヒートの帯を重ねる。
 *
 * ラインのモードは実物と同じ5種類:
 *   ライン非表示 / 到達率 / 離脱率 / 滞在時間(中央値/平均値) / クリック数
 * 数値は計測タグ由来の実測（`GET /ab_tests/:uid/heatmaps/stats`）。
 * まだ計測が無いバンドは色を塗らず「-」にする（0と「データ無し」を混ぜない）。
 */
import type { HeatmapVersionStat } from '../api.ts'
import { containWidgetStyles } from '../panels/widget-style-scope.ts'

/** 列の指標（左のチェックボックスに対応）。実物は指標ごとに配色が違う。 */
export type HeatmapMetric = 'exit' | 'click' | 'cv'

export const METRIC_LABEL: Readonly<Record<HeatmapMetric, string>> = {
  exit: '離脱',
  click: 'CLICK',
  cv: 'CV',
}

/** 指標ごとの色相（実物: CV=紫系 / CLICK・離脱=橙〜赤）。 */
/** 指標ごとの色（行の縁取りなど、面以外で使う） */
export const METRIC_HUE: Readonly<Record<HeatmapMetric, number>> = {
  exit: 12,
  click: 28,
  cv: 275,
}

/** ラインのモード（実物の select の value と表記をそのまま使う） */
export type LineMode = 'none' | 'arrival' | 'exit' | 'attention' | 'elementClick'

export const LINE_MODES: readonly { value: LineMode; label: string }[] = [
  { value: 'none', label: 'ライン非表示' },
  { value: 'arrival', label: '到達率' },
  { value: 'exit', label: '離脱率' },
  { value: 'attention', label: '滞在時間(中央値/平均値)' },
  { value: 'elementClick', label: 'クリック数' },
]

const CSS_ID = 'sb-heatmap-columns-css'

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .hm-cols { display:flex; gap:16px; overflow-x:auto; padding:4px 2px 12px; align-items:flex-start; }
    /* 画面全体が白基調なので、列だけ黒いと浮くうえ文字が読みづらい。
       白地＋枠線にして、LPの絵が枠の中に収まって見えるようにする。 */
    /* 実物はLPを375×667のスマホ枠で見せ、枠の中だけをスクロールさせる
       （採取した実DOM: iframe style="width:375px;height:667px"）。
       縮小して全体を出す作りだと文字が読めず、到達ラインの位置も合わない。 */
    .hm-col {
      flex:0 0 377px; background:#fff; border:1px solid #dcdce2; border-radius:10px;
      overflow:hidden; display:flex; flex-direction:column;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    .hm-col-head {
      padding:12px 14px 10px; display:flex; flex-direction:column; gap:4px; flex-shrink:0;
      background:#f7f8fa; border-bottom:1px solid #e5e5ea;
    }
    .hm-col-version { font-size:13px; font-weight:700; color:#1a1a1a; }
    .hm-col-metric { font-size:12px; color:#444; display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
    .hm-col-metric b { font-size:13px; color:#1a1a1a; }
    .hm-col-note { font-size:11px; color:#8a8a90; }
    .hm-col-ctrl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px; }
    .hm-dev { display:flex; gap:4px; }
    .hm-dev button {
      width:24px; height:22px; border-radius:4px; border:1px solid #d5d5db; background:#fff;
      color:#555; cursor:pointer; font-size:11px; line-height:1; padding:0;
    }
    .hm-dev button.on { background:#f0960a; border-color:#f0960a; color:#fff; }
    .hm-range { font-size:11px; color:#555; font-variant-numeric:tabular-nums; }
    .hm-line-select {
      margin-left:auto; background:#fff; color:#1a1a1a; border:1px solid #d5d5db;
      border-radius:4px; font-size:11px; padding:3px 6px; font-family:inherit;
    }
    /* スマホ枠。ここ自体はスクロールさせず、中のLPだけが動く */
    .hm-col-body {
      position:relative; overflow:hidden; background:#fff;
      width:375px; height:667px; flex:0 0 667px;
    }
    .hm-canvas { position:relative; width:375px; height:667px; overflow:hidden; }
    .hm-canvas { position:relative; }
    .hm-lp { transform-origin:top left; }
    .hm-lp img { max-width:100%; }
    .hm-overlay { position:sticky; top:0; height:0; z-index:5; }
    /* 熱の色は1枚のグラデーションで敷く（帯ごとに矩形を置くと段差が出る） */
    /* 集計はバンド単位なので停止点の間に段差が出る。ぼかして自然につなぐ。
       ぼかすと上下の端が薄くなるので、外へ広げてから canvas 側で切り取る。 */
    .hm-heat { position:absolute; inset:-40px 0; filter:blur(16px); }
    /* 到達ライン。実物の arrivalLine に対応する白いバー。
       押すとLPがその深さまでスクロールするので、ボタンとして扱う。 */
    .hm-pill {
      position:absolute; left:8px; display:flex; align-items:center; justify-content:flex-end;
      height:20px; margin-top:-10px; background:#fff; border-radius:999px;
      box-shadow:0 1px 3px rgba(0,0,0,.25); padding:0 10px; box-sizing:border-box;
      cursor:pointer; border:0; font-family:inherit; transition:background .12s;
      pointer-events:auto;
    }
    .hm-pill span {
      font-size:11px; font-weight:700; color:#1a1a1a; white-space:nowrap;
      font-variant-numeric:tabular-nums;
    }
    .hm-pill:hover { background:#f2f2f4; }
    /* 選択中の行。実物は黒地だが、画面全体が白基調なので黒は重く読みづらい。
       アプリ共通の青（var(--sb-accent, #0091FF)）に白文字で「選択中」を出す。 */
    .hm-pill.on { background:var(--sb-accent, #0091FF); box-shadow:0 1px 4px rgba(0,145,255,.35); }
    .hm-pill.on span { color:#fff; }
    /* 1%未満は幅を持たせず文言だけ出す（実物の zero） */
    .hm-pill.zero { width:auto !important; }
    /* 右端のバッジ＝選択中の行が示す「LPのどの深さか」（実物の scrollPosition） */
    .hm-depth {
      position:absolute; right:0; height:26px; margin-top:-13px; min-width:44px;
      background:var(--sb-accent, #0091FF); color:#fff; display:flex; align-items:center; justify-content:center;
      border-radius:13px 0 0 13px; font-size:11px; font-weight:700;
      font-variant-numeric:tabular-nums;
    }
    .hm-dot { position:absolute; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%; }
    .hm-empty { padding:28px 14px; color:#6a6a72; font-size:12px; text-align:center; line-height:1.9; }
  `
  document.head.append(s)
}

/**
 * 0-1 の強さを、その指標の色へ。
 * 実物は「強い＝赤、弱い＝橙」の暖色グラデーションなので、強さで色相もずらす。
 * LPが透けて見える必要があるので不透明にはしない。
 */
function bandColor(_metric: HeatmapMetric, strength: number): string {
  // 指示: 「赤が100%で、青に行くほどその値が少なくなっていくイメージ」。
  // よくある熱スケール（赤→黄→緑→青）を色相で作る。
  // metric は行の色分けにだけ使い、面の色は値そのものを表す。
  const t = Math.min(1, Math.max(0, strength))
  // 赤(高)→黄→緑→水→青(低)。鮮やかに出す。
  // ※ここに渡す strength は**そのLPの最小〜最大で正規化済み**の値。
  //   生の割合をそのまま渡すと、値が26〜100%にしか散らばらないLPで
  //   色相が狭い範囲に固まり、全部同じような青緑になってしまう。
  const hue = (1 - t) * 240
  return `hsla(${hue}, 92%, 50%, 0.42)`
}

/** モードごとの「そのバンドの値」と表示文字列 */
function bandValue(
  stat: HeatmapVersionStat,
  mode: LineMode,
  i: number,
): { strength: number; label: string; isZero: boolean } | null {
  if (mode === 'none') return null
  if (mode === 'arrival' || mode === 'exit') {
    const v = (mode === 'arrival' ? stat.arrival : stat.exit)[i]
    if (v === null || v === undefined) return null
    // 実物は割合だけでなく**人数**も出す（「25人 47%到達」）。
    // 何人が実際にそこまで見たのかが分からないと、率だけでは判断できないため。
    const word = mode === 'arrival' ? '到達' : '離脱'
    // 実物は1%未満を数字でなく「1%未満到達」と出す（0人と書くと誤解を招くため）
    if (v < 0.01) return { strength: v, label: `1%未満${word}`, isZero: true }
    const people = Math.round(v * stat.pv)
    return { strength: v, label: `${people}人 ${Math.round(v * 100)}%${word}`, isZero: false }
  }
  if (mode === 'attention') {
    const ms = stat.attention[i] ?? 0
    const max = Math.max(1, ...stat.attention)
    return { strength: ms / max, label: `${(ms / 1000).toFixed(1)}秒`, isZero: false }
  }
  const n = stat.elementClick[i] ?? 0
  const max = Math.max(1, ...stat.elementClick)
  return { strength: n / max, label: `${n}クリック`, isZero: false }
}

export interface ColumnSpec {
  versionUid: string
  versionName: string
  metric: HeatmapMetric
  /** LPの本文HTML（プレビュー用） */
  html: string
  /** レポートの指標（ヘッダーに出す） */
  pv: number
  ctr: number | null
  cv: number
}

export interface ColumnDeps {
  stats: readonly HeatmapVersionStat[]
  /**
   * LP全体（ab_testスコープ）の指標。外部LPの計測はVersionに紐づかないので、
   * Version単位の数字を出すと常に0になる。version無しの集計を使う列ではこちらを出す。
   */
  totals: { pv: number; ctr: number | null; cv: number }
  /**
   * 外部LPの実HTML（サーバーが取得・無害化したもの）。
   * 外部LPの列はこのシステム側にVersion HTMLが無く、背景がサンプルLPになってしまうため、
   * これがあるときは実LPを背景に敷く。取得できていなければ null。
   */
  externalHtml: string | null
  range: { startDate: string; endDate: string }
  /** 全ページ表示（true）か スクロール表示（false） */
  fullPage: boolean
}

/** LPを見せる枠の幅（スマホ／PC） */
const SP_WIDTH = 375
const PC_WIDTH = 980

/** 1列ぶんを組み立てる */
function buildColumn(spec: ColumnSpec, deps: ColumnDeps): HTMLElement {
  // 外部LPの計測タグは Version を送らない（外部LPは当システム上「1ページ」で
  // Version別の内訳を持たないため）。その場合データは version_uid='' で入るので、
  // Version一致が無ければ version無しの集計にフォールバックする。
  // これが無いと、タグを貼っても列が永久に「まだありません」のままになる。
  const exact = deps.stats.find((s) => s.version_uid === spec.versionUid) ?? null
  const shared = deps.stats.find((s) => s.version_uid === '') ?? null
  const stat = exact ?? shared
  // 「外部LPの数字を見ている列か」は、行き着いた集計が version無しかどうかで決める。
  // 外部LPの行（entity_uid='')を直接選んだ場合も exact 一致するので、
  // 「フォールバックしたか」では判定できない。
  const isShared = stat !== null && stat.version_uid === ''

  const col = document.createElement('div')
  col.className = 'hm-col'
  col.dataset['versionUid'] = spec.versionUid
  col.dataset['metric'] = spec.metric

  const head = document.createElement('div')
  head.className = 'hm-col-head'
  const ver = document.createElement('div')
  ver.className = 'hm-col-version'
  ver.textContent = spec.versionName
  const met = document.createElement('div')
  met.className = 'hm-col-metric'
  const metName = document.createElement('b')
  metName.textContent = METRIC_LABEL[spec.metric]
  const metStats = document.createElement('span')
  // 外部LP（version無し）の列は、Version単位ではなくLP全体の数字を出す。
  // そうしないとタグが動いていてもヘッダーが常に PV: 0 になり誤解を招く。
  const shown = isShared ? deps.totals : { pv: spec.pv, ctr: spec.ctr, cv: spec.cv }
  metStats.textContent =
    `PV: ${shown.pv}  CTR: ${shown.ctr === null ? '-' : `${(shown.ctr * 100).toFixed(2)}%`}  CV: ${shown.cv}`
  met.append(metName, metStats)
  const note = document.createElement('div')
  note.className = 'hm-col-note'
  note.textContent = isShared ? '全パラメータ合算・外部LP（Version区別なし）' : '全パラメータ合算'

  const ctrl = document.createElement('div')
  ctrl.className = 'hm-col-ctrl'
  const dev = document.createElement('div')
  dev.className = 'hm-dev'
  const sp = document.createElement('button')
  sp.type = 'button'
  sp.textContent = 'SP'
  sp.className = 'on'
  const pc = document.createElement('button')
  pc.type = 'button'
  pc.textContent = 'PC'
  for (const b of [sp, pc]) {
    b.addEventListener('click', () => {
      sp.classList.toggle('on', b === sp)
      pc.classList.toggle('on', b === pc)
      setLpWidth(b === pc ? PC_WIDTH : SP_WIDTH)
      applyScale()
    })
  }
  dev.append(sp, pc)
  const rangeEl = document.createElement('span')
  rangeEl.className = 'hm-range'
  rangeEl.textContent = `${deps.range.startDate} ~ ${deps.range.endDate}`
  const lineSelect = document.createElement('select')
  lineSelect.className = 'hm-line-select'
  for (const m of LINE_MODES) {
    const o = document.createElement('option')
    o.value = m.value
    o.textContent = m.label
    lineSelect.append(o)
  }
  lineSelect.value = 'arrival'
  ctrl.append(dev, rangeEl, lineSelect)
  head.append(ver, met, note, ctrl)

  const body = document.createElement('div')
  body.className = 'hm-col-body'
  const canvas = document.createElement('div')
  canvas.className = 'hm-canvas'
  // 上下へ広げた熱の層がLPの外へはみ出さないようにする
  canvas.style.overflow = 'hidden'
  // 背景。外部LPは実LPを iframe で敷く（自前配信は従来どおりVersionのHTML）。
  // iframe にしているのは、他所のLPのCSSがこの画面に漏れ出さないようにするためと、
  // sandbox でスクリプトを**実行させない**ため（サーバー側の除去と合わせて二重の防御）。
  // 指示: 「LPの画面に関しては元のLPの画面そのまま使う」。
  // 実LPを取得できているなら、どの列でもそれを背景にする（サンプルLPでは位置が合わない）。
  const useExternal = deps.externalHtml !== null
  const lp: HTMLElement = useExternal
    ? document.createElement('iframe')
    : document.createElement('div')
  lp.className = 'hm-lp'
  // スマホ枠いっぱい。縮小はせず、枠の中だけをスクロールさせる（実物と同じ）。
  lp.style.width = `${SP_WIDTH}px`
  lp.style.height = '667px'
  /** 自前LPの Widget の @media を枠の幅で判定し直す（外部LPの iframe はブラウザが枠の幅で判定するので要らない） */
  let restyleWidgets: ((width: number) => void) | null = null
  if (useExternal) {
    const frame = lp as HTMLIFrameElement
    // allow-scripts は与えない＝中のJSは動かない。allow-same-origin は
    // 高さ測定とスクロール操作のため。
    // （危険なのは allow-scripts と allow-same-origin の**同時**指定で、これは該当しない）
    frame.setAttribute('sandbox', 'allow-same-origin')
    frame.setAttribute('referrerpolicy', 'no-referrer')
    frame.style.border = '0'
    frame.srcdoc = deps.externalHtml as string
  } else {
    lp.style.overflow = 'auto'
    lp.innerHTML = spec.html
    // Widget の <style> はこの列の LP の中だけに効かせ（ヒートマップの画面や隣の列に漏らさない）、
    // @media は枠の幅で判定する（ブラウザの幅だと、PCで開いたときスマホ枠にPC用の見た目が出ていた）。
    restyleWidgets = containWidgetStyles(lp, 'lp', SP_WIDTH)
  }
  /** 枠の幅をスマホ／PCに切り替える。自前LPの Widget は、@media をその幅で判定し直す */
  const setLpWidth = (width: number): void => {
    lp.style.width = `${width}px`
    restyleWidgets?.(width)
  }
  const overlay = document.createElement('div')
  overlay.className = 'hm-overlay'
  canvas.append(lp)
  // 実物では到達ラインは動かず、押すとLPだけが裏でその位置までスクロールする。
  // だから overlay は canvas（＝スクロールする中身）の中に入れず、
  // sticky で列の上端に貼り付けておく（高さ0なので場所は取らない）。
  body.append(overlay, canvas)

  /** LPの中身をスクロールさせる要素（iframe なら中の window、そうでなければ自身）。 */
  const lpScroller = (): { top: number; max: number; to: (y: number) => void } => {
    if (useExternal) {
      const win = (lp as HTMLIFrameElement).contentWindow
      const doc = (lp as HTMLIFrameElement).contentDocument
      const h = doc?.documentElement.scrollHeight ?? 0
      return {
        top: win?.scrollY ?? 0,
        max: Math.max(0, h - 667),
        to: (y) => win?.scrollTo({ top: y, behavior: 'smooth' }),
      }
    }
    return {
      top: lp.scrollTop,
      max: Math.max(0, lp.scrollHeight - lp.clientHeight),
      to: (y) => lp.scrollTo({ top: y, behavior: 'smooth' }),
    }
  }
  // 縮小はしない（実物どおり等倍のスマホ枠）。読み込み後に描き直すだけ。
  const applyScale = (): void => {
    /* 等倍表示なので寸法計算は不要。resize/読み込み時の再描画のフックとして残す。 */
  }
  if (useExternal) lp.addEventListener('load', () => drawOverlay())

  /**
   * 実物の到達ラインは **5%刻みの21行**（0%,5%,…,100%）で、行の位置はLPの高さと無関係に
   * 上から30px間隔で並ぶ。行を押すとLPだけがその深さまでスクロールし、押した行が
   * 黒地オレンジ字になって、右のバッジにその深さ（例: 55%）が出る。
   * 採取した実DOM（arrivalLine / scrollPosition）に合わせている。
   */
  const ROW_STEP = 30
  const ROW_TOP = 10
  const ROW_COUNT = 21
  let activeRow = 0

  /** 行i（＝LPの深さ i*5%）に対応する、20バンド集計の添字 */
  const bandIndexOf = (row: number, bands: number): number =>
    Math.min(bands - 1, Math.floor((row / (ROW_COUNT - 1)) * bands))

  /** 行を押したときに、スマホ枠の中のLPをその深さまで送る */
  const scrollLpTo = (depth: number): void => {
    const sc = lpScroller()
    if (sc.max <= 0) return
    sc.to(sc.max * depth)
  }

  const drawOverlay = (): void => {
    overlay.innerHTML = ''
    // 熱の層は canvas 側（LPと一緒にスクロールする）に置くので、別途消す。
    // 消さずに描き足すと、行を押すたびに層が積み重なって濃くなる。
    for (const old of canvas.querySelectorAll('.hm-heat')) old.remove()
    const mode = lineSelect.value as LineMode
    if (stat === null || stat.pv === 0) return
    if (mode === 'none') return
    const bands = stat.bands

    // 熱の色。LPが読めなくなるので薄く敷く（実物もLPの絵柄がはっきり見える）。
    // 面は行（5%刻み21段）より**細かく**出す。行は読むための目盛りで、
    // 面は「そのあたりが実際どれだけ見られたか」を連続的に表すものなので、
    // 集計しているバンド数ぶんの色停止点をそのまま使う。
    // そのLPに実際に出ている最小〜最大へ色相を目一杯割り当てる。
    // こうしないと「26%〜74%しか無いLP」で色がほとんど変化せず、
    // 一面が同じ色に見えてどこが読まれたのか分からない。
    const raw = Array.from({ length: bands }, (_, i) => bandValue(stat, mode, i))
    const present = raw.filter((v): v is NonNullable<typeof v> => v !== null).map((v) => v.strength)
    const lo = present.length > 0 ? Math.min(...present) : 0
    const hi = present.length > 0 ? Math.max(...present) : 1
    const span = hi - lo
    const norm = (x: number): number => (span < 1e-6 ? 1 : (x - lo) / span)

    const stops = raw
      .map((v, i) =>
        v === null
          ? null
          : `${bandColor(spec.metric, norm(v.strength))} ${(((i + 0.5) / bands) * 100).toFixed(2)}%`,
      )
      .filter((x): x is string => x !== null)
    if (stops.length > 0) {
      const heat = document.createElement('div')
      heat.className = 'hm-heat'
      heat.style.background = `linear-gradient(to bottom, ${stops.join(',')})`
      canvas.append(heat)
    }

    for (let row = 0; row < ROW_COUNT; row++) {
      const v = bandValue(stat, mode, bandIndexOf(row, bands))
      if (v === null) continue
      const top = ROW_TOP + row * ROW_STEP
      const pill = document.createElement('button')
      pill.type = 'button'
      pill.className = `hm-pill${row === activeRow ? ' on' : ''}${v.isZero ? ' zero' : ''}`
      pill.style.top = `${top}px`
      // 幅は割合に比例。実物も最大で列幅の約7割までしか伸びない。
      if (!v.isZero) {
        pill.style.width = `${(22 + Math.min(1, Math.max(0, v.strength)) * 49).toFixed(1)}%`
      }
      const label = document.createElement('span')
      label.textContent = v.label
      pill.append(label)
      pill.addEventListener('click', () => {
        activeRow = row
        drawOverlay()
        scrollLpTo(row / (ROW_COUNT - 1))
      })
      overlay.append(pill)
    }

    // 右のバッジ＝選択中の行がLPのどの深さを指しているか
    const depth = document.createElement('div')
    depth.className = 'hm-depth'
    depth.style.top = `${ROW_TOP + activeRow * ROW_STEP}px`
    depth.textContent = `${Math.round((activeRow / (ROW_COUNT - 1)) * 100)}%`
    overlay.append(depth)

    // クリック数モードのときは実際の座標も打つ（帯だけだと横位置が分からない）
    if (mode === 'elementClick') {
      for (const c of stat.clicks.slice(-400)) {
        const dot = document.createElement('div')
        dot.className = 'hm-dot'
        dot.style.left = `${c.x * 100}%`
        dot.style.top = `${c.y * 100}%`
        dot.style.background = bandColor(spec.metric, 0.9)
        overlay.append(dot)
      }
    }
  }

  lineSelect.addEventListener('change', drawOverlay)

  col.append(head, body)
  if (stat === null || stat.pv === 0) {
    const empty = document.createElement('div')
    empty.className = 'hm-empty'
    // PVがあるのに空だと「壊れている」と読めてしまう。実際の理由は
    // 「位置の記録は離脱時に1回だけ送られる」ため、それ以前のPVには位置が無いこと。
    // 自前配信のLPには計測タグが最初から入っているので「タグを貼れ」とは言わない。
    const seen = isShared ? deps.totals.pv : spec.pv
    empty.textContent = isShared
      ? [
          'この外部LPのヒートマップはまだありません。',
          'LPに計測タグを貼ると、ページを離れたときに',
          '到達率・離脱率・滞在時間・クリックが記録されます。',
        ].join('\n')
      : [
          'このVersionのヒートマップはまだありません。',
          '位置の記録は表示したときではなく、',
          'ページを離れたときに1回だけ送られます。',
          seen > 0
            ? `これまでの ${seen} PV はその記録より前のぶんです。次の閲覧から貯まります。`
            : 'まだ誰も見ていません。',
        ].join('\n')
    empty.style.whiteSpace = 'pre-line'
    body.prepend(empty)
  }

  // 背景タブでは requestAnimationFrame が発火しないので、rAFに依存しない。
  // 直後に一度・レイアウト確定後にもう一度・幅が変わったら再計算する。
  const refresh = (): void => {
    applyScale()
    drawOverlay()
  }
  refresh()
  setTimeout(refresh, 0)
  window.addEventListener('resize', refresh)
  return col
}

/** 選ばれた列をまとめて描画する（0件なら空にする） */
export function renderHeatmapColumns(
  host: HTMLElement,
  specs: readonly ColumnSpec[],
  deps: ColumnDeps,
): void {
  injectStyles()
  // 描画先を空にするのはこの関数の責務
  host.innerHTML = ''
  if (specs.length === 0) return
  const wrap = document.createElement('div')
  wrap.className = 'hm-cols'
  for (const spec of specs) wrap.append(buildColumn(spec, deps))
  host.append(wrap)
}
