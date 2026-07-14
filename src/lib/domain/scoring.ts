/**
 * 作者当ての採点（要件定義 F-18 / 4.5・4.6）。
 *
 * ルール（v1.1 確定）:
 *  - 1 作品のデザイナーを正しく当てるごとに +1 点。
 *  - 参加者ランキングは「自分のデザインを描いた作品」を母数・採点から除外（自己投票除外）。
 *  - 作画未提出（欠番）の作品は投票・採点対象外（呼び出し側で Artwork が存在するものだけ渡す）。
 *  - 観覧者票は参加者ランキングに混ぜず、参考集計として分離する。
 */
import type {
  Artwork,
  ArtworkId,
  Ballot,
  Design,
  ParticipationId,
} from "./types.js";

/** artworkId → 真のデザイナー（＝その作品の元デザインの作者）の対応を作る。 */
export function buildTruthMap(
  artworks: readonly Artwork[],
  designs: readonly Design[],
): Map<ArtworkId, ParticipationId> {
  const designAuthor = new Map<string, ParticipationId>(
    designs.map((d) => [d.id, d.authorId]),
  );
  const truth = new Map<ArtworkId, ParticipationId>();
  for (const art of artworks) {
    if (!art.designId) continue; // 絵柄当ては designId が無い
    const author = designAuthor.get(art.designId);
    if (author) truth.set(art.id, author);
  }
  return truth;
}

export interface ScoreRow {
  readonly participationId: ParticipationId;
  readonly correct: number;
  /** 採点対象作品数（自作品を除いた数）。 */
  readonly answered: number;
  readonly accuracy: number; // 0..1
}

/**
 * 参加者の正解率ランキング。自分のデザインの作品は除外して集計する。
 * correct 降順 → accuracy 降順 → participationId 昇順で安定ソート。
 */
export function participantRanking(
  ballots: readonly Ballot[],
  truth: Map<ArtworkId, ParticipationId>,
): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const ballot of ballots) {
    const voter = ballot.voterParticipationId;
    if (voter === null) continue; // 観覧者票は対象外

    let correct = 0;
    let answered = 0;
    for (const vote of ballot.votes) {
      const trueDesigner = truth.get(vote.artworkId);
      if (trueDesigner === undefined) continue; // 欠番など
      if (trueDesigner === voter) continue; // 自作品は除外
      answered++;
      if (vote.guessedDesignerId === trueDesigner) correct++;
    }
    rows.push({
      participationId: voter,
      correct,
      answered,
      accuracy: answered === 0 ? 0 : correct / answered,
    });
  }

  rows.sort(
    (a, b) =>
      b.correct - a.correct ||
      b.accuracy - a.accuracy ||
      a.participationId.localeCompare(b.participationId),
  );
  return rows;
}

export interface ArtworkTally {
  readonly artworkId: ArtworkId;
  readonly correctCount: number;
  readonly totalVotes: number;
}

/**
 * 作品ごとの正解者数（答え合わせ用）。参加者票・観覧者票を合算する。
 * 自作品への自己票（trueDesigner === voter）は除外する。
 */
export function artworkTallies(
  ballots: readonly Ballot[],
  truth: Map<ArtworkId, ParticipationId>,
): Map<ArtworkId, ArtworkTally> {
  const acc = new Map<ArtworkId, { correct: number; total: number }>();
  for (const [artworkId] of truth) acc.set(artworkId, { correct: 0, total: 0 });

  for (const ballot of ballots) {
    const voter = ballot.voterParticipationId;
    for (const vote of ballot.votes) {
      const trueDesigner = truth.get(vote.artworkId);
      if (trueDesigner === undefined) continue;
      if (voter !== null && trueDesigner === voter) continue; // 自己票除外
      const cell = acc.get(vote.artworkId)!;
      cell.total++;
      if (vote.guessedDesignerId === trueDesigner) cell.correct++;
    }
  }

  const out = new Map<ArtworkId, ArtworkTally>();
  for (const [artworkId, { correct, total }] of acc) {
    out.set(artworkId, { artworkId, correctCount: correct, totalVotes: total });
  }
  return out;
}
