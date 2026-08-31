/**
 * 到達性クローラ（ブラウザで動かす）。
 *
 * 「このボタンを押す → 次の画面 → そこでこのボタンを押す → 次の画面」を機械的に辿り、
 * どこまで到達できるか・どこで行き止まるかを記録する。
 * 目視の「動いてるっぽい」を排して、到達不能点を一覧にするための道具。
 *
 * 使い方（DevTools か javascript_tool から）:
 *   const { crawl } = await import('/@fs/<repo>/tools/reachability/crawl.js')
 *   await crawl({ startRoutes: ['#/folders'], maxDepth: 3 })
 */

const SLEEP_AFTER_CLICK_MS = 420
const SLEEP_AFTER_ROUTE_MS = 900

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 今の画面の指紋。ハッシュだけだと同一ルート内のモーダル開閉を見逃すので DOM も混ぜる。 */
function screenFingerprint() {
  const testIds = [...document.querySelectorAll('[data-test]')]
    .map((element) => element.getAttribute('data-test'))
    .sort()
    .join(',')
  const dialogs = document.querySelectorAll('[role="dialog"], .ReactModalPortal *').length
  const heading = document.querySelector('h1, h2, [role="heading"]')?.textContent?.trim().slice(0, 40) ?? ''
  return `${location.hash}|${heading}|d${dialogs}|${testIds.length}|${hash32(testIds)}`
}

function hash32(text) {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(36)
}

function isVisible(element) {
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const style = getComputedStyle(element)
  return style.visibility !== 'hidden' && style.display !== 'none' && style.pointerEvents !== 'none'
}

/** 今の画面で押せるものを列挙する。押す順を安定させるため DOM 順のまま返す。 */
function listClickables() {
  // この画面はクリック配線を div に付けている箇所が多い（サイドバー等）。
  // data-test だけだと取りこぼすので、data-testid と cursor:pointer も拾う。
  const selector = '[data-test], [data-testid], button, [role="tab"], a[href^="#/"], [role="button"]'
  const tagged = [...document.querySelectorAll(selector)]
  const pointer = [...document.querySelectorAll('div, span, li')].filter(
    (element) => getComputedStyle(element).cursor === 'pointer',
  )
  return [...new Set([...tagged, ...pointer])]
    .filter(isVisible)
    .filter((element) => !element.hasAttribute('disabled'))
    .map((element) => ({
      element,
      label:
        element.getAttribute('data-test') ??
        element.getAttribute('data-testid') ??
        element.getAttribute('href') ??
        element.textContent?.trim().slice(0, 24) ??
        element.tagName.toLowerCase(),
    }))
}

async function gotoRoute(hash) {
  location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  await sleep(SLEEP_AFTER_ROUTE_MS)
}

/**
 * 幅優先で到達できる画面を辿る。
 * @returns {Promise<{screens: object[], deadEnds: object[], errors: object[]}>}
 */
export async function crawl({ startRoutes = ['#/folders'], maxDepth = 3, maxScreens = 60 } = {}) {
  const seen = new Set()
  const screens = []
  const deadEnds = []
  const errors = []
  const queue = startRoutes.map((route) => ({ route, path: [], depth: 0 }))

  while (queue.length > 0 && screens.length < maxScreens) {
    const { route, path, depth } = queue.shift()

    await gotoRoute(route)
    for (const step of path) {
      const target = listClickables().find((candidate) => candidate.label === step)
      if (!target) {
        errors.push({ route, path, missingStep: step, reason: '再訪時に同じ要素が見つからない' })
        break
      }
      target.element.click()
      await sleep(SLEEP_AFTER_CLICK_MS)
    }

    const fingerprint = screenFingerprint()
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)

    const clickables = listClickables()
    screens.push({ route, path, depth, fingerprint, clickableCount: clickables.length })
    if (clickables.length === 0) deadEnds.push({ route, path, reason: '押せるものが1つも無い' })
    if (depth >= maxDepth) continue

    for (const { label } of clickables) {
      queue.push({ route, path: [...path, label], depth: depth + 1 })
    }
  }

  return { screens, deadEnds, errors, seenCount: seen.size }
}
