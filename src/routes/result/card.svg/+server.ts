import { repository } from "$lib/server/index.js";
import { DEMO_RESULT_PROJECT_ID } from "$lib/server/memory-repo.js";
import type { RequestHandler } from "./$types.js";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** 結果まとめの共有カード（OGP兼用の 1200x630 SVG）。 */
export const GET: RequestHandler = async () => {
  const [project, ranking, results] = await Promise.all([
    repository.getProject(DEMO_RESULT_PROJECT_ID),
    repository.getParticipantRanking(DEMO_RESULT_PROJECT_ID),
    repository.getRevealedResults(DEMO_RESULT_PROJECT_ID),
  ]);

  const top = ranking.slice(0, 3);
  const medal = ["1", "2", "3"];
  const rows = top
    .map((r, i) => {
      const y = 300 + i * 78;
      const pct = Math.round(r.accuracy * 100);
      return `
    <text x="120" y="${y}" font-family="sans-serif" font-size="46" font-weight="800" fill="#d4ff3d">${medal[i]}</text>
    <text x="185" y="${y}" font-family="sans-serif" font-size="40" font-weight="700" fill="#f4f3ef">${esc(r.displayName)}</text>
    <text x="1080" y="${y}" font-family="sans-serif" font-size="38" font-weight="800" fill="#a06bff" text-anchor="end">${r.correct}/${r.answered}（${pct}%）</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0c0c11"/>
  <rect width="1200" height="8" fill="#a06bff"/>
  <text x="120" y="140" font-family="sans-serif" font-size="30" font-weight="700" letter-spacing="6" fill="#d4ff3d">KALEIDO ・ RESULT</text>
  <text x="120" y="215" font-family="sans-serif" font-size="62" font-weight="800" fill="#f4f3ef">${esc(project?.title ?? "誰デザ")} 結果発表</text>
  <text x="120" y="262" font-family="sans-serif" font-size="30" fill="#b7b8c6">正解率ランキング ・ 全${results.length}作品</text>
  ${rows}
  <text x="1080" y="590" font-family="sans-serif" font-size="26" fill="#7d7e92" text-anchor="end">作者は誰だ？ Kaleido</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
