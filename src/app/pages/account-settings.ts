/**
 * アカウント設定ページ。
 * FAQ「設定・管理」に記載のユーザープロフィール・通知設定・チームメンバー管理を
 * 1画面にまとめる（実物は複数画面に分かれているが、採取していないので自作する）。
 */
import { api } from '../api.ts'
import { accountApi, type AllowedEmailEntry } from '../api-tools.ts'
import { T, el, emptyState, toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { buildThemeColorSection } from '../panels/theme-color-section.ts'
import { jstDateKey } from '../jst.ts'
import { mountAlertSettings } from './alert-settings-section.ts'
import { renderMembers } from './team-members.ts'

export async function renderAccountSettings(
  container: HTMLElement,
  /** 最初に開くタブ。CV速報の「通知設定」からは通知のタブを開く */
  initialTab?: '通知設定',
): Promise<void> {
  container.style.cssText = `flex:1;min-width:0;background:${T.bg};min-height:100vh`
  container.innerHTML = ''

  // クラスはスマホ用CSSの目印（左右の余白を外す・data-ui.ts の pageShell と同じ扱い）
  const body = el('div', { class: 'sb-page-shell', style: `padding:24px 28px;font-family:${T.font}` })
  // ヘッダー行（タイトル + ログアウトボタン）
  const header = el('div', {
    style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px',
  })
  header.append(
    el('div', { text: 'マイページ', style: `font-size:20px;font-weight:700;color:${T.text}` }),
  )
  const logoutBtn = document.createElement('button')
  logoutBtn.textContent = 'ログアウト'
  logoutBtn.style.cssText = [
    `padding:8px 18px;border:1px solid #E4432B;border-radius:6px;background:transparent`,
    `color:#E4432B;cursor:pointer;font-size:13px;font-family:${T.font}`,
  ].join(';')
  logoutBtn.addEventListener('click', () => {
    // 行き先はサーバーが返す（ログインの入口）。`/` は未ログインだと404なので決め打ちしない。
    // 返ってこない＝もともとログインしていない（開発中など）ときは、今の画面を読み直す
    void accountApi.logout().then(
      (res) => {
        if (res.redirect !== undefined) location.assign(res.redirect)
        else location.reload()
      },
      (error: Error) => toast(error.message, 'error'),
    )
  })
  header.append(logoutBtn)

  body.append(
    header,
    el('div', {
      text: '※クローンが自作した画面です（実物とは見た目が異なる場合があります）。',
      style: `font-size:12px;color:${T.sub};margin-bottom:20px;line-height:1.7`,
    }),
  )
  container.append(body)

  // タブ
  const tabs = ['アカウント', '通知設定', 'チームメンバー', 'アクセス管理'] as const
  let activeTab: (typeof tabs)[number] = initialTab ?? 'アカウント'

  // クラスはスマホで横スクロールにするための目印（mobile-css.ts）
  const tabBar = el('div', { class: 'sb-tabbar', style: 'display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--sb-c-eeeeee, #EEEEEE)' })
  const contentArea = el('div', {
    class: 'sb-page-card',
    style: `background:${T.surface};border-radius:10px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)`,
  })

  function renderTabs(): void {
    tabBar.innerHTML = ''
    for (const tab of tabs) {
      const isActive = tab === activeTab
      const tabEl = el('div', {
        text: tab,
        style: [
          'padding:10px 20px;cursor:pointer;font-size:14px;white-space:nowrap',
          `color:${isActive ? 'var(--sb-accent, #0091FF)' : T.sub}`,
          `border-bottom:2px solid ${isActive ? 'var(--sb-accent, #0091FF)' : 'transparent'}`,
          'margin-bottom:-2px',
        ].join(';'),
      })
      tabEl.addEventListener('click', () => {
        activeTab = tab
        renderTabs()
        void renderTabContent()
      })
      tabBar.append(tabEl)
    }
  }

  async function renderTabContent(): Promise<void> {
    contentArea.innerHTML = ''
    if (activeTab === 'アカウント') await renderAccount(contentArea)
    else if (activeTab === '通知設定') await renderNotifications(contentArea)
    else if (activeTab === 'チームメンバー') await renderMembers(contentArea)
    else if (activeTab === 'アクセス管理') await renderAccessManagement(contentArea)
  }

  renderTabs()
  body.append(tabBar, contentArea)
  await renderTabContent()
}

async function renderAccount(content: HTMLElement): Promise<void> {
  const data = await api.currentUser()
  const user = data.user
  if (user === null) {
    content.append(emptyState('ユーザー情報を取得できませんでした。'))
    return
  }

  const form = el('div', { style: 'max-width:400px' })

  // 名前
  form.append(
    el('div', { text: '名前', style: `font-size:12px;color:${T.sub};margin-bottom:4px` }),
  )
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = user.name
  nameInput.style.cssText = `width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:14px;font-family:${T.font};outline:none;margin-bottom:16px`
  form.append(nameInput)

  // メールアドレス（本人が書き換えられる。空シードの見本アドレスが出たままにならないように）
  form.append(
    el('div', { text: 'メールアドレス', style: `font-size:12px;color:${T.sub};margin-bottom:4px` }),
  )
  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.value = user.email
  emailInput.style.cssText = `width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:14px;font-family:${T.font};outline:none;margin-bottom:16px`
  form.append(emailInput)

  // 公開APIキー
  form.append(
    el('div', { text: '公開APIキー', style: `font-size:12px;color:${T.sub};margin-bottom:4px` }),
  )
  const apiKeyDisplay = el('div', {
    text: user.public_api_key ?? '未発行',
    style: `padding:10px 12px;background:var(--sb-c-f7f7f7, #F7F7F7);border-radius:6px;font-size:14px;margin-bottom:8px;color:${T.text};word-break:break-all`,
  })
  form.append(apiKeyDisplay)

  const genKeyBtn = document.createElement('button')
  genKeyBtn.textContent = user.public_api_key !== null ? 'APIキーを再発行' : 'APIキーを発行'
  genKeyBtn.style.cssText = `padding:6px 14px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;background:${T.surface};cursor:pointer;font-size:12px;font-family:${T.font};margin-bottom:20px`
  genKeyBtn.addEventListener('click', () => {
    void fetch('/api/v1/users/public_api_key', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { public_api_key: string }) => {
        apiKeyDisplay.textContent = data.public_api_key
        genKeyBtn.textContent = 'APIキーを再発行'
        toast('APIキーを発行しました')
      })
      .catch(() => toast('発行に失敗しました', 'error'))
  })
  form.append(genKeyBtn)

  // 保存
  const saveBtn = document.createElement('button')
  saveBtn.textContent = '保存'
  saveBtn.style.cssText = 'display:block;padding:10px 24px;border:none;border-radius:6px;background:var(--sb-accent, #0091FF);color:#FFFFFF;cursor:pointer;font-size:14px'
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim()
    if (name === '') {
      toast('名前を入力してください', 'error')
      return
    }
    const email = emailInput.value.trim()
    if (email === '') {
      toast('メールアドレスを入力してください', 'error')
      return
    }
    saveBtn.textContent = '保存中...'
    void api.updateUser({ name, email }).then(
      () => {
        saveBtn.textContent = '保存'
        toast('アカウント情報を更新しました')
      },
      (error: Error) => {
        saveBtn.textContent = '保存'
        toast(error.message, 'error')
      },
    )
  })
  form.append(saveBtn)

  content.append(form, buildThemeColorSection())
}

