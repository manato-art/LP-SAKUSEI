import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { SCREENS_SCRIPT } from '../src/app/panels/nocode/templates/builder.ts'
import { rekeyUid } from '../src/app/panels/nocode/templates/kit.ts'
import { convertQuestionLink } from '../tools/widget-library-fix/screens/question-link.ts'
import { convertOnePerWidget } from '../tools/widget-library-fix/screens/one-per-widget.ts'
import { convertAccordionLink } from '../tools/widget-library-fix/screens/accordion-link.ts'
import { convertQuizBox } from '../tools/widget-library-fix/screens/quiz-box.ts'
import { convertMultiQuestions } from '../tools/widget-library-fix/screens/multi-questions.ts'

/**
 * 「次へ系」の見本を、押すと同じWidgetの中で次の画面へ瞬時に切り替わる形（画面①②…）に作り変える
 * （2026-09-22・本人の決定「全部を点検・次へ系は画面化」）。
 * LPに入れたあとも Widget編集の「編集する画面」で1画面ずつ直せる（data-nc-screens の決まりに合わせる）。
 */

const IMG = '<picture><img src="data:image/svg+xml,x" alt=""></picture>'
const doc = (body: string): string => `<html><head><style>#articlePartPreview{}</style></head><body><div class="MuiBox-root css-0"><div class="MuiBox-root css-0">${body}</div></div></body></html>`

/** 「リンクでアンケート（単一選択風、ファネルモード推奨）」と同じ形（1問だけ・答えは仮のリンク） */
const SINGLE = doc(
  `<script>var linkQuestionFunc = linkQuestionFunc || {}; (function(_){ _.init = function(){} })(linkQuestionFunc);</script>` +
    `<div class="questionLink">` +
    `<div class="progress"><div class="progress__item is-active"><span>Q1</span></div><div class="progress__item"><span>Q2</span></div><div class="progress__item"><span>Q3</span></div></div>` +
    `<div class="head"><div class="head__num">Q1</div><p class="head__text">質問が入ります</p></div>` +
    `<div class="image">${IMG}</div>` +
    `<div class="link"><a href="ooooo" class="link__button js-link">はい</a><a href="ooooo" class="link__button js-link">いいえ</a></div>` +
    `<div class="link"><a href="ooooo" class="link__button link__button--back">もどる</a></div>` +
    `</div><style>.questionLink{}</style>`,
)

/** 「リンクでアンケート（複数選択風、ファネルモード推奨）」と同じ形（2問目を見せている・選ぶまで次へを押せない） */
const MULTI = doc(
  `<script>var selectQuestionFunc = selectQuestionFunc || {};</script>` +
    `<div class="questionLink js-multi">` +
    `<div class="progress"><div class="progress__item"><span>Q1</span></div><div class="progress__item is-active"><span>Q2</span></div><div class="progress__item"><span>Q3</span></div></div>` +
    `<div class="head"><div class="head__num">Q2</div><p class="head__text">質問が入ります</p></div>` +
    `<div class="select js-check"><input type="checkbox" name="q2" id="q2-1"><label for="q2-1" class="select__button">選択肢1</label>` +
    `<input type="checkbox" name="q2" id="q2-2"><label for="q2-2" class="select__button">選択肢2</label></div>` +
    `<div class="link"><a href="ooooo" class="link__button link__button--next js-next is-disabled">次へ</a>` +
    `<a href="ooooo" class="link__button link__button--back">もどる</a></div>` +
    `</div>`,
)

function screensOf(html: string): Element[] {
  const { document } = parseHTML(html)
  const root = document.querySelector('[data-nc-screens]')
  if (root === null) return []
  return Array.from(root.children).filter((c) => c.hasAttribute('data-nc-screen'))
}

