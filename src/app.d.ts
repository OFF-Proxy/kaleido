/// <reference types="@cloudflare/workers-types" />
import type { Participation } from "$lib/domain/types.js";
import type { Repository } from "$lib/server/repository.js";

declare global {
  namespace App {
    interface Locals {
      /** リクエストごとのリポジトリ（D1 or インメモリ）。hooks.server.ts で設定。 */
      repository: Repository;
      /** セッションCookieから解決した現在の参加者。未ログインなら null。 */
      participation: Participation | null;
    }
    /**
     * Cloudflare のバインディング。本番/preview に加え、adapter-cloudflare の
     * platform emulation により `vite dev` でも注入される（ローカルD1）。
     * バインディングが無い環境ではインメモリ実装にフォールバックする。
     */
    interface Platform {
      env?: {
        DB?: D1Database;
        BUCKET?: R2Bucket;
      };
    }
  }
}

export {};
