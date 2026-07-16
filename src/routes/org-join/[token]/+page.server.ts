import { error, fail, redirect } from "@sveltejs/kit";
import {
  ORG_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  makeOrgSessionToken,
  readCohostInviteToken,
} from "$lib/server/session.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params, locals }) => {
  const projectId = await readCohostInviteToken(params.token);
  if (!projectId) error(404, "招待リンクが無効です。");
  const project = await locals.repository.getProject(projectId);
  if (!project) error(404, "企画が見つかりません。");
  return { projectId, projectTitle: project.title, theme: project.theme };
};

export const actions: Actions = {
  default: async ({ params, request, locals, cookies }) => {
    const projectId = await readCohostInviteToken(params.token);
    if (!projectId) return fail(400, { message: "招待リンクが無効です。" });
    const project = await locals.repository.getProject(projectId);
    if (!project) return fail(400, { message: "企画が見つかりません。" });

    const f = await request.formData();
    const displayName = String(f.get("displayName") ?? "").trim();
    if (!displayName) {
      return fail(400, { message: "表示名を入力してください。" });
    }

    const userId = await locals.repository.addCohost(projectId, displayName);

    // 共同ホストとして主催セッションを付与。
    cookies.set(
      ORG_SESSION_COOKIE,
      await makeOrgSessionToken(userId),
      SESSION_COOKIE_OPTIONS,
    );

    redirect(303, `/organizer/${projectId}`);
  },
};
