import {
  repository,
  DEMO_RESULT_PROJECT_ID,
} from "$lib/server/memory-repo.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  const [project, results, ranking] = await Promise.all([
    repository.getProject(DEMO_RESULT_PROJECT_ID),
    repository.getRevealedResults(DEMO_RESULT_PROJECT_ID),
    repository.getParticipantRanking(DEMO_RESULT_PROJECT_ID),
  ]);
  return { project, results, ranking };
};
