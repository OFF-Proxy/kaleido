import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

/** D1接続の確認用（開発時のみの一時ルート）。/d1-check にアクセス。 */
export const GET: RequestHandler = async ({ platform }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({
      ok: false,
      reason:
        "platform.env.DB が取得できません。adapter-cloudflare の platform emulation が有効か、wrangler.toml の d1 binding を確認してください。",
    });
  }
  try {
    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all();
    const projects = await db
      .prepare("SELECT count(*) as n FROM projects")
      .first<{ n: number }>();
    return json({
      ok: true,
      tables: (tables.results ?? []).map((r) => (r as { name: string }).name),
      projects: projects?.n ?? 0,
    });
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
};
