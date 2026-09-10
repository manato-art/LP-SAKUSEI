/**
 * メディア（商品検索フォーム）のテンプレート。
 *
 * 実SB「ツール > メディア > メディア一覧 > 新規作成 > テンプレートから選択」を
 * 2026-09-10 に実機で開き、6種それぞれが生成する項目を読み取ったもの。
 *
 * ## 実物から変えた2点（そのまま持ち込まなかったもの）
 * 1. 「美容系２」の1項目めは実物では**個人名**が入っていた（誰かが編集した跡）。
 *    実データを持ち込まない規約（企画書 §13-E）に反するので、
 *    選択肢の中身に合う「お悩み」という名前にしている。
 * 2. 「都道府県」は実物の一覧に **東京県** という誤字があり、**群馬県が抜けて**いた（46件）。
 *    そのまま写すと、これを使って作ったLPに誤りが伝播するので47都道府県を正しく入れた。
 */

/** 項目の見せ方（実物のプルダウンのまま） */
export type MediaFieldType = 'button' | 'select_box' | 'min_max' | 'check_box'

/** 商品への選択肢の紐付け（実物のプルダウンのまま） */
export type MediaFieldLink = 'single' | 'multiple'

export interface MediaField {
  name: string
  type: MediaFieldType
  link: MediaFieldLink
  /** 先頭の「こだわらない」は実物と同じく常に付く */
  options: string[]
}

export interface MediaTemplate {
  id: string
  name: string
  fields: MediaField[]
}

const ANY = 'こだわらない'

/** 地方（求人・転職で共通） */
const REGIONS = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州']

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

const YES_NO = ['あり', 'なし']

function field(name: string, link: MediaFieldLink, options: string[]): MediaField {
  return { name, type: 'button', link, options: [ANY, ...options] }
}

export const MEDIA_TEMPLATES: readonly MediaTemplate[] = [
  {
    id: 'beauty2',
    name: '美容系２',
    fields: [
      field('お悩み', 'single', ['エイジングケア', 'ダイエット', '美容', 'ニオイケア', 'ホワイトニング']),
      field('ジャンル', 'single', ['サプリメント', '機能性表示食品', 'ドリンク', '化粧品', '医薬部外品']),
      field('こだわり', 'single', [
        'コンプレックス解消したい',
        '短期間で効果を出したい',
        '健康的に解決したい',
        '若々しく見られたい',
        '見た目から美しくなりたい',
        'じっくり効果を出したい',
      ]),
      field('価格', 'single', [
        '500円未満',
        '500円以上1000円未満',
        '1,000円以上2,000円未満',
        '2,000円以上5,000円未満',
        '5,000円以上10,000円未満',
        '10,000円以上',
      ]),
      field('送料無料', 'single', YES_NO),
      field('返金', 'single', YES_NO),
      field('特典', 'single', YES_NO),
      field('年代別', 'multiple', [
        '20代におすすめ',
        '30代におすすめ',
        '40代におすすめ',
        '50代におすすめ',
      ]),
    ],
  },
  {
    id: 'beauty1',
    name: '美容系１',
    fields: [field('ジャンル', 'multiple', ['シャンプー', '育毛剤'])],
  },
  {
    id: 'job_fixed',
    name: '求人（項目固定）',
    fields: [
      field('地域', 'multiple', REGIONS),
      field('性別', 'multiple', ['男性', '女性']),
      field('年代', 'multiple', ['10代', '20代', '30代', '40代', '50代', '60代以上']),
      field('資格', 'multiple', ['普通運転免許', '語学', '大卒以上', '高卒以上']),
    ],
  },
  {
    id: 'job_editable',
    name: '転職（選択肢編集可）',
    fields: [
      field('勤務地', 'multiple', REGIONS),
      field('性別', 'multiple', ['男性', '女性']),
      field('年代', 'multiple', ['10代', '20代', '30代', '40代', '50代', '60代']),
      field('資格', 'single', ['普通運転免許', '高卒以上', '大卒以上']),
    ],
  },
  {
    id: 'web_meeting',
    name: 'web会議用ツール',
    fields: [
      field('Wi-Fi', 'single', ['ダイレクト＆ルーター経由', 'ルーター経由のみ']),
      field('日本人による使い方のサポート', 'single', YES_NO),
      field('保障', 'single', YES_NO),
      field('ルーターが無い場所でも単体で利用可能', 'single', ['可能', '不可']),
    ],
  },
  {
    id: 'prefecture',
    name: '都道府県',
    fields: [field('都道府県', 'multiple', PREFECTURES)],
  },
]

export function findMediaTemplate(id: string): MediaTemplate | undefined {
  return MEDIA_TEMPLATES.find((t) => t.id === id)
}
