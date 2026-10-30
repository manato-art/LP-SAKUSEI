/**
 * Widget編集の見たまま画面（ポップアップの中身も同じ画面）で、Ctrl/⌘＋クリックの動作確認をしたリンクのボタンの開く先
 * （2026-10-30 本人「ここに入れたリンクに移行できない」）。
 *
 * 動作確認でも編集画面からは離れない（指示156・見本のスクリプトが location.href を書き換える型がある）ので、
 * リンクは止めたままで、リンク先を入れて押してもどこへも移らなかった。
 * 外のページ（http・https）へのリンクだけ、新しいタブで開く（編集画面はそのまま残る）。次は開かない:
 *  - 押すと見本の中で画面が切り替わる・小窓を出すなどのボタン（配信でも見本のスクリプトが止め、リンク先へは移らない）
 *  - # や javascript:、相対のURL（編集画面の住所で開いてしまい、配信で移る先と違う所になる）
 */

/** 押したら見本の中で動く印（templates/screens-script.ts・press-actions.ts が拾う物） */
const IN_WIDGET_PRESS = '[data-nc-go],[data-nc-pop],[data-nc-modal],[data-nc-scroll],[data-nc-copy],[data-nc-close]'

export interface TestLinkAnchor {
  getAttribute(name: string): string | null
  closest(selector: string): unknown
}

/** 新しいタブで開くリンク先。開かないボタンなら null */
export function testLinkUrl(anchor: TestLinkAnchor): string | null {
  if (anchor.closest(IN_WIDGET_PRESS) !== null) return null
  const href = (anchor.getAttribute('href') ?? '').trim()
  return /^https?:\/\//i.test(href) ? href : null
}
