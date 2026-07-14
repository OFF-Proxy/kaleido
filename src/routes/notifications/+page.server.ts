import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.participation) {
    return { items: [], isParticipant: false };
  }
  const items = await locals.repository.listNotifications(
    locals.participation.id,
  );
  // 一覧を取得してから既読化（次回からベルのバッジが消える）。
  await locals.repository.markNotificationsRead(locals.participation.id);
  return { items, isParticipant: true };
};
