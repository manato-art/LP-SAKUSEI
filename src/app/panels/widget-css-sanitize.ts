/**
 * ウィジェットCSSに紛れ込んだ実SBエディタの警告ルールを除去する。
 *
 * 実SquadBeyondのエディタCSSには `.ql-editor img { border: 2px solid red; }` という
 * 「未アップロード（自社CDN以外）の画像に赤枠を出す」QA警告がある。これが一部ウィジェットの
 * カスタムCSSに丸ごと取り込まれており、そのウィジェットの `<style>` がエディタ内(.ql-editor)に
 * 描画されると、body内の `<style>` は head の打ち消しより後に来るため **LP上の全画像に赤枠**が付く。
 *
 * クローンは自社CDNの概念が無く画像は常にローカル(dataURL)なので、この赤枠警告は不要。
 * `.ql-editor img { ... }` のうち **赤いborderを持つ規則だけ** を消す
 * （max-width 等の他の .ql-editor img 規則やユーザー指定の枠は残す）。
 * 配信LPには `.ql-editor` が無いので元々無害だが、保存内容も綺麗になる。
 */
export function stripLeakedEditorImgBorder(html: string): string {
  return html.replace(/\.ql-editor\s+img\s*\{[^}]*\}/gi, (rule) =>
    /border[^}]*\bred\b/i.test(rule) || /border[^}]*rgb\(\s*255\s*,\s*0\s*,\s*0/i.test(rule)
      ? ''
      : rule,
  )
}
