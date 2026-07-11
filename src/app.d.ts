import type { Participation } from "$lib/domain/types.js";

declare global {
  namespace App {
    interface Locals {
      /** セッションCookieから解決した現在の参加者。未ログインなら null。 */
      participation: Participation | null;
    }
    /**
     * Cloudflare のバインディング（本番/preview で注入される）。
     * ローカルの `vite dev` では未注入なので env は undefined になり、
     * リポジトリはインメモリのデモ実装にフォールバックする。
     * 型は @cloudflare/workers-types 導入後に D1Database / R2Bucket へ厳密化する。
     */
    interface Platform {
      env?: {
        DB?: unknown; // D1Database
        BUCKET?: unknown; // R2Bucket
      };
    }
  }
}

export {};
