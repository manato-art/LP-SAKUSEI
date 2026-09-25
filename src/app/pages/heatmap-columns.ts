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
import type { HeatmapDeviceCoverage, HeatmapVersionStat, ReportVersionRow } from '../api.ts'
import { buildHeatmapLpDocument } from './heatmap-lp-document.ts'
import { ALL_PARAMS_LABEL, formatAdParam } from './heatmap-params.ts'
import { deviceNoteLines, reachBasisNote } from './heatmap-notes.ts'
import { ROW_COUNT, bandStrength, rowValue, type LineMode } from './heatmap-rows.ts'
import { paintLpLayer } from './heatmap-lp-layer.ts'

export type { LineMode } from './heatmap-rows.ts'

/** SP / PC の切り替えで読む、その端末ぶんの記録（2026-09-24・点検29） */
export interface HeatmapDeviceData {
  /** その端末の記録だけで集計したヒートマップ */
  versions: readonly HeatmapVersionStat[]
  /** その端末の、申し込んだ人だけのヒートマップ（CVの列が使う・2026-09-25） */
  cvVersions?: readonly HeatmapVersionStat[]
  /** 申し込んだ人の、Version ごとの全端末と端末ごとの人数（CVの列の断り書きに使う） */
  cvCoverage?: readonly HeatmapDeviceCoverage[]
  /** Version ごとの、全端末と端末ごとの PV */
  coverage: readonly HeatmapDeviceCoverage[]
  /** 端末を記録し始めた日 */
  since: string | null
  /** その端末で絞ったレポートの行（見出しの PV / CTR / CV に使う） */
  rows: readonly ReportVersionRow[]
  /** 外部LP（Versionに紐づかない計測）の合計 */
  totals: { pv: number; ctr: number | null; cv: number }
}

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

/** 左のチェック（離脱 / CLICK / CV）に対する既定のライン */
export function defaultModeFor(metric: HeatmapMetric): LineMode {
  switch (metric) {
    case 'exit':
      return 'exit'
    case 'click':
      return 'elementClick'
    case 'cv':
      // CVの列は申し込んだ人だけのヒートマップ。まず「どこまで読んだか」を見せる（2026-09-25）
      return 'arrival'
  }
}