async function renderNotifications(content: HTMLElement): Promise<void> {
  const data = await api.notificationSettings('member')
  const settings = data.settings
  if (settings === null) {
    content.append(emptyState('通知設定を取得できませんでした。'))
    return
  }

  const desc = el('div', {
    text: 'CV発生やレポート配信の通知を設定します。Squad Beyondからのメール・Slack通知の受信を制御できます。',
    style: `font-size:13px;color:${T.sub};line-height:1.7;margin-bottom:20px`,
  })
  content.append(desc)

  const toggles: { label: string; desc: string; key: 'cv_notify' | 'daily_report' | 'ad_alert' }[] = [
    { label: 'CV発生通知', desc: 'コンバージョンが発生したらメール/Slackで通知', key: 'cv_notify' },
    { label: 'デイリーレポート', desc: '毎日のレポートをメールで受け取る', key: 'daily_report' },
    { label: '広告アラート', desc: '広告の異常（停止・予算超過等）を通知', key: 'ad_alert' },
  ]

  for (const toggle of toggles) {
    const row = el('div', {
      style: 'display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2)',
    })

    const left = el('div', { style: '' }, [
      el('div', { text: toggle.label, style: `font-size:14px;font-weight:500;color:${T.text}` }),
      el('div', { text: toggle.desc, style: `font-size:12px;color:${T.sub};margin-top:2px` }),
    ])

    const switchEl = document.createElement('label')
    switchEl.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;cursor:pointer'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = settings[toggle.key]
    checkbox.style.cssText = 'opacity:0;width:0;height:0'
    const slider = el('span', {
      style: [
        'position:absolute;inset:0;border-radius:12px;transition:background .2s',
        `background:${checkbox.checked ? 'var(--sb-accent, #0091FF)' : 'var(--sb-c-cccccc, #CCCCCC)'}`,
      ].join(';'),
    })
    const dot = el('span', {
      style: [
        'position:absolute;top:2px;width:20px;height:20px;border-radius:50%;background:var(--sb-c-ffffff, #FFFFFF)',
        `left:${checkbox.checked ? '22px' : '2px'};transition:left .2s`,
      ].join(';'),
    })
    slider.append(dot)
    switchEl.append(checkbox, slider)

    checkbox.addEventListener('change', () => {
      slider.style.background = checkbox.checked ? 'var(--sb-accent, #0091FF)' : '#CCC'
      dot.style.left = checkbox.checked ? '22px' : '2px'
      void api.updateNotificationSettings('member', { [toggle.key]: checkbox.checked }).then(
        () => toast(`${toggle.label}を${checkbox.checked ? 'オン' : 'オフ'}にしました`),
        () => toast('設定の更新に失敗しました', 'error'),
      )
    })

    row.append(left, switchEl)
    content.append(row)
  }

  // 異常のお知らせ（このシステムだけの機能）。通知の設定はここに集めている。
  await mountAlertSettings(content)
}

