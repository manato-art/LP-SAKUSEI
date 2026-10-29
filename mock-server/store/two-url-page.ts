/**
 * 「金谷味噌汁のコピー」（フォルダ「蝦名」）だけは特別に、今までのURLと c1page.com の2つで開けるようにする
 * （2026-10-30 本人「蝦名→味噌汁コピーだけは特別に 今までのURLと c1page.com の２個を設けて」）。
 *
 * 前からあるLPは住所を持たない（フォルダのドメインで出す）。このページだけ住所（土台そのもの＝c1page.com）を持たせる。
 * 今までのURLは、フォルダ「蝦名」の設定＝このシステムのドメイン。このシステムのドメインはどのページも出すので、
 * 住所を足すだけで2つとも開ける。基本情報には今までのURLも出す（legacy_url_kept）。
 *   - 今までのURLが独自ドメインのときは足さない（住所を持つとフォルダのドメインでは出さなくなり、今までのURLが止まるため）
 *   - 1回足せば住所を持つので、2回目は何もしない（あとで基本情報で頭の名前を変えても戻さない）
 */
import type { State } from './types.ts'

/** 本番の「金谷味噌汁のコピー」 */
export const TWO_URL_PAGE_UID = 'P5VoGmRXrM2aqZg51w'

export function keepTwoUrlsForSpecialPage(state: State): { state: State; changed: string[] } {
  const base = state.quickDomainBase
  const target = state.abTests.find((t) => t.uid === TWO_URL_PAGE_UID)
  if (base === '' || target === undefined || (target.delivery_domain ?? '') !== '') return { state, changed: [] }
  const folder = state.folders.find((f) => f.id === target.folder_id)
  if (folder?.domain !== 'system') return { state, changed: [] }
  return {
    state: {
      ...state,
      abTests: state.abTests.map((t) =>
        t.uid === TWO_URL_PAGE_UID ? { ...t, delivery_domain: base, legacy_url_kept: true } : t,
      ),
    },
    changed: [TWO_URL_PAGE_UID],
  }
}
