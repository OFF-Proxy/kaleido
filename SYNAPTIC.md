# プロジェクト概要

- **プロダクト名**: Kaleido（カレイド）
- **目的**: イラスト企画（お絵描きパーティゲーム）を「募集→提出→投票→結果発表」まで1か所で回すWebプラットフォーム。絵師コミュニティ向け。
- **搭載ゲーム（2種）**:
  - **誰デザ（daredeza）**: お題でキャラを匿名デザイン提出 → 別の人が作画 → 「誰がデザインしたか」を当てる。
  - **絵柄当て（egaraate）**: 各自が自分の絵柄で1枚描いて提出 → 「誰が描いたか」を絵柄から当てる。
- **対応プラットフォーム**: **PC・モバイル両方**（レスポンシブWeb。ネイティブアプリは無い）。ブラウザで動作。
- **開発フェーズ**: MVP／スケルトン段階。デモデータ（seed）と本番D1接続の両方で動作。中核ロジック（シャッフル・採点・匿名性・フェーズ）は実装済み。画像アップロードやデザイン提出UIなど一部は未実装（後述）。
- **ホスティング**: Cloudflare Pages（無料枠運用が前提）。

---

# アーキテクチャと技術スタック

- **フレームワーク**: SvelteKit（**Svelte 5 runes**: `$props`/`$state`/`$derived`/`$page`、`use:enhance`、`untrack`、`{#snippet}`）。
- **言語**: TypeScript（strict）。
- **スタイル**: Tailwind CSS v4（`@theme`・CSSカスタムプロパティ）。デザインテーマは "KINETIC EDITORIAL NOIR"（暗背景 `#0c0c11`＋バイオレット `#a06bff`＋ライム `#d4ff3d`、斜め3Dボタン）。`src/app.css` に集約。
- **ビルド**: Vite 8（Node 24対応のため v8 必須。旧Viteは無言終了する）。
- **ホスティング／永続化**:
  - **Cloudflare Pages** + **adapter-cloudflare**。
  - **D1（SQLite）**: `platform.env.DB`（wrangler.toml binding=`DB`、database_name=`kaleido-db`）。スキーマは `migrations/0001_init.sql`。
  - **R2（画像ストレージ）**: **未接続（コメントアウト中）**。画像は当面 data URL 文字列としてD1に保存。
- **認証**: 参加者ごとの**個別招待トークン** → 参加者IDを **HMAC-SHA256** で署名した値を httpOnly Cookie（`dd_session`）に保存。署名検証で成りすまし防止。Web Crypto（`crypto.subtle`）使用で edge/Node 両対応。本番は `SESSION_SECRET` 必須。
- **リポジトリパターン（重要）**: `Repository` インタフェース（`src/lib/server/repository.ts`）に対し2実装。
  - `createD1Repository(db)`（`d1-repo.ts`）… 本番・開発の実データ経路。
  - `repository`（`memory-repo.ts`）… インメモリのデモ実装（フォールバック）。
  - 選択は `getRepository(platform)`（`index.ts`）= `platform.env.DB` があればD1、無ければメモリ。
  - 各リクエストで `hooks.server.ts` が `event.locals.repository` と `event.locals.participation` をセット。全 load/action はこれを使う。
- **ディレクトリ構造の特記**:
  - `src/lib/domain/` … **純粋ロジック**（UI・DB非依存、両リポジトリで再利用、単体テスト対象）。
  - `src/lib/server/` … サーバ専用（DB/認証/ストレージ）。`$lib/server` はクライアントから import 不可（型のみ可）。
  - `src/routes/` … ページ（`+page.svelte`）とサーバ処理（`+page.server.ts` / `+server.ts`）。

---

# コードマップ（BOTの現地読み込み用インデックス）

症状・トピック → まず読むべき場所（詳細は `read_file` で現地確認）。

