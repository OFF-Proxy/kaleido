import { redirect } from "@sveltejs/kit";
import { SESSION_COOKIE } from "$lib/server/session.js";
import type { RequestHandler } from "./$types.js";

/** ログアウト: セッションCookieを消してトップへ。 */
export const GET: RequestHandler = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
  redirect(303, "/");
};
