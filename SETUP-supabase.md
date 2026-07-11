# Supabase 接続セットアップ手順

現状はインメモリのデモ実装で動いています。以下を行うと実データベース（Supabase 無料枠）へ接続する準備が整います。ここまで済んだら、次のステップでアプリのリポジトリを Supabase 実装に差し替え、ライブ検証します。

## 1. プロジェクト作成（無料）

1. https://supabase.com にアクセスし、GitHub 等でサインアップ（無料）。
2. 「New project」を作成。
   - Name: `daredeza`（任意）
   - Database Password: 強力なものを生成して控える
   - Region: `Northeast Asia (Tokyo)` が近い
3. 作成完了まで1〜2分待つ。

## 2. スキーマを流し込む

1. 左メニュー「SQL Editor」→「New query」。
2. リポジトリの [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) の中身を全部コピペ。
3. 「Run」で実行。テーブル・RLS・ビューが作成される。

## 3. Storage バケットを作る（画像アップロード用）

1. 左メニュー「Storage」→「New bucket」。
2. 名前 `submissions`、Public は **オフ**（非公開）。
   - 画像はサーバ経由の署名付きURLで配信する想定（作者匿名性のため直リンクにしない）。

## 4. API キーを取得して .env に設定

1. 左メニュー「Project Settings」→「API」。
2. 次をコピーしてプロジェクト直下の `.env`（`.env.example` をコピーして作成）に記入:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role`（secret）→ `SUPABASE_SERVICE_ROLE_KEY`
3. `SESSION_SECRET` も長いランダム文字列に設定:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

> ⚠️ `service_role` キーはDBを全権限で操作できる秘密鍵です。サーバ側だけで使い、クライアントに出さない・Gitにコミットしないでください（`.env` は `.gitignore` 済み）。

## 5. 次のステップ（こちらで実装）

`.env` が揃ったら教えてください。以下をこちらで実装してライブ検証します:

- `src/lib/server/supabase.ts`（service_role クライアント）
- `src/lib/server/supabase-repo.ts`（`Repository` の Supabase 実装）
- `src/lib/server/index.ts` の差し替え（env が揃えば Supabase、無ければインメモリ）
- 画像アップロード（Exif 除去 → Storage 保存 → 署名URL配信）
- 実際の提出→シャッフル実行→作画→投票→結果のフロー

## 匿名性についての設計メモ

- RLS は既定「全拒否」。公開企画のメタ情報だけ anon に開放。
- `designs.author_id` / `assignments.*` / `artworks.artist_id` などの正解データは anon 向けポリシーを作らない＝サーバ（service_role）経由でのみ、フェーズを検証して取得。
- 秘匿解除は Result フェーズのみ（`src/lib/domain/phase.ts` の `mayRevealAuthors()`）。
