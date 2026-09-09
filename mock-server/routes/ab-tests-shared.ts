/**
 * beyondページ系ルーターで共通に使うもの（ab-tests.ts から分離）。
 *
 * ルート定義を複数ファイルに分けたので、両方が使う小さな道具をここに置く。
 */
import type { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import type { AbTest, State } from '../store/types.ts'

export function findAbTest(state: State, uid: string): AbTest | undefined {
  return state.abTests.find((t) => t.uid === uid)
}

export function notFound(
  res: Parameters<Parameters<Router['get']>[1]>[1],
  message: string,
): void {
  res.status(404).json(errorEnvelope('not_found', message))
}
