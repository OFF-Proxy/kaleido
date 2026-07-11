import { demoInvites, DEMO_PROJECT_ID } from "$lib/server/memory-repo.js";
import { repository } from "$lib/server/index.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  // ヒーローに飾るサンプル作品（作者は伏せたカード）
  const cards = await repository.getPublicArtworkCards(DEMO_PROJECT_ID);
  return {
    invites: demoInvites().slice(0, 3),
    heroArt: cards.slice(0, 3).map((c) => c.imageUrl),
  };
};
