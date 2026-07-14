import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  const projects = await locals.repository.listOrganizerProjects();
  return { projects };
};
