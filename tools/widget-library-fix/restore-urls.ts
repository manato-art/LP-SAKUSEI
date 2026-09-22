/**
 * 匿名化（tools/scrub）で架空にされた「公開ライブラリ・公開API」の読み込み先を、元のURLに戻す（2026-09-22）。
 *
 * 匿名化は、許可リストに無い外部ホストを**すべて** `sampleNN.example.test` に置き換える（列挙では漏れるため）。
 * そのとき Swiper・jQuery・紙吹雪などを配る公開CDNまで架空になり、見本のスクリプトが読み込めず動かなくなっていた
 * （本人「ボタンとして機能していない」）。
 *
 * 何が何だったかは、scrub-map.json（実データ入り・ローカル専用）を読まずに決める:
 * `tools/scrub/replacers.ts` の fakeHost に公開CDNの名前を入れて番号を計算し直し、パスの形でも確かめた。
 *   sample22=cdn.jsdelivr.net（/npm/）・sample57=ajax.googleapis.com（/ajax/libs/）と social-plugins.line.me（/lineit/）・
 *   sample47=code.jquery.com・sample19=platform.twitter.com・sample50=player.vimeo.com・sample41=www.youtube.com・
 *   sample88=b.st-hatena.com・sample39=www.line-website.com・sample82=www.facebook.com・sample97=twitter.com・
 *   sample66=b.hatena.ne.jp・sample77=getpocket.com。cdnjs→`/assets/vendor`・Google Fonts→`/assets/fonts`（policy.ts）。
 *
 * 戻すのは「誰が使っても同じ公開の入口」だけ。SBが持っていた画像・動画、誰かのページ・投稿・動画・地図の場所は戻さない
 * （元の持ち主が分かってしまう）。番号は別のホストと重なることがあるので、必ずパスの形まで合わせて戻す。
 */

const RULES: readonly (readonly [RegExp, string])[] = [
  // jsDelivr（npm / GitHub のパッケージ）
  [/https?:\/\/sample22\.example\.test\/(npm|gh)\//g, 'https://cdn.jsdelivr.net/$1/'],
  // Google Hosted Libraries（jQuery 等）
  [/https?:\/\/sample57\.example\.test\/ajax\/libs\//g, 'https://ajax.googleapis.com/ajax/libs/'],
  // jQuery 公式CDN（/jquery-3.6.0.min.js の形だけ）
  [/https?:\/\/sample47\.example\.test\/(jquery-\d[\w.-]*\.js)/g, 'https://code.jquery.com/$1'],
  // cdnjs（匿名化で /assets/vendor にされた。LP-SAKUSEI には無いパスなので読めない）
  [/(^|[^\w/.-])\/assets\/vendor\/ajax\/libs\//g, '$1https://cdnjs.cloudflare.com/ajax/libs/'],
  // unpkg（これも /assets/vendor にされた。パッケージ名@版 の形。cdnjs の ajax/libs は上で戻してある）
  [/(^|[^\w/.-])\/assets\/vendor\/(?!ajax\/libs\/)((?:@[\w.-]+\/)?[\w.-]+@[\w.-]+\/)/g, '$1https://unpkg.com/$2'],
  // Google Fonts（匿名化で /assets/fonts にされた。CSS の入口と、フォント本体）
  [/(^|[^\w/.-])\/assets\/fonts\/(css2?\?)/g, '$1https://fonts.googleapis.com/$2'],
  // X（旧Twitter）の埋め込みスクリプト
  [/https?:\/\/sample19\.example\.test\/widgets\.js/g, 'https://platform.twitter.com/widgets.js'],
  // Vimeo Player API
  [/https?:\/\/sample50\.example\.test\/api\/player\.js/g, 'https://player.vimeo.com/api/player.js'],
  // YouTube IFrame Player API
  [/https?:\/\/sample41\.example\.test\/iframe_api/g, 'https://www.youtube.com/iframe_api'],
  // はてなブックマークのボタン
  [/https?:\/\/sample88\.example\.test\/js\/bookmark_button\.js/g, 'https://b.st-hatena.com/js/bookmark_button.js'],
  // LINE のソーシャルプラグイン
  [/https?:\/\/sample39\.example\.test\/social-plugins\//g, 'https://www.line-website.com/social-plugins/'],
  // 共有ボタンの行き先（公開の共有の入口）
  [/https?:\/\/sample82\.example\.test\/sharer\.php/g, 'https://www.facebook.com/sharer.php'],
  [/https?:\/\/sample97\.example\.test\/(share|intent\/tweet)\?/g, 'https://twitter.com/$1?'],
  [/https?:\/\/sample57\.example\.test\/lineit\//g, 'https://social-plugins.line.me/lineit/'],
  [/https?:\/\/sample66\.example\.test\/entry\//g, 'https://b.hatena.ne.jp/entry/'],
  [/https?:\/\/sample77\.example\.test\/edit\?/g, 'https://getpocket.com/edit?'],
  // 匿名化がホスト名と取り違えたスクリプトの中の名前（末尾の .link・.NET などが実在のドメインの末尾に見えた）。
  // fakeHost に元の名前を入れて番号を計算して確かめ（sample78=select.dataset.link・sample53=active.link・sample80=dataset.link・
  // sample77=item.link・sample02=youtube.com・sample12=VB.NET）、書かれていた場所の形でだけ戻す
  // （同じ番号が本物のホストにも使われているので、URLの中は戻さない）
  [/(\[name="' \+ )sample78\.example\.test( \+ '"\])/g, '$1select.dataset.link$2'],
  [/(=== )sample53\.example\.test(\)|\.getAttribute\()/g, '$1active.link$2'],
  [/(\.children\[i\]\.)sample80\.example\.test(\))/g, '$1dataset.link$2'],
  [/(`\.)sample77\.example\.test(-\$\{)/g, '$1item.link$2'],
  [/(src\.includes\(")sample02\.example\.test("\))/g, '$1youtube.com$2'],
  [/(name: ")sample12\.example\.test(")/g, '$1VB.NET$2'],
]

export function restorePublicUrls(html: string): string {
  let out = html
  for (const [pattern, to] of RULES) out = out.replace(pattern, to)
  return out
}
