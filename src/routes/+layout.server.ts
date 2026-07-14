import type { LayoutServerLoad } from "./$types.js";

/** 全ページに現在の参加者（セッション）と未読通知数を渡す。 */
export const load: LayoutServerLoad = async ({ locals }) => {
  const unread = locals.participation
    ? await locals.repository.unreadNotificationCount(locals.participation.id)
    : 0;
  return { me: locals.participation, unread };
};
