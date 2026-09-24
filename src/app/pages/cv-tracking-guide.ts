/**
 * CV計測連携の案内文（純粋関数）。
 *
 * 実物のSquadBeyondは「連携を申請する」でサポートへ申請が飛ぶが、このシステムには
 * 外部サービスとサーバー同士でつなぐ連携も、申請を受け付ける窓口も無い。
 * 押して「受け付けました」と出すのは嘘になるので、このシステムで実際にCVを数える手順を出す。
 *
 * AFFILICODE だけは、一括タグの「計測ツール・ASP」で選ぶと配信時にLP内リンクへ
 * squadbeyond_uid / sb_tracking=true / sb_article_uid を付ける（mock-server/routes/delivery.ts）。
 * それ以外のサービスには何も自動で付かない。
 */
export interface CvTrackingGuide {
  lead: string
  steps: string[]
}

export function cvTrackingGuide(service: string): CvTrackingGuide {
  const steps = [
    'ページ一覧でページを選び、右の詳細にある「外部LP計測タグを発行」を開く',
    `②の「CV計測タグ」をコピーし、${service}側の申込完了（サンクス）ページに貼る`,
    '完了ページがLPと別のドメインなら、③の受け渡しタグを広告主サイトの最初のページにも貼る',
    'LPの計測リンクを押した人が完了ページまで進むと、そのページのCVとして数えられる',
  ]
  if (service === 'AFFILICODE') {
    steps.push(
      '一括タグの「計測ツール・ASP」で AFFILICODE を選ぶと、配信するLP内のリンクに squadbeyond_uid / sb_tracking=true / sb_article_uid が付きます',
    )
  }
  return {
    lead: `このシステムには、${service} と自動でつなぐ連携や申請の窓口はありません。CVは次の手順で数えます。`,
    steps,
  }
}
