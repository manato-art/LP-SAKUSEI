/* ============================================================
   SquadBeyond 採取スニペット（DevToolsのConsoleに1回貼るだけ）

   使い方:
     1. ローカルで  npm run mock  を起動しておく
     2. 採取対象のアプリを開く（旧UIのまま。新UIトグルは触らない）
     3. DevTools > Console にこれを貼って Enter
     4. あとは普通にアプリを触るだけ。画面が変わると自動で保存される
     5. 保存先は  ~/squadbeyond-capture-quarantine/routes/  （リポジトリ外）

   手動で撮りたいとき: Ctrl + Shift + S
   やめるとき:        __sbStop()
   ============================================================ */
(() => {
  const SINK = 'http://localhost:4010/__capture/upload'
  const seen = new Set()
  let count = 0

  // 画面右下のバッジ（保存されたことが見えるように）
  const badge = document.createElement('div')
  badge.style.cssText =
    'position:fixed;right:10px;bottom:10px;z-index:2147483647;background:#0091FF;color:#fff;' +
    "font:12px/1.5 'Hiragino Sans',sans-serif;padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.3)"
  badge.textContent = '採取モード: 待機中'
  document.body.appendChild(badge)
  const say = (t, color) => {
    badge.textContent = t
    badge.style.background = color || '#0091FF'
  }

  /** URLから保存用のフォルダ名を作る（uidは UID に丸める） */
  const slugOf = () => {
    const p = location.pathname
    if (p === '/') return 'root'
    return (
      p
        .replace(/^\/|\/$/g, '')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UID')
        .replace(/\/[A-Za-z0-9_-]{12,}(?=\/|$)/g, '/UID')
        .replace(/\//g, '__')
        .replace(/[^A-Za-z0-9_]/g, '_') || 'root'
    )
  }

  const send = (slug, state, filename, content) =>
    fetch(SINK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, state, filename, content }),
    }).then((r) => r.json())

  async function capture(stateName) {
    const slug = slugOf()
    const state = stateName || 'default'
    const key = slug + '/' + state
    try {
      say('保存中… ' + slug, '#FF9500')
      await send(slug, state, 'dom.html', document.documentElement.outerHTML)

      // 同一オリジンのiframe（LPプレビュー等）も中身を保存
      const frames = [...document.querySelectorAll('iframe')].filter((f) => {
        try {
          return !!f.contentDocument
        } catch {
          return false
        }
      })
      const info = []
      for (let i = 0; i < frames.length; i++) {
        const html = frames[i].contentDocument.documentElement.outerHTML
        if (html.length < 200) continue
        await send(slug, state, 'iframe' + i + '.html', html)
        info.push({ index: i, cls: frames[i].className, w: frames[i].clientWidth, h: frames[i].clientHeight })
      }
      if (info.length) await send(slug, state, 'iframes.json', JSON.stringify(info, null, 2))

      // 【最重要】CSSOMの吸い出し。
      // Emotion(CSS-in-JS)は実行時に sheet.insertRule() でルールを挿入するため、
      // outerHTML にも .css ファイルにも現れない。これを取らないと土台が無地になる。
      const rules = []
      for (const sheet of document.styleSheets) {
        let list
        try { list = sheet.cssRules } catch { continue } // 別オリジンのCSSは読めない
        if (!list) continue
        const from = sheet.href || '(inline/runtime)'
        const body = []
        for (const rule of list) body.push(rule.cssText)
        if (body.length) rules.push('/* ==== ' + from + ' (' + body.length + ' rules) ==== */\n' + body.join('\n'))
      }
      await send(slug, state, 'cssom.css', rules.join('\n\n'))

      // 主要要素の実測スタイル（土台の照合用）
      const cm = {}
      for (const sel of ['body', '#root', 'header', 'nav', 'main', 'button', 'a', 'table', 'th', 'td', 'input', 'h1', 'h2']) {
        const el = document.querySelector(sel)
        if (!el) continue
        const cs = getComputedStyle(el)
        cm[sel] = {}
        for (const prop of ['font-family','font-size','font-weight','line-height','color','background-color','padding','margin','border','border-radius','display','width','height']) {
          cm[sel][prop] = cs.getPropertyValue(prop)
        }
      }
      await send(slug, state, 'computed.json', JSON.stringify(cm, null, 2))

      await send(slug, state, 'meta.json', JSON.stringify({
        url: location.href, pathname: location.pathname, title: document.title,
        capturedAt: new Date().toISOString(),
        viewport: { w: innerWidth, h: innerHeight },
        domBytes: document.documentElement.outerHTML.length,
      }, null, 2))

      // このページが叩いたAPI（fixture採取の手掛かり）
      const apis = performance.getEntriesByType('resource')
        .filter((e) => /\/api\/v\d\//.test(e.name))
        .map((e) => e.name.replace(/([?&](locale|referer)=)[^&]*/g, '$1<omitted>'))
      if (apis.length) await send(slug, state, 'api-urls.json', JSON.stringify([...new Set(apis)], null, 2))

      seen.add(key)
      count++
      say('保存OK (' + count + '件) ' + slug + ' / ' + state, '#2FA84F')
    } catch (e) {
      say('保存失敗: npm run mock は動いてる？', '#D0021B')
      console.error('[採取] 失敗', e)
    }
  }

  // 画面遷移を検知して自動保存（SPAなのでhistoryをフックする）
  let timer = null
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const key = slugOf() + '/default'
      if (!seen.has(key)) capture('default')
    }, 2500) // 描画とAPI取得が終わるのを待つ
  }
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m]
    history[m] = function () {
      const r = orig.apply(this, arguments)
      schedule()
      return r
    }
  }
  addEventListener('popstate', schedule)

  // 手動撮影（モーダルを開いた状態など、URLが変わらない状態用）
  addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault()
      const name = prompt('この状態の名前（例: create-modal-open）', 'state-' + (count + 1))
      if (name) capture(name.replace(/[^A-Za-z0-9_-]/g, '-'))
    }
  })

  window.__sbCapture = capture
  window.__sbStop = () => {
    badge.remove()
    say('停止')
    console.log('[採取] 停止しました')
  }

  schedule()
  console.log('%c[採取モード ON]', 'color:#0091FF;font-weight:bold')
  console.log('・普通に画面を移動すれば自動で保存されます')
  console.log('・モーダルなどURLが変わらない状態は Ctrl+Shift+S')
  console.log('・やめるときは __sbStop()')
})()