| 症状／トピック | 見るべきファイル |
|---|---|
| フェーズ遷移・秘匿境界（作者をいつ開示するか） | `src/lib/domain/phase.ts` |
| シャッフル／自動割当／希望難易度の最適化 | `src/lib/domain/shuffle.ts` |
| 採点・正解率ランキング・作品ごとの正解数 | `src/lib/domain/scoring.ts` |
| データ型・DTO（作者を伏せた公開用ビュー） | `src/lib/domain/types.ts` |
| 乱数（テスト用seed / 本番crypto） | `src/lib/domain/rng.ts` |
| 画像メタデータ（Exif）除去 | `src/lib/domain/image-metadata.ts` |
| リポジトリの契約（全メソッド定義） | `src/lib/server/repository.ts` |
| D1のSQL実装（本番経路のバグはここ） | `src/lib/server/d1-repo.ts` |
| デモ／フォールバック実装 | `src/lib/server/memory-repo.ts` |
| 認証・セッションCookie・署名 | `src/lib/server/session.ts` |
| R2保存ヘルパ（未接続） | `src/lib/server/storage.ts` |
| DBスキーマ・外部キー・View | `migrations/0001_init.sql` |
| 投票フロー（重複防止・自作品除外・観覧者ゲート） | `src/routes/vote/+page.server.ts` / `+page.svelte` |
| 作品提出（絵柄当て・画像縮小・Exif落とし） | `src/routes/submit/+page.server.ts` / `+page.svelte` |
| 主催ダッシュボード（フェーズ・シャッフル・催促） | `src/routes/organizer/[projectId]/+page.server.ts` / `+page.svelte` |
| 企画作成フォーム（ゲーム種別・公開範囲） | `src/routes/organizer/new/+page.server.ts` / `+page.svelte` |
| 結果発表・共有カード（OGP画像） | `src/routes/result/+page.server.ts` / `+page.svelte` / `result/card.svg/+server.ts` |
| 閲覧一覧（公開/限定公開・界隈フィルタ） | `src/routes/explore/+page.server.ts` / `+page.svelte` |
| 参加者ダッシュボード | `src/routes/dashboard/+page.server.ts` |
| 招待リンク入口 | `src/routes/join/[token]/+server.ts` |
| 通知（ベル・催促・開始） | `src/routes/notifications/` / `+layout.svelte` |
| リクエスト共通処理（repo/participation注入） | `src/hooks.server.ts` |
| デモ投入・作り直し（開発専用） | `src/routes/admin/seed/+server.ts` |
| D1疎通確認（開発専用） | `src/routes/d1-check/+server.ts` |

---

# 主要機能と使用ツール

（詳細な can/cannot は同梱の `features.registry.json` を正とする。ここは概観。）

- **主催**: 企画作成（ゲーム種別・公開範囲・締切・参加者名を入力）、企画一覧、ダッシュボード（フェーズ前進/巻き戻し、シャッフル実行、作画者除外の切替、未提出者へ催促、招待リンク配布、匿名の割当確認）。
- **参加者**: 招待リンクから参加、絵柄当ての作品提出（画像は自動縮小＋Exif除去）、投票、通知ベル。
- **観覧者（非参加者）**: `/explore` で公開企画を閲覧、投票開放された企画へ匿名投票。
- **共通**: 投票ページ、ギャラリー、結果発表＋X共有カード。
- **ゲーム別のフェーズ**:
  - 誰デザ: `Draft→Recruiting→DesignSubmission→Shuffling→ArtworkSubmission→Voting→Result`
  - 絵柄当て: `Draft→Recruiting→ArtworkSubmission→Voting→Result`（デザイン提出・シャッフルが無い）

---

# コーディング規約・制約

- **匿名性が最優先の設計原則**。「作品（Design/Artwork）↔ 作者（Participation）」の紐付けは秘匿対象。公開向けメソッドは作者情報を含まない DTO のみ返す。**開示は Result フェーズのみ**（`phase.ts > mayRevealAuthors`）。主催にも「どのデザインが誰か」は匿名ラベル（`デザイン #n` / `作画者 #n`、ハッシュ順で本人を辿れない）でしか見せない。
- **D1にRLSは無い**ため、アクセス制御は**アプリ層（サーバコード）で一元管理**。DTO射影で作者を落とす。
- **`matchCost` の意味（変更禁止の意図）**: 希望シャッフルのコストは「デザイン難易度 > 作画者の許容（希望上限）」のときだけ罰則。易しすぎる割当は罰しない（cost 0 ⟺ 希望充足）。`src/lib/domain/shuffle.ts`。
- **`src/lib/domain/` はUI・DB非依存を維持**（両リポジトリで再利用するため副作用・import禁止）。
- **`$lib/server/*` はクライアントへ import しない**（型のみ `import type` で可）。
- **未実装として固定の事実**:
  - **R2未接続**。画像は data URL でD1に保存。提出UIがあるのは**絵柄当てのみ**。
  - **誰デザのデザイン提出／作画提出の専用UIは未実装**（デモは `admin/seed` で投入。実運用フローは今後）。
  - **共同ホスト（cohost）追加UIは未実装**（DBの `project_organizers` テーブルは存在）。
  - **緊急開示（F-29）・監査ログのUIは未実装**（`audit_logs` テーブルのみ存在）。
  - **締切（deadline_*）はサーバ強制されない**。表示・目安のみ。
