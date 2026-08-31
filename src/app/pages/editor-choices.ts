/**
 * beyondページ作成時の「エディターを選択（必須）」の選択肢。
 *
 * 値は D-011 で全1016ページをAPI走査して確定したもの:
 *   2 = beyondエディター（1013件） / 3 = HTMLエディター（3件） / 1 = 0件
 *
 * スワイプLPエディターは**利用実績が0件で、値が一度も観測できていない**。
 * 推測で番号を振ると、選んだ瞬間に壊れた値が保存される（実際に 3 = スワイプ と
 * 誤って振られており、HTMLエディターを選ぶと基本情報タブが「該当なし」と表示していた）。
 * そのため値は持たせず、選べるが保存はできない扱いにする。
 */
export interface EditorChoice {
  /** 保存する値。未観測のものは null（選べるが保存しない）。 */
  readonly value: number | null
  readonly label: string
  readonly note?: string
}

export const EDITOR_CHOICES: readonly EditorChoice[] = [
  { value: null, label: 'スワイプLPエディター（β）', note: '値が未観測のため選べません' },
  { value: 2, label: 'beyondエディター' },
  { value: 3, label: 'HTMLエディター', note: '今回のクローンでは未実装' },
]