// ── アクセス管理タブ（メールゲート） ─────────────────────────

async function renderAccessManagement(content: HTMLElement): Promise<void> {
  // 共有リンク表示エリア（admin_path を取得後に埋める）
  const shareBox = el('div', {
    style: [
      `background:#F0F6FF;border:1px solid #C4DCFF;border-radius:8px;padding:14px 16px`,
      `margin-bottom:20px;display:flex;align-items:center;gap:10px`,
    ].join(';'),
  })
  const shareLinkEl = el('div', {
    style: `flex:1;min-width:0`,
  })
  shareLinkEl.append(
    el('div', {
      text: '共有リンク',
      style: `font-size:11px;color:#4A7FBF;font-weight:600;margin-bottom:4px`,
    }),
  )
  const shareUrlText = el('div', {
    text: '読み込み中...',
    style: `font-size:13px;color:${T.text};word-break:break-all;font-family:monospace`,
  })
  shareLinkEl.append(shareUrlText)
  const copyBtn = document.createElement('button')
  copyBtn.textContent = 'コピー'
  copyBtn.style.cssText = [
    `padding:6px 16px;border:1px solid #4A7FBF;border-radius:6px;background:var(--sb-c-ffffff, #FFFFFF)`,
    `color:#4A7FBF;cursor:pointer;font-size:12px;font-family:${T.font};white-space:nowrap`,
  ].join(';')
  copyBtn.addEventListener('click', () => {
    const url = shareUrlText.textContent ?? ''
    void navigator.clipboard.writeText(url).then(
      () => {
        copyBtn.textContent = 'コピー済み'
        setTimeout(() => { copyBtn.textContent = 'コピー' }, 1500)
      },
      () => toast('コピーに失敗しました', 'error'),
    )
  })
  shareBox.append(shareLinkEl, copyBtn)
  content.append(shareBox)

  const desc = el('div', {
    style: `font-size:13px;color:${T.sub};line-height:1.7;margin-bottom:20px`,
  })
  desc.append(
    el('div', { text: 'ここに登録したメールアドレスの人だけが、上記リンクからログイン画面へ進めます。' }),
    el('div', {
      text: '0件になるとリンクが開かなくなり誰もログインできなくなるため、最後の1件は削除できません。',
    }),
  )
  content.append(desc)

  // 追加フォーム
  const addRow = el('div', { style: 'display:flex;gap:8px;margin-bottom:20px;align-items:center' })
  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.placeholder = 'メールアドレスを入力'
  emailInput.style.cssText =
    `flex:1;padding:10px 12px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:14px;font-family:${T.font};outline:none`
  const addBtn = document.createElement('button')
  addBtn.textContent = '追加'
  addBtn.style.cssText =
    `padding:10px 20px;border:none;border-radius:6px;background:${T.primary};color:#FFFFFF;cursor:pointer;font-size:14px;font-family:${T.font};white-space:nowrap`
  addRow.append(emailInput, addBtn)
  content.append(addRow)

  // リスト表示エリア
  const listArea = el('div', {})
  content.append(listArea)

  let emails: AllowedEmailEntry[] = []

  async function loadEmails(): Promise<void> {
    try {
      const data = await accountApi.allowedEmails()
      emails = data.allowed_emails
      shareUrlText.textContent = `${location.origin}${data.admin_path}`
    } catch (error) {
      // 入口のパスが分からないときに、違うリンクを見せない
      emails = []
      shareUrlText.textContent = '読み込めませんでした'
      toast(`許可メールの読み込みに失敗しました: ${(error as Error).message}`, 'error')
    }
    renderList()
  }

  function renderList(): void {
    listArea.innerHTML = ''
    if (emails.length === 0) {
      listArea.append(
        el('div', {
          text: 'メールアドレスが登録されていません。共有リンクは開かず、誰もログインできません。',
          style: `padding:20px;text-align:center;font-size:13px;color:${T.sub}`,
        }),
      )
      return
    }
    for (const entry of emails) {
      const row = el('div', {
        style:
          'display:flex;justify-content:space-between;align-items:center;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2)',
      })
      const left = el('div', {}, [
        el('div', { text: entry.email, style: `font-size:14px;color:${T.text}` }),
        el('div', {
          text: `追加: ${jstDateKey(new Date(entry.created_at))}`,
          style: `font-size:11px;color:${T.sub};margin-top:2px`,
        }),
      ])
      const removeBtn = document.createElement('button')
      removeBtn.textContent = '削除'
      removeBtn.style.cssText =
        `padding:6px 14px;border:1px solid #E4432B;border-radius:6px;background:transparent;color:#E4432B;cursor:pointer;font-size:12px;font-family:${T.font}`
      const isLast = emails.length === 1
      if (isLast) {
        // 最後の1件は消せない。押せない理由をそのまま見せる
        removeBtn.disabled = true
        removeBtn.style.opacity = '.4'
        removeBtn.style.cursor = 'not-allowed'
        removeBtn.title = '最後の1件は削除できません（0件になると誰もログインできなくなります）'
        left.append(
          el('div', {
            text: '最後の1件は削除できません。先に別のメールアドレスを追加してください。',
            style: `font-size:11px;color:${T.sub};margin-top:2px`,
          }),
        )
      }
      removeBtn.addEventListener('click', () => {
        void removeEmail(entry)
      })
      row.append(left, removeBtn)
      listArea.append(row)
    }
  }

  async function addEmail(): Promise<void> {
    const email = emailInput.value.trim()
    if (email === '') {
      toast('メールアドレスを入力してください', 'error')
      return
    }
    addBtn.textContent = '追加中...'
    addBtn.setAttribute('disabled', '')
    try {
      await accountApi.addAllowedEmail(email)
      emailInput.value = ''
      toast('メールアドレスを追加しました')
      await loadEmails()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      addBtn.textContent = '追加'
      addBtn.removeAttribute('disabled')
    }
  }

  async function removeEmail(entry: AllowedEmailEntry): Promise<void> {
    const ok = await confirmCard({
      title: 'メールアドレスを削除します',
      message: `${entry.email} を削除します。この人は次から共有リンクを通れなくなります。`,
      detail:
        'この端末でのログインはそのまま続きます。次にログインするときは、残っているメールアドレスのどれかを入力します。',
      submitLabel: '削除する',
      danger: true,
    })
    if (!ok) return
    try {
      await accountApi.deleteAllowedEmail(entry.id)
      toast('メールアドレスを削除しました')
      await loadEmails()
    } catch (error) {
      // 最後の1件などはサーバーが理由を返す。その理由をそのまま出す
      toast((error as Error).message, 'error')
    }
  }

  addBtn.addEventListener('click', () => void addEmail())
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void addEmail()
    }
  })

  await loadEmails()
}