describe('リンクでアンケート（1問ずつ別ページへ飛ぶ形）→ 画面①②③', () => {
  it('問いの数（進み具合の Q1〜Q3）だけ画面を作り、LPで最初は1問目だけ見える', () => {
    const screens = screensOf(convertQuestionLink(SINGLE))
    expect(screens.map((s) => s.getAttribute('data-nc-screen'))).toEqual(['s1', 's2', 's3'])
    expect(screens.map((s) => s.getAttribute('data-nc-name'))).toEqual(['設問①', '設問②', '設問③'])
    expect(screens.map((s) => s.hasAttribute('hidden'))).toEqual([false, true, true])
  })

  it('画面ごとに「何問目か」を合わせる（進み具合の印・番号）', () => {
    const screens = screensOf(convertQuestionLink(MULTI))
    screens.forEach((screen, i) => {
      const items = Array.from(screen.querySelectorAll('.progress__item'))
      expect(items.map((item) => item.classList.contains('is-active'))).toEqual([0, 1, 2].map((k) => k === i))
      expect(screen.querySelector('.head__num')?.textContent).toBe(`Q${i + 1}`)
    })
  })

  it('答えのボタンは次の画面へ。最後の問いの答えは元のリンクのまま（リンク先を入れる）', () => {
    const screens = screensOf(convertQuestionLink(SINGLE))
    const answers = screens.map((s) => Array.from(s.querySelectorAll('.js-link')).map((a) => a.getAttribute('data-nc-go')))
    expect(answers).toEqual([
      ['s2', 's2'],
      ['s3', 's3'],
      [null, null],
    ])
    expect(screens[2]?.querySelector('.js-link')?.getAttribute('href')).toBe('ooooo')
  })

  it('「もどる」は前の画面へ。1問目には置かない（戻る先が無い・仮のリンクとして数えない）', () => {
    const screens = screensOf(convertQuestionLink(SINGLE))
    const back = (s: Element | undefined): Element | null | undefined => s?.querySelector('.link__button--back')
    expect(back(screens[0])).toBeNull()
    // 「もどる」だけが入っていた入れ物ごと外す（空の箱を残さない）
    expect(screens[0]?.querySelectorAll('.link')).toHaveLength(1)
    expect(back(screens[1])?.getAttribute('data-nc-go')).toBe('s1')
    expect(back(screens[2])?.getAttribute('data-nc-go')).toBe('s2')
  })

  it('複数選択の「次へ」も次の画面へ（選ぶまで押せないのは見本のまま）。選択肢の名前は画面ごとに別にする', () => {
    const screens = screensOf(convertQuestionLink(MULTI))
    expect(screens.map((s) => s.querySelector('.js-next')?.getAttribute('data-nc-go') ?? null)).toEqual(['s2', 's3', null])
    expect(screens[0]?.querySelector('.js-next')?.classList.contains('is-disabled')).toBe(true)
    const ids = screens.flatMap((s) => Array.from(s.querySelectorAll('input')).map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const screen of screens) {
      for (const label of Array.from(screen.querySelectorAll('label[for]'))) {
        expect(screen.querySelector(`#${label.getAttribute('for') ?? ''}`)).not.toBeNull()
      }
    }
    expect(screens.map((s) => s.querySelector('input')?.getAttribute('name'))).toEqual(['q1', 'q2', 'q3'])
  })

  it('切り替えのスクリプトをそのまま入れる（見本自身のスクリプトも残す）', () => {
    const out = convertQuestionLink(SINGLE)
    expect(out).toContain(SCREENS_SCRIPT)
    expect(out).toContain('linkQuestionFunc')
  })

  it('外側は「部品を積んで作る」と同じ決まり（入れるたびに名前を付け直せる・編集で画面を選べる）', () => {
    const html = convertQuestionLink(SINGLE)
    // 入れるたびに名前を付け直す（kit.ts の rekeyUid）が読める並び（class が先頭・次に data-nocode）
    expect(html).toMatch(/<div class="nc nc-sample nc-[a-z0-9]{8}" data-nocode="sample" data-nc-screens/)
    expect(rekeyUid(html, 'nc-zzzzzzzz')).toContain('class="nc nc-sample nc-zzzzzzzz"')
    const { document } = parseHTML(html)
    const root = document.querySelector('[data-nc-screens]')
    expect(root?.getAttribute('class')).toMatch(/^nc nc-sample nc-[a-z0-9]{8}$/)
    expect(root?.getAttribute('data-nocode')).toBe('sample')
    // 画面は「部品を積んで作る」と同じ nc-screen（見たまま編集で画面ごと複製しない・設問として二重に出さない）
    expect(screensOf(convertQuestionLink(SINGLE)).map((s) => s.getAttribute('class'))).toEqual(['nc-screen', 'nc-screen', 'nc-screen'])
  })

  it('作り変えは何度かけても同じ。形が違う見本は触らない', () => {
    const once = convertQuestionLink(SINGLE)
    expect(convertQuestionLink(once)).toBe(once)
    const other = doc('<div class="questionLink"><p>進み具合なし</p></div>')
    expect(convertQuestionLink(other)).toBe(other)
  })
})

/** 「フェードインするアンケート（1問ずつ）」と同じ形（1問ずつ別のWidgetに置き、「次へ」で次のWidgetを出す） */
const ONE_PER_WIDGET = doc(
  `<script>var fadeInAction = fadeInAction || {};</script>` +
    `<div class="fadein__area js-fadein -firstArea js-scrollAuto"><div class="question__area">` +
    `<div class="question__num__area"><p class="num"><span class="small">Q</span>1</p></div><p class="head">質問が入ります</p>` +
    `<div class="question__btn__area"><button class="ansBtn js-btn">回答1</button><button class="ansBtn js-btn">回答2</button></div>` +
    `</div></div>` +
    `<div class="fadein__area js-fadein">${IMG}<button class="nextBtn js-btn is-nextWidget">次へ</button></div>` +
    `<style>.fadein__area{}</style>`,
)

