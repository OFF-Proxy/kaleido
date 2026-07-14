import { fail } from "@sveltejs/kit";
import { DEMO_PROJECT_ID } from "$lib/server/memory-repo.js";
import type { Actions, PageServerLoad } from "./$types.js";
import type { Vote } from "$lib/domain/types.js";
import type { VoterRef } from "$lib/server/repository.js";

const ANON_COOKIE = "dd_anon";

/** 現在の投票者の識別（参加者 or 観覧者の匿名鍵）。 */
function voterRefFrom(
  locals: App.Locals,
  cookies: { get(name: string): string | undefined },
): VoterRef | null {
  if (locals.participation) {
    return { participationId: locals.participation.id };
  }
  const anon = cookies.get(ANON_COOKIE);
  return anon ? { anonymousKey: anon } : null;
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const repository = locals.repository;
  const pid = url.searchParams.get("p") ?? DEMO_PROJECT_ID;
  const voterPid = locals.participation?.id ?? null;
  const [project, cards, choicesByCard] = await Promise.all([
    repository.getProject(pid),
    repository.getPublicArtworkCards(pid),
    repository.getBallotChoices(pid, voterPid),
  ]);

  const canVote = project?.phase === "Voting";

  // 自作品（自分のデザイン/自分の絵）は投票対象外にする
  const ownArtworkId = voterPid
    ? await repository.getMyDesignArtworkId(pid, voterPid)
    : null;

  // 既存の投票（変更可のためプレフィル）
  const voter = voterRefFrom(locals, cookies);
  const existing = voter ? await repository.getBallot(pid, voter) : null;
  const prefill: Record<string, string> = {};
  if (existing) {
    for (const v of existing.votes) prefill[v.artworkId] = v.guessedDesignerId;
  }

  return {
    projectId: pid,
    project,
    gameType: project?.gameType ?? "daredeza",
    cards,
    choicesByCard,
    canVote,
    prefill,
    ownArtworkId,
    hasVoted: existing !== null,
    isParticipant: locals.participation !== null,
    excludeArtist: project?.excludeArtistGuess ?? false,
  };
};

export const actions: Actions = {
  submit: async ({ request, locals, cookies }) => {
    const repository = locals.repository;
    const form = await request.formData();
    const pid = String(form.get("p") || DEMO_PROJECT_ID);
    const project = await repository.getProject(pid);
    if (project?.phase !== "Voting") {
      return fail(400, { message: "現在は投票期間ではありません。" });
    }

    const voterPid = locals.participation?.id ?? null;
    const [cards, choicesByCard] = await Promise.all([
      repository.getPublicArtworkCards(pid),
      repository.getBallotChoices(pid, voterPid),
    ]);
    const ownArtworkId = voterPid
      ? await repository.getMyDesignArtworkId(pid, voterPid)
      : null;
    // 自作品は投票対象外
    const votableCards = cards.filter((c) => c.artworkId !== ownArtworkId);

    const votes: Vote[] = [];
    for (const c of votableCards) {
      const g = form.get(`vote-${c.artworkId}`);
      if (typeof g !== "string" || g.length === 0) continue;
      // サーバ側でも許可候補のみ受け付ける（自分・作画者は弾く）
      const allowed = choicesByCard[c.artworkId] ?? [];
      if (!allowed.some((choice) => choice.participationId === g)) {
        return fail(400, { message: "選べない候補が含まれています。" });
      }
      votes.push({ artworkId: c.artworkId, guessedDesignerId: g });
    }
    if (votes.length < votableCards.length) {
      return fail(400, { message: "すべての作品に回答してください。" });
    }
    // 同じ人を複数の作品に割り当てない（各人は1作品まで）
    const seen = new Set<string>();
    for (const v of votes) {
      if (seen.has(v.guessedDesignerId)) {
        return fail(400, {
          message: "同じ人を複数の作品に選べません（1人1作品まで）。",
        });
      }
      seen.add(v.guessedDesignerId);
    }

    // 投票者の識別。観覧者は匿名鍵を発行して Cookie に保存。
    let voterParticipationId: string | null = null;
    let anonymousKey: string | null = null;
    if (locals.participation) {
      voterParticipationId = locals.participation.id;
    } else {
      anonymousKey = cookies.get(ANON_COOKIE) ?? crypto.randomUUID();
      cookies.set(ANON_COOKIE, anonymousKey, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    await repository.saveBallot({
      projectId: pid,
      voterParticipationId,
      anonymousKey,
      votes,
      submittedAt: new Date().toISOString(),
    });

    return { success: true };
  },
};
