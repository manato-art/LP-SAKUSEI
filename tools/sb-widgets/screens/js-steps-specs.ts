/**
 * スクリプトで1問ずつ出していく見本のうち、画面①②③に分ける15個の決まり（js-steps.ts が使う）。
 *
 * 2026-10-27 本人選択「答えて進むだけの物だけ分ける」（点数・分岐で結果が変わる物はSBのまま・分ける前に1つずつ中身を確かめる）。
 * 編集画面で展開して見える「1問ずつ進むアンケート・診断」45個を1つずつ読んで、答える（または次へを押す）と次の問いが出るだけの物を選んだ。
 * 分けなかった物と理由は docs/Widget編集.md「取り込んだ見本」に書いた。
 */

export interface JsStepSpec {
  readonly id: number
  /** 画面1つ分の要素（上から順に）。問いのあとの結果なども含める。親が違う物は、最初の要素の親へ移す */
  readonly steps: string
  /** 押すと次の画面へ（その画面の中で探す）。先に書いた方が見つかった画面ではそれだけ使う（「次へ」がある問いは選択肢では進まない） */
  readonly next: readonly string[]
  /** 押すと前の画面へ */
  readonly back?: string
  /** 出方: stack＝下に積み重ねる（前の問いが残る）／none＝入れ替える／slide＝横から */
  readonly transition: 'stack' | 'none' | 'slide'
  /** 見本自身のスクリプト（問いを隠す・次を出す）。中身か読み込み先で見分けて外す */
  readonly script: RegExp
  /** 隠す・SBの編集画面で全部見せるのに使っていた印（class）。画面にしたので外す */
  readonly unhide?: readonly string[]
  /** 答えると出ていた続き（解説・画像・動画）。次の画面の頭へ移す（最後の問いの分は、結果の画面を足して入れる） */
  readonly carry?: string
  /** 移した続きの中から外す物（続きの中の「次へ」など。選ぶと進むようにしたので要らない） */
  readonly carryDrop?: string
  /** 問いと問いのあいだにある「次へ」の箱。すぐ前の問いの中へ入れる */
  readonly attach?: string
  /** 外す物 */
  readonly remove?: string
  /** 最初は押せない「次へ」（選ぶと見本のスクリプトが押せるようにしていた）。スクリプトを外したので、はじめから押せるようにする */
  readonly enable?: string
  /** 最初・最後の画面の呼び名（無ければ「設問①」…） */
  readonly firstName?: string
  readonly lastName?: string
}

export const JS_STEP_SPECS: readonly JsStepSpec[] = [
  // 回答後に次の設問に切り替わるアンケート（選ぶと入れ替わる）
  { id: 16257, steps: '.question-item', next: ['.select-item input'], transition: 'none', script: /sbChangeScreenQuestionnaire/, unhide: ['is-hidden'] },
  // 設問に回答して次の設問を表示するアンケート（次へで下に続ける・最後は内容）
  { id: 12490, steps: '.widget-item', next: ['.widget-item-button button'], transition: 'stack', script: /sbQuestionnaireSimple/, lastName: '結果' },
  // 同（単一・複数選択。単一は選ぶと進む）
  { id: 12934, steps: '.widget-item', next: ['.widget-item-button button', '.radiobox-item input'], transition: 'stack', script: /sbQuestionnaireSimple/, lastName: '結果' },
  // 同（単一選択・選ぶと下の文と次へが出る→次へで入れ替わる）。下の文は次の画面の頭へ
  {
    id: 13015,
    steps: '.widget-item',
    next: ['.radiobox-item input'],
    transition: 'none',
    script: /sbQuestionnaireSwitchingSimple/,
    carry: '.widget-item-footer',
    carryDrop: '.widget-item-button',
    lastName: '結果',
  },
  // アンケート（回答後次の設問表示）: はじめる→Q1→…→結果（下に続ける）
  { id: 10966, steps: '.introduction, .wrap-question, .wrap-result', next: ['.js-display-change'], transition: 'stack', script: /sbDisplayChange/, firstName: 'はじめ', lastName: '結果' },
  // アンケート（回答後に次設表示、単一＆複数）
  {
    id: 15921,
    steps: '.questionTextBase__content, .complete__content',
    next: ['button[type="submit"]', 'input[type="radio"]'],
    transition: 'stack',
    script: /questionTextFunc/,
    unhide: ['is-hidden', 'EDITABLE'],
    lastName: '結果',
  },
  // シンプルアンケート（回答後に次の設問表示、最終設問はiframe）
  { id: 16163, steps: '.simpleQuestion__box', next: ['input'], transition: 'stack', script: /sinpleQuestionFunc/, unhide: ['is-hidden', 'EDITABLE'] },
  // 画像と選択肢のシンプルのアンケート（答えると下に画像・動画→次の問い）
  {
    id: 19249,
    steps: '.image-question-steps > .question',
    next: ['.next .btn', 'input'],
    transition: 'stack',
    script: /sbImageQuestion20260901/,
    carry: '.after-content',
    enable: '.next .btn',
    lastName: '結果',
  },
  // 選択肢が画像のアンケート 回答後続きのコンテンツ表示
  { id: 12785, steps: '.widget-item', next: ['input'], transition: 'stack', script: /sbImageSelectQuestionnarire/, lastName: '結果' },
  // 画像付きアンケート（回答後に次へボタン表示）: 次へは前の問いの中へ
  { id: 16038, steps: '.wrap-question', next: ['.btn-next'], transition: 'stack', script: /sbDisplayChange/, attach: '.wrap-next', lastName: '結果' },
  // 設問に回答して次の設問を表示するアンケート（画像設問・複数選択・回答後に結果表示）
  { id: 20428, steps: '.widget-item', next: ['.widget-item-button button', 'input'], transition: 'stack', script: /sbStepwiseSurvey20261009/, lastName: '結果' },
  // チェックして次に進むアンケート（最後は結果の動画）
  {
    id: 12862,
    steps: '.widget-item, #js-check-questionnarie-result',
    next: ['input'],
    transition: 'stack',
    script: /sbCheckQuestionnarier/,
    unhide: ['EDITABLE'],
    lastName: '結果',
  },
  // 横スライド式アンケート（戻るあり・最後は結果）
  {
    id: 9946,
    steps: '.scroll-question-item, .scroll-question-result',
    next: ['.next-btn', 'input[type="radio"]'],
    back: '.scroll-question-back .btn',
    transition: 'slide',
    script: /sbSlideQuestion/,
    lastName: '結果',
  },
  // 回答後に次の質問または指定コンテンツ表示（答えると下に続き→次の問い・最後は紙吹雪の続き）
  {
    id: 10059,
    steps: '.image-question-item',
    next: ['input'],
    transition: 'stack',
    script: /sbAnserMultiDisplay|confetti/,
    unhide: ['set'],
    carry: '.next-content',
    lastName: '結果',
  },
  // 回答後に隠しコンテンツ表示（答えると解説→次へ）。解説は次の画面の頭へ・選ぶと進む
  {
    id: 15922,
    steps: '.multi-poll-item, .result-content',
    next: ['input'],
    transition: 'stack',
    script: /sbMultiPoll20250423/,
    unhide: ['hidden'],
    carry: '.hidden-content',
    remove: '.next-btn',
    lastName: '結果',
  },
]
