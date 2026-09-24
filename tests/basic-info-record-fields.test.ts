/**
 * 基本情報の「記録するだけ」の項目を、保存のリクエストに入れる（2026-09-24 点検）。
 *
 * 開始/締切/終了・コンバージョン期限・スーパーリロード回数・メディア掲載・成果測定方法は
 * 入力でき、右の「設定内容の確認」にも出て「更新しました」と出るのに、送っていなかった。
 * 動作タイプ（editor_version）は作成後に変えられないので、画面でも選べないようにする。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildUpdatePayload,
  toRecordFormValues,
  validateBasicInfo,
  type AbTestForEdit,
} from '../src/app/pages/basic-info-form.ts'

const RECORD: AbTestForEdit = {
  uid: 'ABTEST_0001',
  title: 'サンプル施策001',
  page_title: '',
  memo: '',
  ad_status: 'prepared',
  editor_version: 2,
  delivery_type: 'same_url',
  media_id: 3,
  conversion_unit_price: 0,
  conversion_setting: { conversion_condition: 'click' },
  affiliate_service_provider: null,
  gender: null,
  age_from: null,
  age_to: null,
  media: { id: 3, name: 'サンプル媒体003' },
  folder: { uid: 'FOLDER_0001', name: 'サンプルフォルダ001' },
  start_date: '2026-10-01',
  deadline_date: null,
  end_date: null,
  conversion_limit_days: 30,
  super_reload_count: null,
  media_listing: true,
  measurement_method: 'strict',
}

const BASE_INPUT = {
  title: 'サンプル施策001',
  page_title: '',
  memo: '',
  affiliate_service_provider: '',
  conversion_unit_price: '0',
}

describe('記録するだけの項目を保存のリクエストに入れる', () => {
  it('入力した値をそのまま送る（空は未設定＝null）', () => {
    const payload = buildUpdatePayload(RECORD, {
      ...BASE_INPUT,
      start_date: '2026-10-02',
      deadline_date: '',
      end_date: '2026-10-31',
      conversion_limit_days: '7',
      super_reload_count: '',
      media_listing: false,
      measurement_method: 'none',
    })
    expect(payload).toMatchObject({
      start_date: '2026-10-02',
      deadline_date: null,
      end_date: '2026-10-31',
      conversion_limit_days: 7,
      super_reload_count: null,
      media_listing: false,
      measurement_method: 'none',
    })
  })

  it('動作タイプ（editor_version）は送らない（作成後は変えられない）', () => {
    const payload = buildUpdatePayload(RECORD, BASE_INPUT)
    expect('editor_version' in payload).toBe(false)
  })

  it('読み込んだ値を入力欄の初期値にする（未設定は空・0件の時は既定）', () => {
    expect(toRecordFormValues(RECORD)).toEqual({
      start_date: '2026-10-01',
      deadline_date: '',
      end_date: '',
      conversion_limit_days: '30',
      super_reload_count: '',
      media_listing: true,
      measurement_method: 'strict',
    })
  })

  it('回数・日数は0以上の整数だけ（保存前に止める）', () => {
    expect(validateBasicInfo({ ...BASE_INPUT, conversion_limit_days: '-1' }).ok).toBe(false)
    expect(validateBasicInfo({ ...BASE_INPUT, super_reload_count: '1.5' }).ok).toBe(false)
    expect(validateBasicInfo({ ...BASE_INPUT, conversion_limit_days: '', super_reload_count: '3' }).ok).toBe(true)
  })
})

describe('基本情報の画面', () => {
  const source = readFileSync('src/app/pages/basic-info-redesign.ts', 'utf8')

  it('動作タイプは作成後に変えられないので、選べない表示にして理由を添える', () => {
    expect(source).toMatch(/bi-editor[\s\S]{0,400}disabled = true/)
    expect(source).toContain('作成後は変更できません')
  })

  it('開始・締切・終了は配信を変えないことを画面に書く（記録のみ）', () => {
    expect(source).toContain('記録のみ')
  })

  it('記録するだけの項目も、保存する値を集める collect に入っている', () => {
    const collect = /function collect\([\s\S]*?\n}\n/.exec(source)?.[0] ?? ''
    for (const id of ['bi-start', 'bi-deadline', 'bi-end', 'bi-cv-limit', 'bi-reload', 'bi-media-on', 'bi-method']) {
      expect(collect).toContain(id)
    }
  })
})
