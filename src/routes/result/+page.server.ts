import { DEMO_PROJECT_ID } from "$lib/server/memory-repo.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals, url }) => {
  const pid = url.searchParams.get("p") ?? DEMO_PROJECT_ID;
  const [project, results, ranking] = await Promise.all([
    locals.repository.getProject(pid),
    locals.repository.getRevealedResults(pid),
    locals.repository.getParticipantRanking(pid),
  ]);
  // results/ranking は Result フェーズでのみ中身が入る（それ以外は空）。
  const revealed = project?.phase === "Result";
  return {
    projectId: pid,
    project,
    gameType: project?.gameType ?? "daredeza",
    results,
    ranking,
    revealed,
  };
};
