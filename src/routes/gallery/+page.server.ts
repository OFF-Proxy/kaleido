import { repository, DEMO_PROJECT_ID } from "$lib/server/memory-repo.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  const [project, cards] = await Promise.all([
    repository.getProject(DEMO_PROJECT_ID),
    repository.getPublicArtworkCards(DEMO_PROJECT_ID),
  ]);
  return { project, cards };
};
