import type { Handle } from "@sveltejs/kit";
import { SESSION_COOKIE, readSessionToken } from "$lib/server/session.js";
import { repository } from "$lib/server/index.js";

/**
 * 全リクエストで、セッションCookieから現在の参加者を解決して locals に載せる。
 * これにより各ルートの load / action は event.locals.participation を参照できる。
 */
export const handle: Handle = async ({ event, resolve }) => {
  const raw = event.cookies.get(SESSION_COOKIE);
  const participationId = await readSessionToken(raw);
  event.locals.participation = participationId
    ? await repository.getParticipationById(participationId)
    : null;
  return resolve(event);
};
