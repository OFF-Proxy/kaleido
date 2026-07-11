import { repository } from "$lib/server/index.js";
import { DEMO_PROJECT_ID, DEMO_ME } from "$lib/server/memory-repo.js";
import { PHASE_ORDER, PHASE_META } from "$lib/domain/phase.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  // セッションで参加者が解決できていればその人を、無ければデモ参加者を表示。
  const me = locals.participation;
  const meId = me?.id ?? DEMO_ME;
  const isDemo = me === null;

  const [project, task] = await Promise.all([
    repository.getProject(DEMO_PROJECT_ID),
    repository.getParticipantTask(DEMO_PROJECT_ID, meId),
  ]);
  const phases = PHASE_ORDER.filter((p) => p !== "Draft").map((p) => ({
    key: p,
    label: PHASE_META[p].label,
  }));
  return { project, task, phases, meName: me?.displayName ?? null, isDemo };
};
