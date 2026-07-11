/**
 * リポジトリ選択の継ぎ目（サーバ専用）。
 *
 * Cloudflare の D1 バインディング（platform.env.DB）がある本番/preview では
 * D1 実装を、無いローカル `vite dev` ではインメモリのデモ実装を使う。
 * これにより日常のローカル開発は wrangler 無しのプレーンな `vite dev` のまま。
 *
 * 各 load / action は `getRepository(event.platform)` を呼ぶことで、
 * バックエンドの切り替えを一箇所に閉じ込める。
 */
import type { Repository } from "./repository.js";
import { repository as memoryRepository } from "./memory-repo.js";

export function getRepository(platform?: App.Platform): Repository {
  // TODO(d1): D1 実装を接続する。
  //   if (platform?.env?.DB) {
  //     return createD1Repository(platform.env.DB as import("@cloudflare/workers-types").D1Database);
  //   }
  void platform;
  return memoryRepository;
}

/** 後方互換: プラットフォーム非依存の箇所からのデフォルト参照（インメモリ）。 */
export const repository: Repository = memoryRepository;
