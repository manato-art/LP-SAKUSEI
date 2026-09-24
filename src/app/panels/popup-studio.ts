/**
 * 離脱防止ポップ・追従型ポップの中身を、Widget編集と同じ画面で直す（2026-09-24・本人の決定
 * 「画面が色々あると分かりづらい。中身だけWidget編集で」「追従型も同じにする」）。
 *
 * 画面の組み立ては widget-studio.ts の mountStudio と同じ（左＝見え方・右＝部品・書式のツールバー・補助線…）。
 * 違うのは2つだけ:
 *   - 見たまま画面の枠: 離脱防止＝暗い地の上に最大500pxの箱／追従型の帯＝LPと同じ620px／追従型の角＝中身の幅
 *   - 右上のボタン: 「ポップアップに反映」＝書き出したHTMLを渡して保存（保存できたら閉じる）
 * ライブラリの見本・作成したWidget・お気に入りも部品に入れられる（2026-09-24 本人「やって」）。
 * ポップアップの画面にはLPの編集が無いので、ライブラリは「見本を選ぶだけ」で開く（LPへ入れる入口は出さない）。
 * 名前・配信・表示条件・位置・出し分けは、今までどおりポップアップの編集画面で直す。
 */
import { api } from '../api.ts'
import { closeWidgetStudio, mountStudio } from './widget-studio.ts'
import type { PreviewFrame } from './widget-visual-editor.ts'
import { popupStudioStart } from './popup-studio-start.ts'

export interface PopupStudioOptions {
  readonly html: string
  /** 追従型の CSS（離脱防止は HTML の中に <style> で持つので空） */
  readonly css: string
  /** ポップアップの名前（見本の部品の名前・ヘッダーに出す） */
  readonly name: string
  /** ヘッダーの印（「離脱防止」「追従型」） */
  readonly badge: string
  readonly frame: PreviewFrame
  /** 書き出したHTML（CSS は中の <style>）を保存する。保存できたら true（画面を閉じる） */
  readonly onSave: (html: string) => Promise<boolean>
  /** 後ろに敷くLPのプレビュー（「LPの上に重ねて見る」・lpPreviewUrl）。無ければ中身だけ */
  readonly underlay?: Promise<string | null>
}

/**
 * そのABテストのLP（配信の割合がいちばん大きいVersion）のプレビュー（帯とポップアップ抜き＝?bare=1）。
 * 「LPの上に重ねて見る」の後ろに敷く。LPが無い・読めないときは null
 */
export async function lpPreviewUrl(abTestUid: string): Promise<string | null> {
  const { articles } = await api.articles(abTestUid)
  const article = articles[0]
  if (article === undefined) return null
  const { versions } = await api.versions(article.uid)
  const main = [...versions].sort((a, b) => b.distribution_ratio - a.distribution_ratio)[0]
  return main === undefined ? null : `/preview/${encodeURIComponent(main.uid)}?bare=1`
}

export function openPopupStudio(options: PopupStudioOptions): void {
  const name = options.name.trim() === '' ? 'ポップアップ' : options.name.trim()
  mountStudio({
    target: { node: document.createElement('div'), html: options.html, css: options.css, index: -1, length: 0 },
    start: popupStudioStart(options.html, options.css, name, new Date()),
    title: 'ポップアップの中身',
    subtitle: name,
    badge: options.badge,
    backLabel: 'ポップアップの設定へ',
    primaryLabel: 'ポップアップに反映',
    libraryQuill: null,
    previewFrame: options.frame,
    ...(options.underlay === undefined ? {} : { underlay: options.underlay }),
    onPrimary: (html) => {
      void options.onSave(html).then((saved) => {
        if (saved) closeWidgetStudio()
      })
    },
  })
}
