/**
 * リポジトリ選択の継ぎ目（サーバ専用）。
 *
 * Cloudflare の D1 バインディング（platform.env.DB）があれば D1 実装、
 * 無ければインメモリのデモ実装を使う。各 load/action は
 * `event.locals.repository`（hooks.server.ts で設定）を使う。
 */
import type { Repository } from "./repository.js";
import { repository as memoryRepository } from "./memory-repo.js";
import { createD1Repository } from "./d1-repo.js";

export function getRepository(platform?: App.Platform): Repository {
  const db = platform?.env?.DB;
  if (db) return createD1Repository(db);
  return memoryRepository;
}

/** プラットフォーム非依存の箇所からのデフォルト参照（インメモリ）。 */
export const repository: Repository = memoryRepository;
