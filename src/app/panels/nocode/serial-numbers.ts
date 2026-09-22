/**
 * 番号付きの部品を増やす・消す・並べ替えたあとの番号の付け直し（2026-09-22・ノーコードでWidgetを作る②）。
 *
 * ステップフローや番号付きリストは「01」「02」…の番号が文字で書いてある。
 * 2番を複製すると「02」が2つになり、コードを書けない人が1つずつ直すことになる。
 * もともと 1,2,3… と1つずつ増えていたときだけ、上から付け直す（値段や評価の数字は触らない）。
 *
 * ここは文字だけを見る（DOMを触らない）。テストは tests/nocode-serial.test.ts。
 */

/** 番号とみなす文字の長さの上限（「STEP 10」「第12位」くらいまで） */
const MAX_LENGTH = 10
/** 数字のかたまりが1つだけ（前後は数字以外） */
const SERIAL_PATTERN = /^(\D*?)(\d{1,3})(\D*)$/

export interface Serial {
  readonly prefix: string
  readonly value: number
  /** 数字の桁（「01」なら2＝0埋め） */
  readonly width: number
  readonly suffix: string
}

export function parseSerial(text: string): Serial | null {
  const trimmed = text.trim()
  if (trimmed === '' || Array.from(trimmed).length > MAX_LENGTH) return null
  const match = SERIAL_PATTERN.exec(trimmed)
  if (match === null) return null
  const digits = match[2] ?? ''
  return { prefix: match[1] ?? '', value: Number(digits), width: digits.length, suffix: match[3] ?? '' }
}

/** 1から1つずつ増えている番号の並びか（前後の文字もそろっている）。2つ以上のときだけ */
export function isSerialRun(texts: readonly string[]): boolean {
  if (texts.length < 2) return false
  const serials = texts.map(parseSerial)
  const first = serials[0]
  if (first === null || first === undefined || first.value !== 1) return false
  return serials.every(
    (s, i) => s !== null && s.value === i + 1 && s.prefix === first.prefix && s.suffix === first.suffix,
  )
}

/** 上から 1,2,3… に付け直した文字（前後の文字はそれぞれのまま・0埋めの桁は先頭に合わせる） */
export function renumberSerials(texts: readonly string[]): string[] {
  const width = parseSerial(texts[0] ?? '')?.width ?? 1
  return texts.map((text, i) => {
    const serial = parseSerial(text)
    if (serial === null) return text
    return `${serial.prefix}${String(i + 1).padStart(width, '0')}${serial.suffix}`
  })
}
