import { DEMO_PROJECT_ID } from "$lib/server/memory-repo.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  const [project, cards] = await Promise.all([
    locals.repository.getProject(DEMO_PROJECT_ID),
    locals.repository.getPublicArtworkCards(DEMO_PROJECT_ID),
  ]);
  return { project, cards };
};
