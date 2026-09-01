/**
 * Meta広告 実データ連携（指示⑤⑧）。
 *   GET /meta/status                 … 連携の有無（env設定済みか）
 *   GET /meta/insights?from=&to=     … アカウント全体の集計KPIを**実際に**取得（未設定なら configured:false）
 *
 * 認証情報は env（META_ACCESS_TOKEN / META_AD_ACCOUNT_ID）から meta-client が読む。
 * 未設定でも 200 を返し configured:false にする（フロントは 0/モックへフォールバック）。
 */
import { Router } from 'express'
import { fetchAccountKpi, fetchAdAccounts, isMetaConfigured } from '../lib/meta-client.ts'

export const metaRouter: Router = Router()

metaRouter.get('/meta/status', (_req, res) => {
  res.json({ configured: isMetaConfigured() })
})

/** 外部連携画面のMeta一覧（トークンで見える広告アカウント・指示⑦） */
metaRouter.get('/meta/adaccounts', (_req, res) => {
  void fetchAdAccounts()
    .then((result) => res.json(result))
    .catch((error: unknown) =>
      res.json({ configured: true, accounts: [], error: (error as Error).message }),
    )
})

metaRouter.get('/meta/insights', (req, res) => {
  const from = typeof req.query['from'] === 'string' ? req.query['from'] : undefined
  const to = typeof req.query['to'] === 'string' ? req.query['to'] : undefined
  void fetchAccountKpi({ from, to }, Date.now())
    .then((result) => res.json(result))
    .catch((error: unknown) =>
      res.json({ configured: true, kpi: null, error: (error as Error).message }),
    )
})
