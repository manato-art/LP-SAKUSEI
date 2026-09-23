/**
 * 型「カウントダウン」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 終わり方は2つ: 決まった日時（日本時間）で終わる／見た人ごとに「初めて見てから◯時間」。
 * 終わったら文字を出すか、このWidgetを隠す。
 *
 * ⚠️ スクリプトの作り（どれも実際に起きうる事故を避けるため）
 *  - 入力は一切スクリプトに入れない。設定は外側の data-nc-* から読む（KB xss-onclick-esc）
 *  - 「動かし始めた」目印は要素のプロパティに持つ（属性に書くと、Widget編集の見たまま画面で動いた状態が
 *    コード欄へ書き出されて保存され、LPで「もう動いている」と見なされて止まる）
 *  - 編集中の本文（.ql-editor）の中では動かさない（毎秒書き換わると編集中の本文が変わり続ける）
 *  - 動く前（スクリプトが無い所）でも締切の日時は文字で読める
 */
import { baseCss, esc, safeColor, shade, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, int, pick, str, type NocodeTemplate } from './types.ts'
import { COUNTDOWN_AFTER_ICONS, COUNTDOWN_MODE_ICONS } from './option-icons.ts'

const MODES = ['fixed', 'evergreen'] as const
const AFTERS = ['message', 'hide'] as const
const DEADLINE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const
const JST_OFFSET_MS = 9 * 3600 * 1000

/** 'YYYY-MM-DDTHH:MM'（日本時間）→ その時刻（ms）。形が違えば NaN */
function deadlineMs(value: string): number {
  const m = DEADLINE.exec(value)
  if (m === null) return Number.NaN
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number]
  return Date.UTC(y, mo - 1, d, h, mi) - JST_OFFSET_MS
}

/** 「9月30日（水）23:59まで」 */
function deadlineLabel(value: string): string {
  const m = DEADLINE.exec(value)
  if (m === null) return ''
  const [, y, mo, d] = m.map(Number) as [number, number, number, number]
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()] ?? ''
  return `${mo}月${d}日（${weekday}）${m[4]}:${m[5]}まで`
}

