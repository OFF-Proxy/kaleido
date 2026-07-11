import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateAssignments,
  generatePreferredAssignments,
  matchCost,
  verifyAssignments,
  ShuffleError,
  type Assignment,
  type PreferenceInput,
} from "./shuffle.js";
import { seededRng } from "./rng.js";

const ids = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** 割当が不変条件をすべて満たすことを検証するヘルパ。 */
function assertValid(participants: string[], assignments: Assignment[]): void {
  const result = verifyAssignments(participants, assignments);
  assert.ok(
    result.ok,
    result.ok ? "" : `不変条件違反: ${result.problems.join(" / ")}`,
  );
}

test("n=2: 唯一の derangement（入れ替え）になる", () => {
  const participants = ids(2);
  const assignments = generateAssignments(participants, {
    rng: seededRng(1),
  });
  assertValid(participants, assignments);
  // 2 人なら互いに交換するしかない
  const map = new Map(assignments.map((a) => [a.designAuthorId, a.artistId]));
  assert.equal(map.get("p1"), "p2");
  assert.equal(map.get("p2"), "p1");
});

test("作者 ≠ 作画者 が常に成り立つ（さまざまな n・seed）", () => {
  for (let n = 2; n <= 25; n++) {
    for (let seed = 0; seed < 40; seed++) {
      const participants = ids(n);
      const assignments = generateAssignments(participants, {
        rng: seededRng(seed * 100 + n),
      });
      for (const a of assignments) {
        assert.notEqual(
          a.designAuthorId,
          a.artistId,
          `自己割当が発生 (n=${n}, seed=${seed}, id=${a.designAuthorId})`,
        );
      }
      assertValid(participants, assignments);
    }
  }
});

test("全単射: 各デザイン・各作画者がちょうど 1 回", () => {
  const participants = ids(13);
  const assignments = generateAssignments(participants, {
    rng: seededRng(42),
  });
  const authors = new Set(assignments.map((a) => a.designAuthorId));
  const artists = new Set(assignments.map((a) => a.artistId));
  assert.equal(authors.size, 13);
  assert.equal(artists.size, 13);
  assert.equal(assignments.length, 13);
});

test("n<=1 は ShuffleError(too-few-participants)", () => {
  for (const bad of [ids(0), ids(1)]) {
    assert.throws(
      () => generateAssignments(bad, { rng: seededRng(1) }),
      (err: unknown) =>
        err instanceof ShuffleError && err.reason === "too-few-participants",
    );
  }
});

test("ID 重複は ShuffleError(duplicate-ids)", () => {
  assert.throws(
    () => generateAssignments(["p1", "p1", "p2"], { rng: seededRng(1) }),
    (err: unknown) =>
      err instanceof ShuffleError && err.reason === "duplicate-ids",
  );
});

test("同じ seed なら決定的に同じ結果（再現性）", () => {
  const participants = ids(10);
  const a = generateAssignments(participants, { rng: seededRng(7) });
  const b = generateAssignments(participants, { rng: seededRng(7) });
  assert.deepEqual(a, b);
});

test("フォールバック構成法(maxAttempts=0)でも有効な derangement を返す", () => {
  // 棄却サンプリングを一切行わせず、構成法だけで妥当性を担保できるか確認
  for (let n = 2; n <= 20; n++) {
    const participants = ids(n);
    const assignments = generateAssignments(participants, {
      rng: seededRng(n),
      maxAttempts: 0,
    });
    for (const a of assignments) {
      assert.notEqual(a.designAuthorId, a.artistId);
    }
    assertValid(participants, assignments);
  }
});

test("大きめの n=100 でも妥当", () => {
  const participants = ids(100);
  const assignments = generateAssignments(participants, {
    rng: seededRng(2026),
  });
  assertValid(participants, assignments);
});

test("verifyAssignments が自己割当を検出する", () => {
  const participants = ids(3);
  const broken: Assignment[] = [
    { designAuthorId: "p1", artistId: "p1" }, // 不正: 自己割当
    { designAuthorId: "p2", artistId: "p3" },
    { designAuthorId: "p3", artistId: "p2" },
  ];
  const result = verifyAssignments(participants, broken);
  assert.equal(result.ok, false);
});

test("matchCost: 苦手な人に難しい絵は重く罰する", () => {
  assert.equal(matchCost(1, 3), 20); // 許容1に難易度3 => (3-1)*10
  assert.equal(matchCost(3, 1), 0); // 余裕あり・簡単 => 罰なし
  assert.equal(matchCost(2, 2), 0); // ぴったり
  assert.equal(matchCost(3, 3), 0);
});

test("希望シャッフル: 全員の希望を満たす割当が見つかる（cost 0）", () => {
  // p1: 難しい絵を出したが自分は簡単しか描けない
  const inputs: PreferenceInput[] = [
    { participantId: "p1", designDifficulty: 3, artistComfort: 1 },
    { participantId: "p2", designDifficulty: 1, artistComfort: 3 },
    { participantId: "p3", designDifficulty: 2, artistComfort: 3 },
    { participantId: "p4", designDifficulty: 1, artistComfort: 2 },
  ];
  const diff = new Map(inputs.map((x) => [x.participantId, x.designDifficulty]));
  const comfort = new Map(inputs.map((x) => [x.participantId, x.artistComfort]));

  const res = generatePreferredAssignments(inputs, { rng: seededRng(3) });

  // 有効な derangement
  const check = verifyAssignments(
    inputs.map((x) => x.participantId),
    res.assignments,
  );
  assert.ok(check.ok);

  // 全員希望通り（デザイン難易度 <= 作画者の許容）
  assert.equal(res.cost, 0);
  assert.equal(res.satisfied, 4);
  for (const a of res.assignments) {
    assert.ok(diff.get(a.designAuthorId)! <= comfort.get(a.artistId)!);
  }
});

test("希望シャッフル: 苦手な人(comfort1)に難しい絵(diff3)を回さない", () => {
  const inputs: PreferenceInput[] = [
    { participantId: "a", designDifficulty: 3, artistComfort: 3 },
    { participantId: "b", designDifficulty: 3, artistComfort: 3 },
    { participantId: "c", designDifficulty: 1, artistComfort: 1 }, // 苦手
    { participantId: "d", designDifficulty: 1, artistComfort: 3 },
  ];
  const diff = new Map(inputs.map((x) => [x.participantId, x.designDifficulty]));
  const res = generatePreferredAssignments(inputs, { rng: seededRng(11) });
  // c(苦手)が受け取るデザインの難易度は 1 以下であること
  const cAssign = res.assignments.find((x) => x.artistId === "c")!;
  assert.ok(diff.get(cAssign.designAuthorId)! <= 1);
});

test("分布の健全性: n=4 で全 derangement 型が出現しうる", () => {
  // n=4 の derangement は 9 通り。多数回サンプルして複数パターンが出ることを確認
  const participants = ids(4);
  const seen = new Set<string>();
  for (let seed = 0; seed < 300; seed++) {
    const assignments = generateAssignments(participants, {
      rng: seededRng(seed),
    });
    seen.add(assignments.map((a) => a.artistId).join(","));
  }
  // 少なくとも複数の割当パターンが出ていれば偏りすぎていない
  assert.ok(seen.size >= 5, `出現パターンが少なすぎます: ${seen.size}`);
});