describe('フェードインするアンケート（1問ずつ・次のWidgetを出す形）→ 画面①②③', () => {
  it('3問ぶんの画面を作る。答えると下の続きが出るのは見本のまま、「次へ」で次の問いの画面へ', () => {
    const screens = screensOf(convertOnePerWidget(ONE_PER_WIDGET))
    expect(screens).toHaveLength(3)
    expect(screens.map((s) => s.querySelector('.is-nextWidget')?.getAttribute('data-nc-go') ?? null)).toEqual(['s2', 's3', null])
    // 答えのボタンは見本のまま（下の続きを出す）
    expect(screens[0]?.querySelector('.ansBtn')?.hasAttribute('data-nc-go')).toBe(false)
    // 最後の問いの「次へ」は、行き先が無いので置かない
    expect(screens[2]?.querySelector('.is-nextWidget')).toBeNull()
  })

  it('画面ごとに問いの番号を合わせる', () => {
    const screens = screensOf(convertOnePerWidget(ONE_PER_WIDGET))
    expect(screens.map((s) => s.querySelector('.num')?.textContent)).toEqual(['Q1', 'Q2', 'Q3'])
  })

  it('次のWidgetを探す「次へ」は、見本自身のスクリプトに渡さない（SBの外枠が無いので止まっていた）', () => {
    const out = convertOnePerWidget(ONE_PER_WIDGET)
    const { document } = parseHTML(out)
    // 画面の切り替えは押す前に受け取って止めるので、見本の「次へ」の処理は動かない。行き先の無い最後の「次へ」は置かない
    expect(document.querySelectorAll('[data-nc-go]')).toHaveLength(2)
    expect(document.querySelectorAll('.is-nextWidget')).toHaveLength(2)
    expect(out).toContain(SCREENS_SCRIPT)
    expect(convertOnePerWidget(out)).toBe(out)
  })
})

/** 「ステップを使用したアンケート」と同じ形（1問だけ・答えると下に続きと「次の質問へ」が出る・次は別のページ） */
const ACCORDION = doc(
  `<script>var sbAccordionLink = sbAccordionLink || {};</script>` +
    `<div class="accordion-link js-accordion-link"><div class="question"><p class="tag">Question</p>` +
    `<ol class="list-step"><li class="current">1</li><li>2</li><li>3</li></ol><p class="text">ここにテキスト</p>` +
    `<div class="list-inputs"><input type="radio" name="q1" id="q1-1"><label for="q1-1">選択①</label>` +
    `<input type="radio" name="q1" id="q1-2"><label for="q1-2">選択②</label></div></div>` +
    `<div class="result">${IMG}</div><div class="next-btn js-btn"><a href="ooooo" class="btn">次の質問へ</a></div></div>`,
)

describe('ステップを使用したアンケート（次の質問は別のページ）→ 画面①②③', () => {
  it('ステップの数だけ画面を作り、「次の質問へ」は次の画面へ（最後は元のリンク）', () => {
    const screens = screensOf(convertAccordionLink(ACCORDION))
    expect(screens).toHaveLength(3)
    expect(screens.map((s) => s.querySelector('.btn')?.getAttribute('data-nc-go') ?? null)).toEqual(['s2', 's3', null])
    expect(screens[2]?.querySelector('.btn')?.getAttribute('href')).toBe('ooooo')
  })

  it('画面ごとに「いまのステップ」の印と、選択肢の名前を合わせる', () => {
    const screens = screensOf(convertAccordionLink(ACCORDION))
    screens.forEach((screen, i) => {
      expect(Array.from(screen.querySelectorAll('.list-step li')).map((li) => li.classList.contains('current'))).toEqual([0, 1, 2].map((k) => k === i))
      expect(screen.querySelector('input')?.getAttribute('name')).toBe(`q${i + 1}`)
    })
    const once = convertAccordionLink(ACCORDION)
    expect(convertAccordionLink(once)).toBe(once)
  })
})

