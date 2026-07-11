/**
 * シャッフル自動割当エンジン（F-08 / 要件定義 4.3・第9章 Shuffling フェーズ）。
 *
 * 誰デザの核心。締切時点で「デザインを提出済み」の参加者だけを対象に、
 * 「デザイン作者 ≠ そのデザインの作画者」を必ず満たす 1 対 1 の割当（＝完全順列 / derangement）
 * を生成する。
 *
 * 設計上の確定事項（要件定義 v1.1）:
 *  - 対象は提出済みの参加者のみ（未提出者は呼び出し側で除外して渡す）。
 *  - 厳密 1 対 1（各デザインはちょうど 1 人の作画者、各作画者はちょうど 1 つのデザイン）。
 *  - 成立条件は「提出済み n >= 2」。n <= 1 は割当不能。
 *  - 主催 UI にも作者⇔提出物の対応は返さない前提のため、本モジュールは
 *    「どの participation が誰のデザインを作画するか」の対応のみを返し、
 *    表示・アクセス制御は上位層の責務とする。
 */
import type { Rng } from "./rng.js";
import { cryptoRng } from "./rng.js";

/** 参加者（Participation）の識別子。 */
export type ParticipationId = string;

/**
 * 1 件の割当。designAuthorId が提出したデザインを artistId が作画する。
 * 不変条件: designAuthorId !== artistId。
 */
export interface Assignment {
  /** デザインの作者（提出者）。 */
  readonly designAuthorId: ParticipationId;
  /** そのデザインを作画する担当者。 */
  readonly artistId: ParticipationId;
}

export type ShuffleFailureReason =
  | "too-few-participants" // 提出済みが 1 人以下
  | "duplicate-ids" // ID に重複がある（呼び出し側のバグ）
  | "exhausted"; // 上限回数内で derangement を作れなかった（通常発生しない）

export class ShuffleError extends Error {
  constructor(
    public readonly reason: ShuffleFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "ShuffleError";
  }
}

export interface ShuffleOptions {
  /** 乱数源。省略時は暗号学的乱数を使用。テストでは seededRng を注入する。 */
  rng?: Rng;
  /** 棄却サンプリングの最大試行回数。到達時は保証付き構成法にフォールバックする。 */
  maxAttempts?: number;
}

/**
 * 提出済み参加者の ID 一覧から derangement 割当を生成する。
 *
 * @param submittedParticipantIds デザインを提出済みの参加者 ID（各自 1 デザイン、MVP は 1 対 1）。
 * @throws {ShuffleError} n <= 1、または ID 重複のとき。
 */
export function generateAssignments(
  submittedParticipantIds: readonly ParticipationId[],
  options: ShuffleOptions = {},
): Assignment[] {
  const ids = submittedParticipantIds;
  const n = ids.length;

  if (new Set(ids).size !== n) {
    throw new ShuffleError(
      "duplicate-ids",
      "参加者 ID に重複があります。呼び出し側で一意な提出済み ID を渡してください。",
    );
  }
  if (n <= 1) {
    throw new ShuffleError(
      "too-few-participants",
      `割当には提出済み 2 名以上が必要です（現在 ${n} 名）。`,
    );
  }

  const rng = options.rng ?? cryptoRng();
  const maxAttempts = options.maxAttempts ?? 1000;

  // 棄却サンプリング: Fisher-Yates で一様順列を作り、derangement になるまで再試行する。
  // n >= 2 で derangement は必ず存在し、成功確率は約 1/e なので期待試行回数は約 e 回。
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const perm = fisherYates(ids, rng);
    if (isDerangementAgainst(ids, perm)) {
      return toAssignments(ids, perm);
    }
  }

  // 実運用ではまず到達しないが、保険として確実に derangement を作る構成法を使う。
  const constructed = constructDerangement(ids, rng);
  return toAssignments(ids, constructed);
}

/**
 * 割当のミスマッチ費用。作画者の許容難易度(artistComfort)より
 * デザインが難しい(designDifficulty)ほど大きく罰する（＝苦手な人に難しい絵を回さない）。
 * 逆に「余裕がある人に簡単な絵」は小さな費用のみ。
 */
export function matchCost(
  artistComfort: number,
  designDifficulty: number,
): number {
  // 許容より難しい絵だけを罰する。簡単な絵が回るのは問題ないので費用0。
  return designDifficulty > artistComfort
    ? (designDifficulty - artistComfort) * 10
    : 0;
}

/** 希望付きシャッフルの入力（提出済み参加者ごと）。 */
export interface PreferenceInput {
  readonly participantId: ParticipationId;
  /** この人が提出したデザインの難易度。 */
  readonly designDifficulty: number;
  /** この人が描ける難易度の上限（希望）。 */
  readonly artistComfort: number;
}

