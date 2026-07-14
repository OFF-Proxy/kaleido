import { error, fail } from "@sveltejs/kit";
import { PHASE_META, phasesForGame } from "$lib/domain/phase.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params, locals }) => {
  const overview = await locals.repository.getOrganizerOverview(params.projectId);
  if (!overview) error(404, "企画が見つかりません。");

  const isEgaraate = overview.project.gameType === "egaraate";

  const phases = phasesForGame(overview.project.gameType).map((p) => ({
    key: p,
    label: PHASE_META[p].label,
    current: p === overview.project.phase,
  }));

  // 誰デザのみ: 作品が1つでもあるとシャッフル再実行で消えるため作品0のときだけ許可
  const canShuffle = !isEgaraate && overview.counts.artworks === 0;

  return { overview, phases, canShuffle, isEgaraate };
};

export const actions: Actions = {
  advance: async ({ params, locals }) => {
    await locals.repository.advanceProjectPhase(params.projectId, "next");
    return { done: "フェーズを進めました。" };
  },
  rewind: async ({ params, locals }) => {
    await locals.repository.advanceProjectPhase(params.projectId, "prev");
    return { done: "フェーズを戻しました。" };
  },
  shuffle: async ({ params, locals }) => {
    const r = await locals.repository.runShuffle(params.projectId);
    if (!r.ok) return fail(400, { message: r.reason ?? "シャッフルに失敗しました。" });
    return { done: "シャッフルを実行しました。" };
  },
  toggleArtist: async ({ params, request, locals }) => {
    const form = await request.formData();
    const value = form.get("value") === "on";
    await locals.repository.setExcludeArtistGuess(params.projectId, value);
    return { done: "設定を更新しました。" };
  },
  nudge: async ({ params, locals }) => {
    const n = await locals.repository.nudgeUnsubmitted(params.projectId);
    return { done: `未提出者 ${n}人に催促を送りました。` };
  },
};
