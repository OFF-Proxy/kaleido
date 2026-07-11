# Cloudflare デプロイ セットアップ手順（永続無料構成）

構成: **Cloudflare Pages（ホスティング）+ D1（SQLite DB）+ R2（画像ストレージ）**。
一時停止なし・非商用制限なしで、放置でも無料のままにできる。

> ローカルの日常開発は今まで通り `npm run dev`（インメモリのデモ）でOK。wrangler が要るのは
> 「D1/R2 の作成・マイグレーション・本番プレビュー・デプロイ」のときだけ。

---

## 1. アカウントと CLI

1. https://dash.cloudflare.com で無料アカウント作成。
2. 依存を入れ替える（プロジェクト直下で）:
   ```
   npm rm @sveltejs/adapter-auto
   npm i -D @sveltejs/adapter-cloudflare wrangler @cloudflare/workers-types
   ```
3. `svelte.config.js` のアダプタを差し替える（下記の内容に）:
   ```js
   import adapter from "@sveltejs/adapter-cloudflare";
   import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

   const config = {
     preprocess: vitePreprocess(),
     kit: { adapter: adapter() },
   };
   export default config;
   ```
   > これはビルド時のみ影響。`npm run dev` は引き続きプレーンに動く。
4. ログイン: `npx wrangler login`

## 2. D1（データベース）を作成してマイグレーション

1. 作成:
   ```
   npx wrangler d1 create kaleido-db
   ```
   出力の `database_id` を `wrangler.toml` の `PLACEHOLDER_D1_DATABASE_ID` に貼る。
2. スキーマ適用（`migrations/0001_init.sql` が自動で対象）:
   ```
   npx wrangler d1 migrations apply kaleido-db --remote
   ```
   ローカルでも試すなら `--local` 版も実行。

## 3. R2（画像ストレージ）を作成

```
npx wrangler r2 bucket create kaleido-submissions
```
画像はサーバ経由（署名URL/プロキシ）で配信し、作者匿名性のため直リンクにしない。

## 4. シークレット（セッション署名鍵）

- 本番: 
  ```
  npx wrangler pages secret put SESSION_SECRET
  ```
  値は次で生成した長いランダム文字列:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- ローカルで wrangler 経由の動作確認をする場合はプロジェクト直下に `.dev.vars`:
  ```
  SESSION_SECRET=＜同様のランダム文字列＞
  ```
  （`.dev.vars` と `.wrangler/` は `.gitignore` 済み）

## 5. デプロイ

いずれか:

- **GitHub 連携（推奨・自動デプロイ）**: Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git → このリポジトリを選択。
  - Build command: `npm run build`
  - Build output directory: `.svelte-kit/cloudflare`
  - D1 / R2 バインディングと `SESSION_SECRET` を Pages プロジェクトの設定で紐付け。
- **手動**:
  ```
  npm run build
  npx wrangler pages deploy .svelte-kit/cloudflare
  ```

## 6. ここまで終わったら（こちらで実装）

D1 と R2 ができたら教えてください。次をこちらで実装してライブ検証します:

- `src/lib/server/d1-repo.ts`（`Repository` の D1 実装）と `getRepository()` の接続
- 画像アップロード（Exif 除去 → R2 保存 → サーバ経由で配信）
- 実際の提出 → シャッフル実行 → 作画 → 投票 → 結果 のフロー

## メモ

- Postgres 版だった `supabase/` 配下は Supabase 案の名残（未使用）。D1 採用に伴い参照しない。
- 認証は Web Crypto（`src/lib/server/session.ts`）でエッジ対応済み。`node:crypto` 依存なし。
- D1 には RLS が無いため、匿名性のアクセス制御はサーバコードで担保（公開向けは作者列を返さない）。