export interface PreferredResult {
  readonly assignments: Assignment[];
  /** 総ミスマッチ費用（小さいほど希望に沿う）。 */
  readonly cost: number;
  /** 希望を満たした（デザイン難易度 <= 許容）割当の数。 */
  readonly satisfied: number;
}

/**
 * 「作者 ≠ 作画者」を保ちつつ、作画希望をできるだけ満たす割当を返す。
 * n が小さい前提で、derangement を多数サンプリングして最小費用のものを選ぶ
 * （Hungarian を書かずに、テスト済みの derangement 生成を再利用する実装）。
 */
export function generatePreferredAssignments(
  inputs: readonly PreferenceInput[],
  options: ShuffleOptions & { samples?: number } = {},
): PreferredResult {
  const ids = inputs.map((x) => x.participantId);
  const diff = new Map(inputs.map((x) => [x.participantId, x.designDifficulty]));
  const comfort = new Map(inputs.map((x) => [x.participantId, x.artistComfort]));
  const samples = options.samples ?? 500;

  let best: Assignment[] | null = null;
  let bestCost = Infinity;

  const scoreOf = (perm: Assignment[]): number => {
    let cost = 0;
    for (const a of perm) {
      cost += matchCost(comfort.get(a.artistId)!, diff.get(a.designAuthorId)!);
    }
    return cost;
  };

  for (let k = 0; k < Math.max(1, samples); k++) {
    const perm = generateAssignments(ids, options);
    const cost = scoreOf(perm);
    if (cost < bestCost) {
      bestCost = cost;
      best = perm;
      if (cost === 0) break; // 全員希望通り
    }
  }

  const assignments = best ?? generateAssignments(ids, options);
  const satisfied = assignments.filter(
    (a) => diff.get(a.designAuthorId)! <= comfort.get(a.artistId)!,
  ).length;
  return { assignments, cost: bestCost, satisfied };
}

/** ids[i] の作画者が perm[i] となる割当配列に変換する。 */
function toAssignments(
  ids: readonly ParticipationId[],
  perm: readonly ParticipationId[],
): Assignment[] {
  return ids.map((designAuthorId, i) => ({
    designAuthorId,
    artistId: perm[i]!,
  }));
}

/** 配列のコピーに対して Fisher-Yates シャッフルを行う。 */
function fisherYates(
  source: readonly ParticipationId[],
  rng: Rng,
): ParticipationId[] {
  const a = source.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** perm が ids に対して derangement か（全 i で perm[i] !== ids[i]）を判定する。 */
function isDerangementAgainst(
  ids: readonly ParticipationId[],
  perm: readonly ParticipationId[],
): boolean {
  for (let i = 0; i < ids.length; i++) {
    if (perm[i] === ids[i]) return false;
  }
  return true;
}

/**
 * 確実に derangement を構成するフォールバック。
 * ランダムな 1 本の巡回置換（Sattolo アルゴリズム）を作る。単一巡回は必ず不動点を持たない。
 */
function constructDerangement(
  ids: readonly ParticipationId[],
  rng: Rng,
): ParticipationId[] {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i); // [0, i) — i 自身を除くことで単一巡回＝不動点なしを保証
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/**
 * 生成済みの割当が不変条件を満たすか検証する（監査・テスト用）。
 * - 全単射（各デザイン 1 回・各作画者 1 回）
 * - 作者 ≠ 作画者
 * - 入力集合と一致
 */
export function verifyAssignments(
  submittedParticipantIds: readonly ParticipationId[],
  assignments: readonly Assignment[],
): { ok: true } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const expected = new Set(submittedParticipantIds);

  if (assignments.length !== submittedParticipantIds.length) {
    problems.push(
      `割当件数 ${assignments.length} が参加者数 ${submittedParticipantIds.length} と一致しません。`,
    );
  }

  const seenAuthors = new Set<ParticipationId>();
  const seenArtists = new Set<ParticipationId>();
  for (const { designAuthorId, artistId } of assignments) {
    if (designAuthorId === artistId) {
      problems.push(`自己割当を検出: ${designAuthorId}`);
    }
    if (!expected.has(designAuthorId)) {
      problems.push(`未知のデザイン作者: ${designAuthorId}`);
    }
    if (!expected.has(artistId)) {
      problems.push(`未知の作画者: ${artistId}`);
    }
    if (seenAuthors.has(designAuthorId)) {
      problems.push(`デザインが重複して割当てられています: ${designAuthorId}`);
    }
    if (seenArtists.has(artistId)) {
      problems.push(`作画者が重複して割当てられています: ${artistId}`);
    }
    seenAuthors.add(designAuthorId);
    seenArtists.add(artistId);
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