- **開発専用ルート**: `/admin/seed`（`?reset=1` で作り直し）と `/d1-check`。**本番前に保護／削除する**。
- **本番の秘密**: `SESSION_SECRET` を必ず設定（未設定だと `dev-insecure-secret-change-me` が使われ危険）。

---

# トリアージ基準（バグ分類の判定ロジック）

共通Enum（`type`: 不具合／クラッシュ／UI／パフォーマンス、`priority`: 高／中／低、`platform`: PC／モバイル）に沿って判定する。

**type の切り分け**
- **クラッシュ**: 画面が真っ白／500エラー／操作不能・例外落ち。SvelteKitの `error(...)`・load/action の throw、D1の `D1_ERROR` を伴うものは原則ここ。
- **不具合（機能バグ）**: 落ちはしないが結果が間違う。例）投票が保存されない、重複投票を弾けない、シャッフルで自分に自分が回る、結果の正解数が合わない、匿名のはずの作者が見えてしまう（＝**秘匿漏れは重大**）。
- **UI**: 見た目・レイアウト崩れ・文言・ボタン位置・レスポンシブ崩れ。機能は正しく動くもの。
- **パフォーマンス**: 表示が遅い・重い。特に**画像 data URL 起因の重さ**（大きな画像で提出/一覧が重い）はここ。

**priority の目安**
- **高**: クラッシュ、**データ消失**（提出物・投票が消える）、**匿名性の破れ**（作者/作画者がResult前に露出）、複数ユーザーからの同一報告、投票や提出が全くできない。
- **中**: 特定条件で再現する機能バグ、片方のプラットフォームだけで起きる不具合、回避策があるもの。
- **低**: 軽微なUI崩れ・文言・単発の再現性低い事象。

**platform の見分け方**
- レスポンシブWebなので、**画面幅依存の崩れ**（ヘッダー横スクロール・カード段組み・投票の固定バー）はモバイル起因が多い。ファイル選択→画像縮小（`submit/+page.svelte` の canvas 処理）はモバイルブラウザ差が出やすい。
- ロジック（シャッフル・採点・保存）のバグは基本 PC/モバイル 両方。切り分けできなければ両方タグ。

**「クラッシュ」と「不具合」で迷ったら**: 例外で処理が止まる=クラッシュ、処理は完了するが答えが違う=不具合。

---

# 既知の落とし穴【最重要 — エラー時はまずここを確認】

チェックリスト。的外れ回答を防ぐ最強のバリア。

1. **シャッフル再実行で作品が消える（外部キー連鎖削除）** ← 最頻・最重要。
   - `artworks.assignment_id` が `assignments(id) ON DELETE CASCADE`。旧実装では `runShuffle` の `DELETE FROM assignments` が**作画済み作品まで巻き込んで削除**していた。
   - 現在は**作品が1件でもあればシャッフル不可**にガード済み（`d1-repo.ts` / `memory-repo.ts` の `runShuffle`、主催UIもボタン無効化）。
   - 「作品が消えた／投票の絵が出ない」報告は、**ガード前の誤シャッフル**か**フェーズ操作**を疑う。復旧はデモなら `/admin/seed?reset=1`。
2. **画像は data URL でD1保存（R2未接続）**。
   - 提出画像はクライアント（`submit/+page.svelte` の canvas）で縮小して data URL 化、サーバ側上限 **約1.5MB**。「画像が大きすぎる」エラーやアップロード失敗はこの縮小・上限まわり。Exifはcanvas再エンコードで自動的に落ちる。
3. **投票の3制約**（`vote/+page.server.ts`）。ここを外すとバグに見える。
   - 自作品は投票対象外。
   - **同じ人を複数作品に選べない（1人1作品）**。サーバで重複拒否＋UIで選択済みを無効化。
   - 誰デザで主催が「作画者除外」をONにすると、その作品の作画者は候補から消える（絵柄当てでは作画者=答えなので除外しない）。
4. **観覧者投票ゲート**: 非参加者が投票できるのは `isPublic`（観覧者投票開放）がONの企画のみ。OFFなら 403「参加者限定」。`visibility`（公開範囲）とは**別軸**（visibility=一覧掲載/界隈限定、isPublic=観覧者が投票可か）。
5. **`vote`/`result` は `?p=<projectId>` 対応、`dashboard`/`gallery` はデモ企画固定**。
   - `dashboard` と `gallery` は `DEMO_PROJECT_ID`（`demo-daredeza`）をハードコード。作成した実企画の参加者がここを見ると**デモが表示される**（既知の制限）。実企画の投票/結果は `?p=` 付きURLで。