/** 「ページ遷移式アンケート（ボタンデザイン｜単一選択）」と同じ形（答えがそのまま次のページへのリンク・Q1〜Q5） */
const QUIZ = doc(
  `<div class="l-quizBox"><div class="quiz_cont_wrap"><ul class="flow-list">` +
    `<li class="flow-list_item current">Q1</li><li class="flow-list_item">Q2</li><li class="flow-list_item">Q3</li></ul>` +
    `<div class="quiz_cont"><div class="quiz_cont_item"><p class="quiz_cont_ttl"><span class="q_mark">Q2</span>テキスト</p>` +
    `<ul class="quiz_cont_select"><li class="quiz_cont_select_item"><a href="ooooo">A</a></li><li class="quiz_cont_select_item"><a href="ooooo">B</a></li></ul>` +
    `<p class="quiz_cont_progress"><span>1</span>/3</p></div></div></div></div>`,
)
/** 同じ形の複数選択（選ぶまで「次に進む」を押せない） */
const QUIZ_MULTI = doc(
  `<script>var checkInputState = checkInputState || {};</script>` +
    `<div class="l-quizBox js-check-input" data-max="2"><div class="quiz_cont_wrap"><ul class="flow-list">` +
    `<li class="flow-list_item current">Q1</li><li class="flow-list_item">Q2</li></ul>` +
    `<div class="quiz_cont"><div class="quiz_cont_item"><p class="quiz_cont_ttl"><span class="q_mark">Q1</span>テキスト</p>` +
    `<ul class="quiz_cont_select"><li><label><input type="checkbox"><span>A</span></label></li></ul>` +
    `<div class="wrap-btn-forword"><a href="ooooo" class="btn-forword js-check-input-link">次に進む</a></div>` +
    `<p class="quiz_cont_progress"><span>1</span>/2</p></div></div></div></div>`,
)

describe('ページ遷移式アンケート（答えるたびに別のページ）→ 画面①②…', () => {
  it('問いの数だけ画面を作り、答え（リンク）は次の画面へ。最後は元のリンク', () => {
    const screens = screensOf(convertQuizBox(QUIZ))
    expect(screens).toHaveLength(3)
    expect(screens.map((s) => Array.from(s.querySelectorAll('.quiz_cont_select a')).map((a) => a.getAttribute('data-nc-go')))).toEqual([
      ['s2', 's2'],
      ['s3', 's3'],
      [null, null],
    ])
  })

  it('画面ごとに、進み具合の印・問いの番号・「1/3」を合わせる', () => {
    const screens = screensOf(convertQuizBox(QUIZ))
    screens.forEach((screen, i) => {
      expect(Array.from(screen.querySelectorAll('.flow-list_item')).map((li) => li.classList.contains('current'))).toEqual([0, 1, 2].map((k) => k === i))
      expect(screen.querySelector('.q_mark')?.textContent).toBe(`Q${i + 1}`)
      expect(screen.querySelector('.quiz_cont_progress span')?.textContent).toBe(String(i + 1))
    })
  })

  it('複数選択の「次に進む」も次の画面へ（選ぶまで押せないのは見本のまま）', () => {
    const screens = screensOf(convertQuizBox(QUIZ_MULTI))
    expect(screens.map((s) => s.querySelector('.js-check-input-link')?.getAttribute('data-nc-go') ?? null)).toEqual(['s2', null])
    const once = convertQuizBox(QUIZ_MULTI)
    expect(convertQuizBox(once)).toBe(once)
  })
})

/** 「アンケート（テキスト・画像付きの複数パターン…）」と同じ形（問いが縦に並び、「次へ」がページの先頭へのリンク #） */
const MULTI_QUESTIONS = doc(
  `<script>var sbMultiQuestions = sbMultiQuestions || {};</script>` +
    [1, 2, 3]
      .map(
        (n) =>
          `<!--questions${n}--><div class="multi-questions js-multi-questions"><div class="questions-item">` +
          `<div class="questions-navi"><span class="questions-num${n === 1 ? ' current' : ''}">Q1</span><span class="questions-num${n === 2 ? ' current' : ''}">Q2</span><span class="questions-num${n === 3 ? ' current' : ''}">Q3</span></div>` +
          `<ul class="questions-choice"><li class="questions-choice-item"><span>選択肢</span></li></ul>` +
          `<div class="questions-next"><a href="${n === 3 ? 'ooooo' : '#'}" class="questions-next-btn">次へ</a></div></div></div><!--questions${n}-->`,
      )
      .join(''),
)

describe('縦に並んだ問いの「次へ」（# でページの先頭へ飛んでいた）→ 画面①②③', () => {
  it('問いの箱を1つずつ画面にし、「次へ」は次の画面へ。最後の「次へ」は元のリンク', () => {
    const screens = screensOf(convertMultiQuestions(MULTI_QUESTIONS))
    expect(screens).toHaveLength(3)
    expect(screens.map((s) => s.querySelectorAll('.js-multi-questions').length)).toEqual([1, 1, 1])
    expect(screens.map((s) => s.querySelector('.questions-next-btn')?.getAttribute('data-nc-go') ?? null)).toEqual(['s2', 's3', null])
    expect(screens[2]?.querySelector('.questions-next-btn')?.getAttribute('href')).toBe('ooooo')
    const once = convertMultiQuestions(MULTI_QUESTIONS)
    expect(convertMultiQuestions(once)).toBe(once)
  })
})
