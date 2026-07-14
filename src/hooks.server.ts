import type { Handle } from "@sveltejs/kit";
import { SESSION_COOKIE, readSessionToken } from "$lib/server/session.js";
import { getRepository } from "$lib/server/index.js";

/**
 * 全リクエストで、リポジトリ（D1 or インメモリ）を選び locals に載せ、
 * セッションCookieから現在の参加者を解決する。
 * 各 load / action は event.locals.repository / event.locals.participation を使う。
 */
export const handle: Handle = async ({ event, resolve }) => {
  const repository = getRepository(event.platform);
  event.locals.repository = repository;

  const raw = event.cookies.get(SESSION_COOKIE);
  const participationId = await readSessionToken(raw);
  event.locals.participation = participationId
    ? await repository.getParticipationById(participationId)
    : null;

  return resolve(event);
};
