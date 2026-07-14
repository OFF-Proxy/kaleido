import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals, url }) => {
  const filter = url.searchParams.get("q")?.trim() || "";
  const projects = await locals.repository.listPublicProjects(filter || undefined);

  const recruiting = projects.filter(
    (p) => p.phase === "Recruiting" || p.phase === "DesignSubmission",
  );
  const voting = projects.filter((p) => p.phase === "Voting");
  const finished = projects.filter((p) => p.phase === "Result");

  return { filter, recruiting, voting, finished, total: projects.length };
};