/**
 * ラインのモード。
 *
 * 実物と同じ5つ。2026-09-15 に実画面を採取して確認できた
 * （`capture/clean/ab_tests__UID__reports__lp/heatmap-3col/dom.html` の
 *  `<select><option value="none">ライン非表示</option>…` ＝ value も表記も一致）。
 * 左のチェック（離脱 / CLICK / CV）で選んだ指標に合わせた既定値を出し、
 * そのうえで細かく見たいときに切り替えられるようにしている。
 */
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
      flex:0 0 377px; background:var(--sb-c-ffffff, #FFFFFF); border:1px solid var(--sb-c-dcdce2, #DCDCE2); border-radius:10px;
      overflow:hidden; display:flex; flex-direction:column;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    .hm-col-head {
      padding:12px 14px 10px; display:flex; flex-direction:column; gap:4px; flex-shrink:0;
      background:var(--sb-c-f7f8fa, #F7F8FA); border-bottom:1px solid var(--sb-c-e5e5ea, #E5E5EA);
    }
    .hm-col-version { font-size:13px; font-weight:700; color:var(--sb-c-1a1a1a, #1A1A1A); }
    .hm-col-metric { font-size:12px; color:var(--sb-c-444444, #444444); display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
    .hm-col-metric b { font-size:13px; color:var(--sb-c-1a1a1a, #1A1A1A); }
    .hm-col-note { font-size:11px; color:#8A8A90; }
    /* カードの操作（熟読箇所の表示切替・複製・非表示）。SP/PC切替と同じ見た目に揃える */
    .hm-col-tools { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
    .hm-col-tools .hm-tool {
      border:1px solid var(--sb-c-d5d5db, #D5D5DB); background:var(--sb-c-ffffff, #FFFFFF);
      color:var(--sb-c-555555, #555555); border-radius:4px; font-size:11px; line-height:1;
      padding:5px 8px; cursor:pointer; font-family:inherit;
    }
    .hm-col-ctrl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px; }
    .hm-dev { display:flex; gap:4px; }
    .hm-dev button {
      width:24px; height:22px; border-radius:4px; border:1px solid var(--sb-c-d5d5db, #D5D5DB); background:var(--sb-c-ffffff, #FFFFFF);
      color:var(--sb-c-555555, #555555); cursor:pointer; font-size:11px; line-height:1; padding:0;
    }
    .hm-dev button.on { background:#f0960a; border-color:#f0960a; color:#FFFFFF; }
    .hm-range { font-size:11px; color:var(--sb-c-555555, #555555); font-variant-numeric:tabular-nums; }
    .hm-line-select {
      margin-left:auto; background:var(--sb-c-ffffff, #FFFFFF); color:var(--sb-c-1a1a1a, #1A1A1A); border:1px solid var(--sb-c-d5d5db, #D5D5DB);
      border-radius:4px; font-size:11px; padding:3px 6px; font-family:inherit;
    }
    /* スマホ枠。ここ自体はスクロールさせず、中のLPだけが動く */
    .hm-col-body {
      position:relative; overflow:hidden; background:var(--sb-c-ffffff, #FFFFFF);
      width:375px; height:667px; flex:0 0 667px;
    }
    /* 「全ページ表示」を選んだときは枠の高さ固定を外し、LPの全高を出す（2026-09-15） */
    .hm-cols.full .hm-col-body { height:auto; flex:0 0 auto; max-height:none; }
    .hm-canvas { position:relative; width:375px; height:667px; overflow:hidden; }
    .hm-lp { transform-origin:top left; }
    .hm-overlay { position:sticky; top:0; height:0; z-index:5; }
    /* 全ページ表示: LPを全部の高さで出し（高さは読み込み後に測って入れる）、線は本当の深さの位置に置く（2026-09-25） */
    .hm-cols.full .hm-canvas { height:auto; }
    .hm-cols.full .hm-overlay { position:absolute; top:0; left:0; right:0; }
    /* 色の面とクリックの点は、LPの中（iframe の文書）に重ねる（heatmap-lp-layer.ts） */
    /* 到達ライン。実物の arrivalLine に対応する白いバー。
       押すとLPがその深さまでスクロールするので、ボタンとして扱う。 */
    .hm-pill {
      position:absolute; left:8px; display:flex; align-items:center; justify-content:flex-end;
      height:20px; margin-top:-10px; background:var(--sb-c-ffffff, #FFFFFF); border-radius:999px;
      box-shadow:0 1px 3px rgba(0,0,0,.25); padding:0 10px; box-sizing:border-box;
      cursor:pointer; border:0; font-family:inherit; transition:background .12s;
      pointer-events:auto;
    }
    .hm-pill span {
      font-size:11px; font-weight:700; color:var(--sb-c-1a1a1a, #1A1A1A); white-space:nowrap;
      font-variant-numeric:tabular-nums;
    }
    .hm-pill:hover { background:var(--sb-c-f2f2f4, #F2F2F4); }
    /* 選択中の行。実物は黒地だが、画面全体が白基調なので黒は重く読みづらい。
       アプリ共通の青（var(--sb-accent, #0091FF)）に白文字で「選択中」を出す。 */
    .hm-pill.on { background:var(--sb-accent, #0091FF); box-shadow:0 1px 4px rgba(0,145,255,.35); }
    .hm-pill.on span { color:#FFFFFF; }
    /* 1%未満は幅を持たせず文言だけ出す（実物の zero） */
    .hm-pill.zero { width:auto !important; }
    /* 右端のバッジ＝選択中の行が示す「LPのどの深さか」（実物の scrollPosition） */
    .hm-depth {
      position:absolute; right:0; height:26px; margin-top:-13px; min-width:44px;
      background:var(--sb-accent, #0091FF); color:#FFFFFF; display:flex; align-items:center; justify-content:center;
      border-radius:13px 0 0 13px; font-size:11px; font-weight:700;
      font-variant-numeric:tabular-nums;
    }
    .hm-empty { padding:28px 14px; color:var(--sb-c-6a6a72, #6A6A72); font-size:12px; text-align:center; line-height:1.9; }
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

export interface ColumnSpec {
  versionUid: string
  versionName: string
  metric: HeatmapMetric
  /** 絞り込んでいる広告パラメータ（`utm_source=fb`）。空なら全パラメータ合算 */
  param?: string
  /** LPの本文HTML（プレビュー用） */
  html: string
  /** Version の CSS（公開LPと同じ見た目で敷くため） */
  css: string
  /** レポートの指標（ヘッダーに出す） */
  pv: number
  ctr: number | null
  cv: number
  /** 広告で絞った列の、レポートの広告の行の数字（無ければ見出しは PV だけ） */
  adRow?: { pv: number; ctr: number | null; cv: number }
}

export interface ColumnDeps {
  stats: readonly HeatmapVersionStat[]
  /**
   * 広告パラメータごとの集計（キー＝`utm_source=fb`・空文字＝合算）。
   * 列が絞り込まれているときだけ使う。渡されなければ `stats` を見る。
   */
  statsByParam?: ReadonlyMap<string, readonly HeatmapVersionStat[]>
  /**
   * 申し込んだ人だけの集計（`segment=cv`・2026-09-25）。CVの列はこちらを見る。
   * 渡されなければCVの列は「まだありません」になる（ふつうの記録を借りない）。
   */
  cvStats?: readonly HeatmapVersionStat[]
  /** 申し込んだ人だけの、広告パラメータごとの集計（キー＝`utm_source=fb`） */
  cvStatsByParam?: ReadonlyMap<string, readonly HeatmapVersionStat[]>
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
  /** 記事設定（Version設定）の CSS（自前配信のLPを公開LPと同じ見た目で敷くため） */
  styleCss: string
  range: { startDate: string; endDate: string }
  /** 全ページ表示（true）か スクロール表示（false） */
  fullPage: boolean
  /** カードの「複製」（実物の `_dupContainer_`「このヒートマップを複製します」） */
  onDuplicate?: (spec: ColumnSpec) => void
  /** カードの「非表示にする」（実物の `_optionsContainer_` の2つめ） */
  onHide?: (spec: ColumnSpec) => void
  /**
   * SP / PC を押したときに、その端末ぶんの記録を読む（2026-09-24）。
   * 渡されなければ、SP / PC は枠の幅だけを変える（数字は全端末のまま）。
   */
  loadDevice?: (device: 'sp' | 'pc') => Promise<HeatmapDeviceData>
}

/** LPを見せる枠の幅（スマホ／PC） */
const SP_WIDTH = 375
const PC_WIDTH = 980
/** スマホ枠の高さ（実物の iframe と同じ 375×667） */
const FRAME_HEIGHT = 667

/** カード見出しに出す数字。測っていないものは null＝画面では「-」 */
export interface ColumnHeaderStats {
  pv: number
  ctr: number | null
  cv: number | null
}

/**
 * カード見出しの PV / CTR / CV を決める。
 *
 * ・普通の列        : そのVersionのレポートの数字
 * ・外部LPの列      : LP全体の数字（外部LPの計測はVersionに紐づかず、Version単位だと常に0）
 * ・広告で絞った列  : その広告で計測したPVだけ。CTR・CVは広告別に測っていないので出さない
 *   （Version全体の数字を出すと「19PVの中のfb」なのか「fbが19PV」なのか読めない）
 */
export function columnHeaderStats(
  spec: {
    param?: string
    pv: number
    ctr: number | null
    cv: number
    adRow?: { pv: number; ctr: number | null; cv: number }
  },
  deps: {
    isShared: boolean
    totals: { pv: number; ctr: number | null; cv: number }
    stat: { pv: number } | null
  },
): ColumnHeaderStats {
  if (spec.param !== undefined && spec.param !== '') {
    // レポート（Branch Operation）にその広告の行があれば、同じ数字を出す（広告ごとの CV も数えている・2026-09-25）
    if (spec.adRow !== undefined) return { pv: spec.adRow.pv, ctr: spec.adRow.ctr, cv: spec.adRow.cv }
    return { pv: deps.stat?.pv ?? 0, ctr: null, cv: null }
  }
  if (deps.isShared) return { ...deps.totals }
  return { pv: spec.pv, ctr: spec.ctr, cv: spec.cv }
}

/** カード右上の小さな操作ボタン（見た目はSP/PC切替と揃える） */
function toolButton(label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'hm-tool'
  b.textContent = label
  return b
}

/** 1列ぶんを組み立てる */
function buildColumn(spec: ColumnSpec, deps: ColumnDeps): HTMLElement {
  // 外部LPの計測タグは Version を送らない（外部LPは当システム上「1ページ」で
  // Version別の内訳を持たないため）。その場合データは version_uid='' で入るので、
  // Version一致が無ければ version無しの集計にフォールバックする。
  // これが無いと、タグを貼っても列が永久に「まだありません」のままになる。
  // 広告パラメータで絞った列は、その広告ぶんの集計を見る（無ければ合算）
  const pickStat = (pool: readonly HeatmapVersionStat[]): HeatmapVersionStat | null =>
    pool.find((s) => s.version_uid === spec.versionUid) ?? pool.find((s) => s.version_uid === '') ?? null
  // CVの列は申し込んだ人だけの集計を見る（2026-09-25）
  const isCv = spec.metric === 'cv'
  const poolOf = (param: string): readonly HeatmapVersionStat[] =>
    isCv
      ? (deps.cvStatsByParam?.get(param) ?? (param === '' ? deps.cvStats : undefined) ?? [])
      : (deps.statsByParam?.get(param) ?? deps.stats)
  let stat = pickStat(poolOf(spec.param ?? ''))
  // 「外部LPの数字を見ている列か」は、行き着いた集計が version無しかどうかで決める。
  // 外部LPの行（entity_uid='')を直接選んだ場合も exact 一致するので、
  // 「フォールバックしたか」では判定できない。
  let isShared = stat !== null && stat.version_uid === ''
  /** 見出しの PV / CTR / CV の出どころ（端末で切り替えたら、その端末で絞ったレポートの数字） */
  let headSource: { spec: typeof spec; totals: ColumnDeps['totals'] } = { spec, totals: deps.totals }

  const col = document.createElement('div')
  col.className = 'hm-col'
  col.dataset['versionUid'] = spec.versionUid
  col.dataset['metric'] = spec.metric
  col.dataset['param'] = spec.param ?? ''

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
  const paintHeadStats = (): void => {
    const shown = columnHeaderStats(headSource.spec, { isShared, totals: headSource.totals, stat })
    metStats.textContent =
      `PV: ${shown.pv}  CTR: ${shown.ctr === null ? '-' : `${(shown.ctr * 100).toFixed(2)}%`}  CV: ${shown.cv ?? '-'}`
  }
  paintHeadStats()
  met.append(metName, metStats)
  const note = document.createElement('div')
  note.className = 'hm-col-note'
  // このカードが何を合算しているかを名乗る場所（実物の `_noParam_`）。
  // 広告パラメータで絞っていればその広告名、絞っていなければ「全パラメータ合算」。
  // 広告は「流入元: fb」の形で名乗る（生の utm_source=fb は title に残す・2026-09-25）
  const scope = spec.param === undefined || spec.param === '' ? ALL_PARAMS_LABEL : formatAdParam(spec.param)
  let scopeNote = isShared ? `${scope}・外部LP（Version区別なし）` : scope
  note.textContent = scopeNote
  if (spec.param !== undefined && spec.param !== '') note.title = spec.param

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
      lp.style.width = `${b === pc ? PC_WIDTH : SP_WIDTH}px`
      applyScale()
      // 横幅が変わるとLPの高さも変わる（全ページ表示なら枠の高さを測り直す）
      fitFullPage()
      // 枠の幅だけでなく、数字もその端末の記録に切り替える（2026-09-24・点検29）
      void switchDevice(b === pc ? 'pc' : 'sp')
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
  // 左で選んだ指標に合わせた既定にする（以前は常に「到達率」で、3つとも同じ絵になっていた）
  lineSelect.value = defaultModeFor(spec.metric)
  ctrl.append(dev, rangeEl, lineSelect)
  // 到達の数え方を変えた日より前の記録・端末の記録が無いぶんがあれば、そう書く（2026-09-24）
  const extraNotes = document.createElement('div')
  const paintExtraNotes = (deviceLines: readonly string[]): void => {
    const basis = stat === null ? null : reachBasisNote(stat)
    extraNotes.replaceChildren(
      ...[...(basis === null ? [] : [basis]), ...deviceLines].map((text) => {
        const line = document.createElement('div')
        line.className = 'hm-col-note'
        line.textContent = text
        return line
      }),
    )
  }
  paintExtraNotes([])
  head.append(ver, met, note, extraNotes, ctrl)

  // 実物のカードにある3つの操作（採取物: `_dupContainer_` / `_optionsContainer_`）。
  //  ・複製      : 同じ設定のカードをもう1枚増やす
  //  ・熟読箇所  : 色の面（滞在時間の濃淡）だけを消して、LPと線を素で見る
  //  ・非表示    : そのカードを閉じる（左のチェックも外す）
  const tools = document.createElement('div')
  tools.className = 'hm-col-tools'
  const heatToggle = toolButton('熟読箇所を非表示にする')
  heatToggle.addEventListener('click', () => {
    const hidden = col.classList.toggle('no-heat')
    heatToggle.textContent = hidden ? '熟読箇所を表示する' : '熟読箇所を非表示にする'
    // 面はLPの中に置いているので、描き直して消す／出す
    drawOverlay()
  })
  tools.append(heatToggle)
  if (deps.onDuplicate !== undefined) {
    const dup = toolButton('複製')
    dup.title = 'このヒートマップを複製します'
    dup.addEventListener('click', () => deps.onDuplicate?.(spec))
    tools.append(dup)
  }
  if (deps.onHide !== undefined) {
    const hide = toolButton('非表示にする')
    hide.addEventListener('click', () => deps.onHide?.(spec))
    tools.append(hide)
  }
  head.append(tools)

  const body = document.createElement('div')
  body.className = 'hm-col-body'
  const canvas = document.createElement('div')
  canvas.className = 'hm-canvas'
  // 上下へ広げた熱の層がLPの外へはみ出さないようにする
  canvas.style.overflow = 'hidden'
  // 背景の LP は iframe で敷く（外部LPは取得した実HTML、自前配信は Version の HTML を公開LPと同じ土台で包んだもの）。
  // iframe にしているのは:
  //   - 枠の幅がそのまま画面の幅になり、@media の切り替えも vw で決めた大きさもスマホ／PCの実機と同じになるため
  //     （以前は自前配信のLPをこの画面に直接置いていて、パソコンの画面の広さで決まっていた）
  //   - LP の CSS がこの画面に漏れ出さないようにするため
  //   - sandbox でスクリプトを**実行させない**ため（計測タグも動かない。外部LPはサーバー側の除去と合わせて二重の防御）
  // 指示: 「LPの画面に関しては元のLPの画面そのまま使う」。
  // 実LPを取得できているなら、どの列でもそれを背景にする（サンプルLPでは位置が合わない）。
  const lp = document.createElement('iframe')
  lp.className = 'hm-lp'
  // スマホ枠いっぱい。縮小はせず、枠の中だけをスクロールさせる（実物と同じ）。
  lp.style.width = `${SP_WIDTH}px`
  lp.style.height = `${FRAME_HEIGHT}px`
  lp.style.border = '0'
  // allow-scripts は与えない＝中のJSは動かない。allow-same-origin は
  // 高さ測定とスクロール操作のため。
  // （危険なのは allow-scripts と allow-same-origin の**同時**指定で、これは該当しない）
  lp.setAttribute('sandbox', 'allow-same-origin')
  lp.setAttribute('referrerpolicy', 'no-referrer')
  lp.srcdoc =
    deps.externalHtml ?? buildHeatmapLpDocument({ html: spec.html, css: spec.css, styleCss: deps.styleCss })
  const overlay = document.createElement('div')
  overlay.className = 'hm-overlay'
  canvas.append(lp)
  // 実物では到達ラインは動かず、押すとLPだけが裏でその位置までスクロールする。
  // だから overlay は canvas（＝スクロールする中身）の中に入れず、
  // sticky で列の上端に貼り付けておく（高さ0なので場所は取らない）。
  body.append(overlay, canvas)

  /** LPの中身をスクロールさせる（iframe の中の window）。 */
  const lpScroller = (): { top: number; max: number; to: (y: number) => void } => {
    const win = lp.contentWindow
    const h = lp.contentDocument?.documentElement.scrollHeight ?? 0
    return {
      top: win?.scrollY ?? 0,
      max: Math.max(0, h - (win?.innerHeight ?? FRAME_HEIGHT)),
      to: (y) => win?.scrollTo({ top: y, behavior: 'smooth' }),
    }
  }
  /**
   * LPを枠に収める倍率。スマホは等倍（実物どおり375pxの枠）。
   * PCは980pxの画面として組んだLPを、375pxの枠に縮めて見せる（2026-09-25）。
   * 以前は縮めずに980pxのまま375pxの枠に入れていて、LPの左の一部しか見えていなかった。
   */
  let scale = 1
  const applyScale = (): void => {
    scale = SP_WIDTH / (parseFloat(lp.style.width) || SP_WIDTH)
    lp.style.transform = scale === 1 ? '' : `scale(${scale})`
    // 縮めた枠が、見た目で枠いっぱい（667px）になる高さ
    if (!deps.fullPage) lp.style.height = `${FRAME_HEIGHT / scale}px`
  }

  /**
   * 全ページ表示: 枠をLPの高さまで伸ばして、LPを全部見せる（2026-09-25）。
   * 以前は外側の枠の高さ固定を外すだけで、LPの枠（iframe）は667pxのままだった＝何も変わらなかった。
   * 高さは枠いっぱいの高さで測る（画面の高さに合わせて伸びるLPを、伸ばした枠で測り直し続けないため）。
   */
  const fitFullPage = (): void => {
    if (!deps.fullPage) return
    lp.style.height = `${FRAME_HEIGHT / scale}px`
    const height = lp.contentDocument?.documentElement.scrollHeight ?? 0
    if (height <= 0) return
    lp.style.height = `${height}px`
    canvas.style.height = `${height * scale}px`
  }
  lp.addEventListener('load', () => {
    fitFullPage()
    drawOverlay()
  })

  /**
   * 実物の到達ラインは **5%刻みの21行**（0%,5%,…,100%）で、行の位置はLPの高さと無関係に
   * 上から30px間隔で並ぶ。行を押すとLPだけがその深さまでスクロールし、押した行が
   * 黒地オレンジ字になって、右のバッジにその深さ（例: 55%）が出る。
   * 採取した実DOM（arrivalLine / scrollPosition）に合わせている。
   * 全ページ表示のときは、LP全体が見えているので、線はLPの本当の深さの位置に置く。
   */
  const ROW_STEP = 30
  const ROW_TOP = 10
  let activeRow = 0

  /** 線の縦位置（px）。全ページ表示ならLPの深さそのもの、スクロール表示なら30px刻み */
  const rowTop = (row: number, lpHeight: number): number => {
    if (!deps.fullPage || lpHeight <= 0) return ROW_TOP + row * ROW_STEP
    const shown = lpHeight * scale
    return Math.min(shown - ROW_TOP, Math.max(ROW_TOP, (row / (ROW_COUNT - 1)) * shown))
  }

  /** 行を押したときに、スマホ枠の中のLPをその深さまで送る（全ページ表示では全部見えているので送らない） */
  const scrollLpTo = (depth: number): void => {
    if (deps.fullPage) return
    const sc = lpScroller()
    if (sc.max <= 0) return
    sc.to(sc.max * depth)
  }

  const drawOverlay = (): void => {
    overlay.innerHTML = ''
    // 何を合算しているかの表示は、描き直すたびに戻す（下でCV用の文言に差し替わるため）
    note.textContent = scopeNote
    if (isCv) {
      // CVの列は、申し込んだ人だけのヒートマップ（2026-09-25）。何人ぶんの記録かを名乗る
      note.textContent = `${scopeNote}・申し込んだ人だけ（${stat?.pv ?? 0}人）`
    }
    const mode = lineSelect.value as LineMode
    // SP / PC の切り替えで差し替わるので、描くあいだは手元に固定する
    const shownStat = stat
    const doc = lp.contentDocument
    const hasData = shownStat !== null && shownStat.pv > 0 && mode !== 'none'

    // 熱の色。LPが読めなくなるので薄く敷く（実物もLPの絵柄がはっきり見える）。
    // 面は行（5%刻み21段）より**細かく**出す。行は読むための目盛りで、
    // 面は「そのあたりが実際どれだけ見られたか」を連続的に表すものなので、
    // 集計しているバンド数ぶんの色停止点をそのまま使う。
    // そのLPに実際に出ている最小〜最大へ色相を目一杯割り当てる。
    // こうしないと「26%〜74%しか無いLP」で色がほとんど変化せず、
    // 一面が同じ色に見えてどこが読まれたのか分からない。
    let stops: { at: number; color: string }[] | null = null
    if (hasData) {
      const bands = shownStat.bands
      const raw = Array.from({ length: bands }, (_, i) => bandStrength(shownStat, mode, i))
      const present = raw.filter((v): v is number => v !== null)
      const lo = present.length > 0 ? Math.min(...present) : 0
      const hi = present.length > 0 ? Math.max(...present) : 1
      const span = hi - lo
      const norm = (x: number): number => (span < 1e-6 ? 1 : (x - lo) / span)
      stops = raw.flatMap((v, i) =>
        v === null ? [] : [{ at: (i + 0.5) / bands, color: bandColor(spec.metric, norm(v)) }],
      )
    }
    // 面と点は LP の中に重ねる（LPと一緒にスクロールし、深さがLPの高さと合う）。
    // クリック数モードのときは実際の座標も打つ（帯だけだと横位置が分からない）
    const lpHeight =
      doc?.documentElement === undefined || doc === null
        ? 0
        : paintLpLayer(doc, {
            stops,
            dots: hasData && mode === 'elementClick' ? shownStat.clicks.slice(-400) : [],
            dotColor: bandColor(spec.metric, 0.9),
            // PCはLPを縮めて見せるので、点は画面で10pxに見える大きさにする
            dotSize: 10 / scale,
            hideHeat: col.classList.contains('no-heat'),
          })
    if (!hasData) return

    for (let row = 0; row < ROW_COUNT; row++) {
      const v = rowValue(shownStat, mode, row)
      if (v === null) continue
      const pill = document.createElement('button')
      pill.type = 'button'
      pill.className = `hm-pill${row === activeRow ? ' on' : ''}${v.isZero ? ' zero' : ''}`
      pill.style.top = `${rowTop(row, lpHeight)}px`
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
    depth.style.top = `${rowTop(activeRow, lpHeight)}px`
    depth.textContent = `${Math.round((activeRow / (ROW_COUNT - 1)) * 100)}%`
    overlay.append(depth)
  }

  lineSelect.addEventListener('change', drawOverlay)

  col.append(head, body)
  const empty = document.createElement('div')
  empty.className = 'hm-empty'
  empty.style.whiteSpace = 'pre-line'
  const paintEmpty = (): void => {
    if (stat !== null && stat.pv > 0) {
      empty.remove()
      return
    }
    // PVがあるのに空だと「壊れている」と読めてしまう。実際の理由は
    // 「位置の記録は離脱時に1回だけ送られる」ため、それ以前のPVには位置が無いこと。
    // 自前配信のLPには計測タグが最初から入っているので「タグを貼れ」とは言わない。
    const seen = isShared ? deps.totals.pv : spec.pv
    empty.textContent = isCv
      ? [
          '申し込んだ人のヒートマップはまだありません。',
          '計測リンクを押して申し込んだ人の、',
          'LPを離れたときの位置の記録が、ここに貯まります。',
          '（2026-09-25 から記録しています）',
        ].join('\n')
      : isShared
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
    body.prepend(empty)
  }
  paintEmpty()

  /**
   * SP / PC の切り替え（2026-09-24・点検29）。その端末の記録を読み直して、面・見出し・断り書きを描き直す。
   * 広告で絞った列は端末ごとの記録が無いので、数字は変えずにそうと書く。
   */
  const switchDevice = async (device: 'sp' | 'pc'): Promise<void> => {
    const param = spec.param ?? ''
    if (deps.loadDevice === undefined) return
    if (param !== '') {
      paintExtraNotes(deviceNoteLines({ device, param, coverage: null, since: null }))
      return
    }
    try {
      const data = await deps.loadDevice(device)
      stat = pickStat(isCv ? (data.cvVersions ?? []) : data.versions)
      isShared = stat !== null && stat.version_uid === ''
      scopeNote = isShared ? `${scope}・外部LP（Version区別なし）` : scope
      const row = data.rows.find((r) => r.entity_uid === spec.versionUid)
      headSource = {
        spec: { ...spec, pv: row?.pv ?? 0, ctr: row?.ctr ?? null, cv: row?.cv ?? 0 },
        totals: data.totals,
      }
      // CVの列は、申し込んだ人の人数で断る（全員の PV ではなく）
      const pool = isCv ? (data.cvCoverage ?? []) : data.coverage
      const coverage = pool.find((c) => c.version_uid === (isShared ? '' : spec.versionUid)) ?? null
      paintHeadStats()
      paintExtraNotes(deviceNoteLines({ device, param, coverage, since: data.since, unit: isCv ? '人' : 'PV' }))
      paintEmpty()
      drawOverlay()
    } catch (error) {
      // 読めなかったことを隠さない（全端末の数字のまま、そうと書く）
      paintExtraNotes([
        `${device === 'sp' ? 'SP' : 'PC'}の記録を読み込めませんでした（${error instanceof Error ? error.message : '通信エラー'}）。全端末の数字のままです。`,
      ])
    }
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
  // 最初に選ばれているのは SP（採取物のまま）。数字も SP の記録で出す
  void switchDevice('sp')
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
  // 「全ページ表示」のときは枠の高さ固定を外す（以前は fullPage を受け取るだけで使っていなかった）
  wrap.className = deps.fullPage ? 'hm-cols full' : 'hm-cols'
  for (const spec of specs) wrap.append(buildColumn(spec, deps))
  host.append(wrap)
}