/** 今から7日後の23:59（日本時間）を 'YYYY-MM-DDTHH:MM' で */
function weekLater(now: Date): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS + 7 * 24 * 3600 * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T23:59`
}

/** 固定の文（入力の文字は入らない）。ES5 で書く（古いスマホのブラウザでも動くように） */
export const COUNTDOWN_SCRIPT = `(function(){
var roots=document.querySelectorAll('[data-nc-countdown]');
for(var i=0;i<roots.length;i++)start(roots[i]);
function start(root){
if(root.__ncCountdown)return;
if(root.closest&&root.closest('.ql-editor'))return;
root.__ncCountdown=true;
var end=NaN;
if(root.getAttribute('data-nc-countdown')==='evergreen'){
var hours=Number(root.getAttribute('data-nc-hours'))||24;
var key='nc-countdown:'+(root.getAttribute('data-nc-key')||'');
var first=0;
try{first=Number(window.localStorage.getItem(key))||0;if(!first){first=Date.now();window.localStorage.setItem(key,String(first));}}catch(e){first=Date.now();}
end=first+hours*3600000;
}else{end=Date.parse(root.getAttribute('data-nc-deadline')||'');}
var time=root.querySelector('.nc-cd__time');
var done=root.querySelector('.nc-cd__done');
var hide=root.getAttribute('data-nc-after')==='hide';
var dayUnit=root.querySelector('[data-nc-part="d"]');
var nums={};var parts=['d','h','m','s'];
for(var j=0;j<parts.length;j++)nums[parts[j]]=root.querySelector('[data-nc-part="'+parts[j]+'"] .nc-cd__num');
var timer=0;
function pad(n){return n<10?'0'+n:String(n);}
function set(part,text){if(nums[part])nums[part].textContent=text;}
function finish(){
if(timer)window.clearInterval(timer);
if(hide){root.hidden=true;return;}
if(time)time.hidden=true;
if(done)done.hidden=false;
}
function tick(){
var left=end-Date.now();
if(!(left>0)){finish();return;}
var sec=Math.floor(left/1000);
var d=Math.floor(sec/86400);sec-=d*86400;
var h=Math.floor(sec/3600);sec-=h*3600;
var m=Math.floor(sec/60);sec-=m*60;
if(dayUnit)dayUnit.hidden=d===0;
set('d',String(d));set('h',pad(h));set('m',pad(m));set('s',pad(sec));
}
root.hidden=false;
if(time)time.hidden=false;
if(done)done.hidden=true;
if(isNaN(end))return;
tick();
timer=window.setInterval(tick,1000);
}
})();`

const UNITS: readonly (readonly [string, string])[] = [
  ['d', '日'],
  ['h', '時間'],
  ['m', '分'],
  ['s', '秒'],
]

export const COUNTDOWN_TEMPLATE: NocodeTemplate = {
  id: 'countdown',
  name: 'カウントダウン',
  summary: 'キャンペーンの締切までの残り時間を、秒まで動かして見せます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
  fields: [
    { kind: 'text', key: 'title', label: '上の文字', placeholder: 'キャンペーン終了まで' },
    {
      kind: 'select',
      key: 'mode',
      label: '終わりの決め方',
      options: [
        { value: 'fixed', label: '決まった日時で終わる', short: '決まった日時', icon: COUNTDOWN_MODE_ICONS.fixed },
        { value: 'evergreen', label: '見た人ごとに（初めて見てから◯時間）', short: '見た人ごと', icon: COUNTDOWN_MODE_ICONS.evergreen },
      ],
    },
    { kind: 'datetime', key: 'deadline', label: '終わる日時（日本時間）', showIf: (d) => str(d, 'mode') !== 'evergreen' },
    {
      kind: 'number',
      key: 'hours',
      label: '初めて見てから何時間で終わるか',
      min: 1,
      max: 720,
      unit: '時間',
      note: '同じ人がもう一度開いても、最初に見た時から数えます（そのブラウザに覚えさせます）',
      showIf: (d) => str(d, 'mode') === 'evergreen',
    },
    {
      kind: 'select',
      key: 'after',
      label: '終わったあと',
      options: [
        { value: 'message', label: '文字を出す', icon: COUNTDOWN_AFTER_ICONS.message },
        { value: 'hide', label: 'このWidgetを隠す', short: '隠す', icon: COUNTDOWN_AFTER_ICONS.hide },
      ],
    },
    { kind: 'text', key: 'doneText', label: '終わったあとの文字', showIf: (d) => str(d, 'after') !== 'hide' },
    { kind: 'color', key: 'color', label: '数字の色', presets: ACCENT_PRESETS },
  ],
  defaults: (now) => ({
    title: 'キャンペーン終了まで',
    mode: 'fixed',
    deadline: weekLater(now),
    hours: 24,
    after: 'message',
    doneText: 'このキャンペーンは終了しました',
    color: '#E5573F',
  }),
  validate: (data, now) => {
    if (pick(data, 'mode', MODES, 'fixed') === 'evergreen') return null
    const deadline = str(data, 'deadline')
    if (deadline === '') return '終わる日時を入れてください'
    const at = deadlineMs(deadline)
    if (Number.isNaN(at)) return '終わる日時の形が正しくありません'
    if (at <= now.getTime()) return '終わる日時が過ぎています。これから先の日時にしてください'
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')
    const dark = shade(color, -0.35)
    const mode = pick(data, 'mode', MODES, 'fixed')
    const after = pick(data, 'after', AFTERS, 'message')
    const deadline = str(data, 'deadline')
    const validDeadline = DEADLINE.test(deadline)

    const css =
      baseCss(s) +
      `${s}{padding:20px 16px;text-align:center}` +
      `${s} .nc-cd__band{background:${shade(color, 0.9)};border-radius:14px;padding:18px 12px 16px}` +
      `${s} .nc-cd__title{margin:0 0 6px;font-size:16px;font-weight:800;color:${dark};text-wrap:balance}` +
      `${s} .nc-cd__time{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:4px 14px;` +
      `font-variant-numeric:tabular-nums}` +
      `${s} .nc-cd__unit{display:inline-flex;align-items:baseline;gap:3px}` +
      `${s} .nc-cd__num{font-size:38px;font-weight:800;line-height:1.15;color:${dark};letter-spacing:.02em}` +
      `${s} .nc-cd__label{font-size:13px;font-weight:700;color:#5B6572}` +
      `${s} .nc-cd__note{margin:8px 0 0;font-size:12.5px;color:#5B6572}` +
      `${s} .nc-cd__done{font-size:17px;font-weight:800;line-height:1.6;color:${dark};padding:6px 0}`

    const title = str(data, 'title').trim()
    const units = UNITS.map(
      ([part, label]) =>
        `<span class="nc-cd__unit" data-nc-part="${part}"><span class="nc-cd__num">--</span><span class="nc-cd__label">${label}</span></span>`,
    ).join('')
    const note = mode === 'fixed' && validDeadline ? `<p class="nc-cd__note">${esc(deadlineLabel(deadline))}</p>` : ''
    const doneText = str(data, 'doneText').trim() === '' ? '終了しました' : str(data, 'doneText').trim()
    const body =
      `<div class="nc-cd__band">` +
      (title === '' ? '' : `<p class="nc-cd__title">${esc(title)}</p>`) +
      `<div class="nc-cd__time" role="timer" aria-label="残り時間">${units}</div>` +
      note +
      (after === 'message' ? `<p class="nc-cd__done" hidden>${esc(doneText)}</p>` : '') +
      `</div>`

    const attrs =
      mode === 'evergreen'
        ? ` data-nc-countdown="evergreen" data-nc-hours="${int(data, 'hours', 1, 720, 24)}" data-nc-key="${uid}"`
        : ` data-nc-countdown="fixed" data-nc-deadline="${validDeadline ? `${deadline}:00+09:00` : ''}"`
    return wrapWidget({ uid, type: 'countdown', css, body, attrs: `${attrs} data-nc-after="${after}"`, script: COUNTDOWN_SCRIPT })
  },
}