6. **メモリ実装は単一デモ企画中心**。`memory-repo.ts` の公開作品取得等はデモの `displayOrder` 前提の箇所がある。**実運用はD1経路**（`platform.env.DB` 有り）。開発でもデモseedはD1に入る。「作成した企画の作品が出ない」はメモリ経路で見ている可能性。
7. **開発の環境依存トラブル**:
   - `node_modules` は**プラットフォーム固有バイナリ**（workerd / esbuild）を含む。OSをまたいでコピーすると `You installed X for another platform` エラー。**各OSで `npm install` し直す**。
   - **日本語を含むフォルダパスは esbuild を壊す**ことがある。プロジェクトフォルダはASCII名（`kaleido`）に保つ。
   - Node 24 では **Vite 8 必須**（旧Viteは無言で終了）。
8. **匿名性の境界**: `getPublicArtworkCards`・`getBallotChoices`・結果系は **Voting 到達後 / Result 到達後にしか中身を返さない**（`isAtOrAfter` / `mayRevealAuthors`）。「投票ページが空」はフェーズがVoting未満の正常動作の可能性。
9. **`admin/seed` のUNIQUE衝突**: `?reset=1` は企画を消すが `users`（`u-demo`）は残るため、ユーザーは `INSERT OR IGNORE` で再投入する。seed失敗時はここを確認。
10. **セッション**: Cookie名は参加者 `dd_session`（HMAC署名）、観覧者の投票重複抑止は `dd_anon`。署名不一致（`SESSION_SECRET` 変更後など）は静かに未ログイン扱いになる。
11. **フェーズはゲーム別**。絵柄当ては `DesignSubmission`/`Shuffling` を飛ばす（`phase.ts > phasesForGame` / `nextPhaseFor` / `prevPhaseFor`）。「絵柄当てでシャッフルが無い」は仕様。
12. **フェーズの前進/巻き戻しは非破壊**（`UPDATE projects SET phase`）。データは消えない。唯一の破壊操作＝シャッフル（上記1でガード済み）。「戻したら直った/データが戻る」のはこの性質による。

---

# 用語集

- **誰デザ（daredeza）**: 「誰がデザインしたか」を当てるゲーム。
- **絵柄当て（egaraate）**: 「誰が描いたか」を絵柄から当てるゲーム。
- **デザイン（design）**: 誰デザで参加者が出すキャラ案。`designs` テーブル。作者＝ `author_id`（秘匿）。
- **作画（artwork）**: 提出された絵。`artworks` テーブル。作画者＝ `artist_id`（秘匿）。絵柄当ては自作品なので `design_id`/`assignment_id` が NULL。
- **シャッフル / 割当（assignment）**: 誰デザで「デザイン→別の作画者」を割り当てる処理。**作者≠作画者**を保証する derangement。`preferredDifficulty`（希望上限）を考慮して最適化。
- **難易度（difficulty）/ 希望（preferredDifficulty）**: 各1〜3。作者が「自分のデザインの難しさ」と「回ってきてほしい難易度の上限」を申告。
- **匿名ラベル**: 主催向けに本人を隠した表示（`デザイン #n` / `作画者 #n`）。ハッシュ順で並べ本人特定を防ぐ。
- **フェーズ（phase）**: 企画の進行状態。開示境界を兼ねる。`Draft/Recruiting/DesignSubmission/Shuffling/ArtworkSubmission/Voting/Result`。
- **主催（owner）/ 共同ホスト（cohost）**: 企画運営者。`project_organizers`（cohost追加UIは未実装）。
- **参加者（participation）/ 招待トークン**: 企画への参加単位。`invite_token` で識別、`/join/<token>` が入口。
- **観覧者（viewer）**: 非参加者。公開企画の閲覧・（開放時）投票が可能。匿名。
- **投票用紙（ballot）/ 票（vote）**: 1投票者の一連の推理。`ballots` / `votes`。参加者は `voter_participation_id`、観覧者は `anonymous_key`。
- **公開範囲（visibility）**: `public`（一覧掲載）/ `unlisted`（リンク限定）/ `restricted`（ジャンル・界隈で絞ったときだけ一覧表示）。
- **ジャンル（genre）/ 界隈（circle）**: 企画の分類・コミュニティ。`restricted` の絞り込みキー。
- **isPublic**: 観覧者が投票できるか（公開範囲とは別軸）。
- **DEMO_PROJECT_ID**: デモの誰デザ企画ID `demo-daredeza`（`dashboard`/`gallery`/`vote`/`result` の既定）。絵柄当てデモは `demo-egaraate`。
