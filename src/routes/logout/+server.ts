import { redirect } from "@sveltejs/kit";
import {
  SESSION_COOKIE,
  ORG_SESSION_COOKIE,
} from "$lib/server/session.js";
import type { RequestHandler } from "./$types.js";

/** ログアウト: 参加者・主催の両セッションCookieを消してトップへ。 */
export const GET: RequestHandler = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
  cookies.delete(ORG_SESSION_COOKIE, { path: "/" });
  redirect(303, "/");
};
