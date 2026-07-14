import { DEMO_PROJECT_ID } from "$lib/server/memory-repo.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  const [project, results, ranking] = await Promise.all([
    locals.repository.getProject(DEMO_PROJECT_ID),
    locals.repository.getRevealedResults(DEMO_PROJECT_ID),
    locals.repository.getParticipantRanking(DEMO_PROJECT_ID),
  ]);
  // results/ranking は Result フェーズでのみ中身が入る（それ以外は空）。
  const revealed = project?.phase === "Result";
  return { project, results, ranking, revealed };
};
