# Kaleido

イラスト企画で遊ぶプラットフォーム。絵師どうしのお題企画を、募集から結果発表まで1か所で運営できる。第一弾の企画が「誰がデザインしたかを当てる」**誰デザ**（要件は [`要件定義_v1.1.md`](./要件定義_v1.1.md)）。今後ほかのイラスト企画も追加していく。

## 技術スタック

- **SvelteKit（Svelte 5）** — フルスタック。サーバ側 `load` / form actions が匿名性のアクセス制御に相性が良い
- **Tailwind CSS v4** — デザインシステム（`src/app.css`）
- **バックエンド: Cloudflare Pages + D1(SQLite) + R2** — 永続無料・一時停止なし。認証は Web Crypto でエッジ対応。現在はインメモリのデモ実装で、D1接続は `SETUP-cloudflare.md` 参照
- デプロイ: Cloudflare Pages（無料枠）

## デザイン

「ギャラリーダーク」= 近黒のキャンバスにラベンダー1色差し（`design-md/linear.app` 由来）。作品を主役に、UIは黒子に徹する。絵師が慣れた暗い制作環境になじみ、強い色のイラストが映える方針。

## 実装状況

| 領域 | 状態 | 場所 |
|------|------|------|
| シャッフル自動割当（F-08 / derangement） | ✅ 実装・テスト済 | `src/lib/domain/shuffle.ts` |
| 採点ロジック（F-18 / 自作除外・観覧者分離） | ✅ 実装・テスト済 | `src/lib/domain/scoring.ts` |
| フェーズ状態機械（第9章 / 秘匿境界） | ✅ 実装済 | `src/lib/domain/phase.ts` |
| データモデル型（第7章） | ✅ 実装済 | `src/lib/domain/types.ts` |
| リポジトリ抽象＋インメモリ実装 | ✅ 実装済（デモデータ） | `src/lib/server/` |
| 画面: ホーム/ダッシュボード/投票/ギャラリー/結果 | ✅ 骨格 | `src/routes/` |
| 認証（個別トークン）・画像アップロード・DB接続 | ⬜ 未着手 | — |

匿名性の要: 公開向けメソッド（`getPublicArtworkCards` 等）は作者・作画者を返さない。秘匿解除は `phase.ts` の `mayRevealAuthors()` が `Result` フェーズでのみ true。

## 開発

```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド
npm test         # ドメインのユニットテスト（node:test、14ケース）
npm run check    # svelte-check（型）
```

## このフォルダについて

以前は ARCANA ポートフォリオ（Astro）の中に入れ子で置いていたが、別プロジェクトのため独立フォルダへ分離した。ARCANA とはポート・依存・ビルドすべて別。
