/**
 * 匿名化で壊れた「改ざんチェック（integrity）」を正しい値に戻す（2026-09-22・見本の点検で発覚）。
 *
 * 見本の <script>/<link> には、公開CDNのライブラリを改ざんされていないか確かめる integrity（SRI）が付いているものがある。
 * 匿名化（tools/scrub の長いトークンの置き換え）がこの値の後半を `sample_token_xxxx` にしてしまい、
 * ブラウザは「中身が違う」と見なしてライブラリを読み込まない（例: 比較表の並び替えが List is not defined で止まる）。
 *
 * 正しい値は、2026-09-22 にそのURLのファイルを取得して計算した（openssl dgst -sha512/-sha256 | base64）。
 * 壊れる前に残っていた頭の部分が一致するものだけに戻す（別のファイルの値を付けない）。
 * 正しい値が分からない壊れたものは外す（壊れた値のままだと、必ず読み込みが止まる）。
 */

const KNOWN: Readonly<Record<string, readonly string[]>> = {
  'https://code.jquery.com/jquery-3.6.0.min.js': [
    'sha512-894YE6QWD5I59HgZOGReFYm4dnWc1Qt5NtvYSaNcOP+u1T9qYdvdihz0PPSiiqn/+/3e7Jo4EaG7TubfWGUrMQ==',
    'sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4=',
  ],
  'https://code.jquery.com/jquery-1.11.0.min.js': ['sha512-h9kKZlwV1xrIcr2LwAPZhjlkx+x62mNwuQK5PAu9d3D+JXMNlGx8akZbqpXvp0vA54rz+DrqYVrzUGDMhwKmwQ=='],
  'https://code.jquery.com/jquery-3.6.4.min.js': ['sha512-pumBsjNRGGqkPzKHndZMaAG+bir374sORyzM3uulLV14lN5LyykqNk8eEeUlUkB3U0M4FApyaHraT65ihJhDpQ=='],
  'https://cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js': [
    'sha512-93wYgwrIFL+b+P3RvYxi/WUFRXXUDSLCT2JQk9zhVGXuS2mHl2axj6d+R6pP+gcU5isMHRj1u0oYE/mWyt/RjA==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/odometer.js/0.4.7/odometer.min.js': [
    'sha512-v3fZyWIk7kh9yGNQZf1SnSjIxjAKsYbg6UQ+B+QxAZqJQLrN3jMjrdNwcxV6tis6S0s1xyVDZrDz9UoRLfRpWw==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/featherlight/1.7.13/featherlight.min.js': [
    'sha512-0UbR6HN0dY8fWN9T7fF658896tsPgnbRREHCNq46J9/JSn8GonXDZmqtTc3qS879GM0zV49b9LPhdc/maKP8Kg==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/featherlight/1.7.13/featherlight.gallery.min.css': [
    'sha512-B31/elyDKOSa2yGC1ALSAHkdlJ5FOhZJTNANGUFxWOnVMfKQmekRG2/sNdp6yJPrO7Ae9rlAxUlr0QjiJne01Q==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/featherlight/1.7.13/featherlight.min.css': [
    'sha512-56GJrpSgHk6Mc9Fltt+bQKcICJoEpxtvozXPA5n5OT0rfWiqGlJmJCI/vl16kctf/0XbBloh03vl7OF2xFnR8g==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.1/chart.min.js': [
    'sha512-QSkVNOCYLtj73J4hbmVoOV6KVZuMluZlioC+trLpewV8qMjsWqlIQvkn1KGX2StWvPMdWGBqim1xlC8krl1EKQ==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.31.3/css/theme.default.min.css': [
    'sha512-wghhOJkjQX0Lh3NSWvNKeZ0ZpNn+SPVXX1Qyc9OCaogADktxrBiBdKGDoqVUOyhStvMBmJQ8ZdMHiR3wuEq8+w==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.31.3/js/jquery.tablesorter.min.js': [
    'sha512-qzgd5cYSZcosqpzpn7zF2ZId8f/8CHmFKZ8j7mU4OUXTNRd5g+ZHBPsgKEwoqxCtdQvExE5LprwwPAgoicguNg==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.31.3/js/extras/jquery.metadata.min.js': [
    'sha512-3ngVPyOFSd9Rz1jSn6ERZQ3GbK4bz7GGZbjZ2cLFKsnWLqb3RVDiNNuHkYXaKHDE2WtjcpEeky5ngDqFxfBvBA==',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/jQuery-Knob/1.2.13/jquery.knob.min.js': [
    'sha512-NhRZzPdzMOMf005Xmd4JonwPftz4Pe99mRVcFeRDcdCtfjv46zPIi/7ZKScbpHD/V0HB1Eb+ZWigMqw94VUVaw==',
  ],
}

const DAMAGED = 'sample_token_'

export function repairIntegrity(html: string): string {
  return html.replace(/<(?:script|link)\b[^>]*>/gi, (tag) => {
    const integrity = /\sintegrity="([^"]*)"/i.exec(tag)
    const value = integrity?.[1] ?? ''
    if (integrity === null || !value.includes(DAMAGED)) return tag
    const src = /\s(?:src|href)="([^"]+)"/i.exec(tag)?.[1] ?? ''
    const kept = value.slice(0, value.indexOf(DAMAGED))
    const real = (KNOWN[src] ?? []).find((hash) => hash.startsWith(kept))
    return tag.replace(integrity[0], real === undefined ? '' : ` integrity="${real}"`)
  })
}
