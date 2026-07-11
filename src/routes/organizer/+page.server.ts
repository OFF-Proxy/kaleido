import { repository } from "$lib/server/index.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  const projects = await repository.listOrganizerProjects();
  return { projects };
};
