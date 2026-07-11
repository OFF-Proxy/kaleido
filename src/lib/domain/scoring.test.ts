import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTruthMap, participantRanking, artworkTallies } from "./scoring.js";
import type { Artwork, Ballot, Design } from "./types.js";

// p1..p3 が提出、シャッフルで p1のデザイン→作品a1 ... と対応（作画者は採点に無関係）
const designs: Design[] = [
  { id: "d1", projectId: "pj", authorId: "p1", imageUrl: "", caption: "", difficulty: 2, preferredDifficulty: 3, submittedAt: "" },
  { id: "d2", projectId: "pj", authorId: "p2", imageUrl: "", caption: "", difficulty: 2, preferredDifficulty: 3, submittedAt: "" },
  { id: "d3", projectId: "pj", authorId: "p3", imageUrl: "", caption: "", difficulty: 2, preferredDifficulty: 3, submittedAt: "" },
];
const artworks: Artwork[] = [
  { id: "a1", projectId: "pj", designId: "d1", artistId: "p2", imageUrl: "", submittedAt: "" },
  { id: "a2", projectId: "pj", designId: "d2", artistId: "p3", imageUrl: "", submittedAt: "" },
  { id: "a3", projectId: "pj", designId: "d3", artistId: "p1", imageUrl: "", submittedAt: "" },
];
// 真のデザイナー: a1=p1, a2=p2, a3=p3

function ballot(voter: string | null, guesses: Record<string, string>): Ballot {
  return {
    projectId: "pj",
    voterParticipationId: voter,
    anonymousKey: voter === null ? "anon" : null,
    votes: Object.entries(guesses).map(([artworkId, guessedDesignerId]) => ({
      artworkId,
      guessedDesignerId,
    })),
    submittedAt: "",
  };
}

test("自作品は採点から除外される", () => {
  const truth = buildTruthMap(artworks, designs);
  // p1 は a1(自作) を除外。a2→p2 正解, a3→p3 正解 => 2/2
  const rows = participantRanking(
    [ballot("p1", { a1: "p1", a2: "p2", a3: "p3" })],
    truth,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.answered, 2); // a1 除外
  assert.equal(rows[0]!.correct, 2);
  assert.equal(rows[0]!.accuracy, 1);
});

test("ランキングは正解数の降順", () => {
  const truth = buildTruthMap(artworks, designs);
  const rows = participantRanking(
    [
      ballot("p1", { a2: "p2", a3: "p1" }), // a2 正解, a3 不正解 => 1
      ballot("p2", { a1: "p1", a3: "p3" }), // 両方正解 => 2
      ballot("p3", { a1: "p9", a2: "p9" }), // 0
    ],
    truth,
  );
  assert.deepEqual(
    rows.map((r) => r.participationId),
    ["p2", "p1", "p3"],
  );
});

test("観覧者票はランキングに含まれない", () => {
  const truth = buildTruthMap(artworks, designs);
  const rows = participantRanking([ballot(null, { a1: "p1" })], truth);
  assert.equal(rows.length, 0);
});

test("作品別集計は参加者票と観覧者票を合算（自己票のみ除外）", () => {
  const truth = buildTruthMap(artworks, designs);
  const tallies = artworkTallies(
    [
      ballot("p2", { a1: "p1" }), // a1 正解
      ballot(null, { a1: "p1" }), // 観覧者も a1 正解
      ballot("p1", { a1: "p1" }), // a1 は p1 の自作 => 除外
    ],
    truth,
  );
  const a1 = tallies.get("a1")!;
  assert.equal(a1.totalVotes, 2); // 自己票を除いた 2
  assert.equal(a1.correctCount, 2);
});
