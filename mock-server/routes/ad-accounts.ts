/**
 * 外部連携 > 広告媒体連携 > Meta(旧Facebook) の広告アカウント連携。
 *
 *   GET    /teams/ad_accounts/meta              … 連携済みの広告アカウント（＋まだ連携していない候補）
 *   POST   /teams/ad_accounts/meta              … 「認証」: 広告アカウントIDを連携する
 *   DELETE /teams/ad_accounts/meta/:accountId   … 連携を外す
 *
 * 連携は State.adAccounts（provider: facebook）に保存する＝再読み込みしても残る。
 * 「認証」はトークン（環境変数 META_ACCESS_TOKEN）で見える広告アカウントの中にそのIDがあるかで確かめる。
 * トークンが無いと確かめようがないので、連携したことにはしない（以前は画面の配列に足すだけだった）。
 *
 * 「beyondページ数」は、基本情報の Meta 連携で「広告アカウント」単位にこのIDを紐付けたページの数。
 * キャンペーン・広告セット・広告単位の紐付けは、どのアカウントの物かを Meta に聞かないと分からないので数えない。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { fetchAdAccounts, type MetaAdAccount } from '../lib/meta-client.ts'
import { jstNow } from '../lib/jst.ts'
import { currentTeamId } from '../store/current-team.ts'
import { makeUid } from '../store/ids.ts'
import { freshUid } from '../store/actions-shared.ts'
import { getState, setState } from '../store/store.ts'
import type { AdAccount, State } from '../store/types.ts'

export const adAccountsRouter: Router = Router()

const META_ID = /^(?:act_)?(\d{5,20})$/

/** `act_123…` でも数字だけでも受け、数字だけにそろえる。形が違えば null */
export function bareMetaAccountId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = META_ID.exec(raw.trim())
  return m?.[1] ?? null
}

function linkedMetaAccounts(state: State): AdAccount[] {
  return state.adAccounts.filter(
    (a) => a.provider === 'facebook' && a.connected && a.external_id !== undefined,
  )
}

/** そのアカウントを「広告アカウント」単位で紐付けたページの数 */
function pageCount(state: State, accountId: string): number {
  return state.abTests.filter(
    (t) => t.meta_level === 'account' && bareMetaAccountId(t.meta_object_id ?? '') === accountId,
  ).length
}

function serialize(state: State, link: AdAccount, live: MetaAdAccount | undefined): Record<string, unknown> {
  const accountId = link.external_id ?? ''
  return {
    account_id: accountId,
    name: live?.name ?? link.account_name,
    /** 今トークンで見えているか（見えなくなったら接続できない） */
    visible: live !== undefined,
    account_status: live?.account_status ?? null,
    currency: live?.currency ?? '',
    linked_date: link.connected_at ?? '',
    page_count: pageCount(state, accountId),
  }
}

adAccountsRouter.get('/teams/ad_accounts/meta', (_req, res) => {
  void fetchAdAccounts().then((live) => {
    const state = getState()
    const linked = linkedMetaAccounts(state)
    const linkedIds = new Set(linked.map((a) => a.external_id))
    if (live.error !== undefined) console.error('[ad-accounts] Metaの広告アカウント一覧を取れませんでした:', live.error)
    res.json({
      configured: live.configured,
      accounts: linked.map((a) => serialize(state, a, live.accounts.find((v) => v.account_id === a.external_id))),
      candidates: live.accounts
        .filter((v) => !linkedIds.has(v.account_id))
        .map((v) => ({ account_id: v.account_id, name: v.name })),
      ...(live.error === undefined ? {} : { error: 'Metaに問い合わせできませんでした。時間をおいて開き直してください。' }),
    })
  })
})

adAccountsRouter.post('/teams/ad_accounts/meta', (req, res) => {
  const accountId = bareMetaAccountId((req.body as Record<string, unknown> | undefined)?.['account_id'])
  if (accountId === null) {
    res
      .status(422)
      .json(errorEnvelope('validation_failed', '広告アカウントIDは数字で入力してください（act_ は付いていても構いません）。'))
    return
  }
  if (linkedMetaAccounts(getState()).some((a) => a.external_id === accountId)) {
    res.status(409).json(errorEnvelope('conflict', 'このアカウントは既に連携済みです。'))
    return
  }
  void fetchAdAccounts().then((live) => {
    if (!live.configured) {
      res
        .status(422)
        .json(
          errorEnvelope(
            'not_configured',
            'Metaのアクセストークンが未設定のため、広告アカウントを確かめられません。環境変数 META_ACCESS_TOKEN を設定してから認証してください。',
          ),
        )
      return
    }
    if (live.error !== undefined) {
      console.error('[ad-accounts] Metaの広告アカウント一覧を取れませんでした:', live.error)
      res.status(502).json(errorEnvelope('meta_unavailable', 'Metaに問い合わせできませんでした。時間をおいてもう一度お試しください。'))
      return
    }
    const found = live.accounts.find((a) => a.account_id === accountId)
    if (found === undefined) {
      res.status(422).json(errorEnvelope('not_found', 'このトークンでは見つからない広告アカウントIDです。'))
      return
    }
    let created: AdAccount | null = null
    setState((s) => {
      // 問い合わせの間に同じIDが連携されていたら足さない（二重登録を防ぐ）
      if (linkedMetaAccounts(s).some((a) => a.external_id === accountId)) return s
      const id = s.nextId
      const account: AdAccount = {
        id,
        uid: freshUid(s.adAccounts, id, (n) => makeUid('adAccount', n)),
        team_id: currentTeamId(s),
        provider: 'facebook',
        account_name: found.name,
        connected: true,
        connected_at: jstNow().date,
        external_id: accountId,
      }
      created = account
      return { ...s, adAccounts: [...s.adAccounts, account], nextId: id + 1 }
    })
    if (created === null) {
      res.status(409).json(errorEnvelope('conflict', 'このアカウントは既に連携済みです。'))
      return
    }
    res.status(201).json({ account: serialize(getState(), created, found) })
  })
})

adAccountsRouter.delete('/teams/ad_accounts/meta/:accountId', (req, res) => {
  const accountId = bareMetaAccountId(req.params.accountId)
  const exists =
    accountId !== null && linkedMetaAccounts(getState()).some((a) => a.external_id === accountId)
  if (!exists) {
    res.status(404).json(errorEnvelope('not_found', '連携している広告アカウントが見つかりません。'))
    return
  }
  // 連携の記録だけを外す。ページ側の Meta 紐付け（基本情報）には触らない
  setState((s) => ({
    ...s,
    adAccounts: s.adAccounts.filter((a) => !(a.provider === 'facebook' && a.external_id === accountId)),
  }))
  res.status(204).end()
})
