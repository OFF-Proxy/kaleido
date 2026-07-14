import { error, redirect } from "@sveltejs/kit";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  makeSessionToken,
} from "$lib/server/session.js";
import type { RequestHandler } from "./$types.js";

/**
 * 招待リンク: /join/<invite_token>
 * トークンを検証し、正しければセッションCookieを発行してダッシュボードへ。
 * これが「参加者ごと個別トークン」による識別の入口（要件 F-02 / 8.1）。
 */
export const GET: RequestHandler = async ({ params, cookies, locals }) => {
  const participation = await locals.repository.getParticipationByInviteToken(
    params.token,
  );
  if (!participation) {
    error(404, "招待リンクが無効です。主催者に確認してください。");
  }
  cookies.set(
    SESSION_COOKIE,
    await makeSessionToken(participation.id),
    SESSION_COOKIE_OPTIONS,
  );
  redirect(303, "/dashboard");
};
