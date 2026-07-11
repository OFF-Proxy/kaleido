import { error, fail } from "@sveltejs/kit";
import { repository } from "$lib/server/index.js";
import { PHASE_ORDER, PHASE_META } from "$lib/domain/phase.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
  const overview = await repository.getOrganizerOverview(params.projectId);
  if (!overview) error(404, "企画が見つかりません。");

  const phases = PHASE_ORDER.map((p) => ({
    key: p,
    label: PHASE_META[p].label,
    current: p === overview.project.phase,
  }));

  return { overview, phases };
};

export const actions: Actions = {
  advance: async ({ params }) => {
    await repository.advanceProjectPhase(params.projectId, "next");
    return { done: "フェーズを進めました。" };
  },
  rewind: async ({ params }) => {
    await repository.advanceProjectPhase(params.projectId, "prev");
    return { done: "フェーズを戻しました。" };
  },
  shuffle: async ({ params }) => {
    const r = await repository.runShuffle(params.projectId);
    if (!r.ok) return fail(400, { message: r.reason ?? "シャッフルに失敗しました。" });
    return { done: "シャッフルを実行しました。" };
  },
  toggleArtist: async ({ params, request }) => {
    const form = await request.formData();
    const value = form.get("value") === "on";
    await repository.setExcludeArtistGuess(params.projectId, value);
    return { done: "設定を更新しました。" };
  },
  nudge: async ({ params }) => {
    const n = await repository.nudgeUnsubmitted(params.projectId);
    return { done: `未提出者 ${n}人に催促を送りました。` };
  },
};
