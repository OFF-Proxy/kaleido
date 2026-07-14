import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
  const me = locals.participation;
  if (!me) return { me: null, project: null, submitted: false };
  const project = await locals.repository.getProject(me.projectId);
  const submittedId = project
    ? await locals.repository.getMyDesignArtworkId(project.id, me.id)
    : null;
  return { me, project, submitted: submittedId !== null };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const me = locals.participation;
    if (!me) {
      return fail(401, {
        message: "参加者としてログインしてください（招待リンクから参加）。",
      });
    }
    const f = await request.formData();
    const imageUrl = String(f.get("image") ?? "");
    const caption = String(f.get("caption") ?? "")
      .trim()
      .slice(0, 200);
    if (!imageUrl.startsWith("data:image/")) {
      return fail(400, { message: "画像を選んでください。" });
    }
    // data URL は D1 に文字列で保存するため上限を設ける（縮小はクライアント側）
    if (imageUrl.length > 1_500_000) {
      return fail(400, {
        message: "画像が大きすぎます。もう少し小さい画像でお試しください。",
      });
    }
    const r = await locals.repository.submitOwnArtwork({
      projectId: me.projectId,
      participationId: me.id,
      imageUrl,
      caption,
    });
    if (!r.ok) return fail(400, { message: r.reason ?? "提出に失敗しました。" });
    return { success: true };
  },
};
