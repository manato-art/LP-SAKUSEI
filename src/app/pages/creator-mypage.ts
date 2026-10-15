/**
 * LP作成者のマイページ（2026-10-15）。名前・メールアドレスとログアウトだけ。
 * パスワードは管理者が決めて入力する（本人の選択）ので、ここでは変えない。
 */
import { accountApi } from '../api-tools.ts'
import { sessionInfo } from '../session.ts'
import { T, el, toast } from '../ui.ts'

export function renderCreatorMyPage(container: HTMLElement): void {
  container.style.cssText = `flex:1;min-width:0;background:${T.bg};min-height:100vh`
  const info = sessionInfo()
  const logout = document.createElement('button')
  logout.type = 'button'
  logout.textContent = 'ログアウト'
  logout.style.cssText = `padding:8px 18px;border:1px solid #E4432B;border-radius:6px;background:transparent;color:#E4432B;cursor:pointer;font-size:13px;font-family:${T.font}`
  logout.addEventListener('click', () => {
    void accountApi.logout().then(
      (res) => {
        if (res.redirect !== undefined) location.assign(res.redirect)
        else location.reload()
      },
      (error: Error) => toast(error.message, 'error'),
    )
  })

  const row = (label: string, value: string): HTMLElement =>
    el('div', { style: 'display:flex;gap:16px;padding:12px 0;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2)' }, [
      el('div', { text: label, style: `width:120px;flex-shrink:0;font-size:13px;color:${T.sub}` }),
      el('div', { text: value, style: `font-size:14px;color:${T.text};word-break:break-all` }),
    ])

  container.replaceChildren(
    el('div', { class: 'sb-page-shell', style: `padding:24px 28px;font-family:${T.font}` }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:24px' }, [
        el('div', { text: 'マイページ', style: `font-size:20px;font-weight:700;color:${T.text}` }),
        logout,
      ]),
      el('div', { class: 'sb-page-card', style: `background:${T.surface};border-radius:10px;padding:20px` }, [
        row('アカウント', 'LP作成者'),
        row('名前', info.name ?? ''),
        row('メールアドレス', info.email ?? ''),
        el('div', {
          text: 'パスワードを変えたいときは、管理者に頼んでください。',
          style: `font-size:12px;color:${T.sub};margin-top:14px;line-height:1.7`,
        }),
      ]),
    ]),
  )
}
