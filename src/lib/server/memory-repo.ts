/**
 * インメモリ・リポジトリ実装（デモ／スケルトン用）。
 *
 * 実データベース（Supabase 等）に差し替えるまでの仮実装。シャッフルエンジンと
 * 採点ロジックを実際に通してデモデータを生成し、UI が本物のデータ経路で
 * 動くことを確認できるようにする。
 */
import {
  generateAssignments,
  generatePreferredAssignments,
} from "$lib/domain/shuffle.js";
import { seededRng, cryptoRng } from "$lib/domain/rng.js";
import {
  buildTruthMap,
  participantRanking,
  artworkTallies,
} from "$lib/domain/scoring.js";
import {
  PHASE_META,
  mayRevealAuthors,
  isAtOrAfter,
  nextPhaseFor,
  prevPhaseFor,
  participantActionFor,
} from "$lib/domain/phase.js";
import type {
  Artwork,
  Ballot,
  Design,
  DesignerChoice,
  Difficulty,
  Notification,
  Participation,
  Project,
  ProjectId,
  ParticipationId,
  PublicArtworkCard,
  RevealedResult,
  Vote,
} from "$lib/domain/types.js";
import type {
  CreateProjectInput,
  OrganizerOverview,
  OrganizerProjectSummary,
  ParticipantTask,
  RankingEntry,
  Repository,
  VoterRef,
} from "./repository.js";

export const DEMO_PROJECT_ID = "demo-daredeza";
export const DEMO_RESULT_PROJECT_ID = "demo-result";
/** ダッシュボードで「自分」として表示するデモ参加者。 */
export const DEMO_ME: ParticipationId = "p1";

const NAMES = ["ネオ", "墨丸", "ルカ", "あおい", "蓮", "ざくろ", "つむぎ", "玄"];
const THEME = "サイバーパンクな和風妖怪";

const DESIGN_CAPTIONS: string[] = [
  "電脳提灯を背負う雨の妖狐。ネオン色の尾が九本。",
  "廃神社に棲むブラウザ管狐。目はスキャンライン。",
  "唐傘お化けドローン。骨はカーボン、和紙は有機EL。",
  "河童のダイバー。甲羅は放熱フィン、皿は冷却水。",
  "ろくろ首の配信者。首がLANケーブルのように伸びる。",
  "鵺のサイボーグ。四獣のパーツを換装式で組み替える。",
  "雪女のアンドロイド。吐息で機器を強制冷却する。",
  "百目の監視AI。無数のレンズが提灯行列のように灯る。",
];

// デモ: 各人のデザインの難易度と「描きたい難易度の上限（希望）」。
// 例: ネオ(p1)は難しいデザイン(3)を出したが自分は簡単め(1)しか描きたくない。
const DEMO_DIFFICULTY: Difficulty[] = [3, 2, 1, 3, 2, 1, 2, 3];
const DEMO_COMFORT: Difficulty[] = [1, 3, 2, 3, 1, 2, 3, 2];

// ---- デモの土台データを一度だけ生成 -------------------------------------

const ids: ParticipationId[] = NAMES.map((_, i) => `p${i + 1}`);

const participations: Participation[] = NAMES.map((name, i) => ({
  id: `p${i + 1}`,
  projectId: DEMO_PROJECT_ID,
  displayName: name,
  status: "joined",
}));

// 参加者ごとの招待トークン（デモ）。実運用では推測困難なランダム値を発行する。
const inviteTokenToId: Record<string, ParticipationId> = Object.fromEntries(
  participations.map((p, i) => [`tok-p${i + 1}`, p.id]),
);

/** デモ用: 招待リンクの一覧（トークンと表示名）。ランディングの体験導線に使う。 */
export function demoInvites(): { token: string; name: string }[] {
  return participations.map((p, i) => ({
    token: `tok-p${i + 1}`,
    name: p.displayName,
  }));
}

const designs: Design[] = ids.map((authorId, i) => ({
  id: `d${i + 1}`,
  projectId: DEMO_PROJECT_ID,
  authorId,
  imageUrl: placeholderArt(i * 37 + 11, `デザイン ${i + 1}`, "design"),
  caption: DESIGN_CAPTIONS[i] ?? "",
  difficulty: DEMO_DIFFICULTY[i] ?? 2,
  preferredDifficulty: DEMO_COMFORT[i] ?? 3,
  submittedAt: `2026-06-${10 + i}T12:00:00+09:00`,
}));

// シャッフル: 提出済み全員で derangement（作者 ≠ 作画者）
const assignmentList = generateAssignments(ids, { rng: seededRng(7) });
const artistOfDesign = new Map<string, ParticipationId>();
for (let i = 0; i < ids.length; i++) {
  const designAuthor = ids[i]!;
  const artist = assignmentList[i]!.artistId;
  artistOfDesign.set(`d${i + 1}`, artist);
  void designAuthor;
}

const artworks: Artwork[] = designs.map((d, i) => ({
  id: `a${i + 1}`,
  projectId: DEMO_PROJECT_ID,
  designId: d.id,
  artistId: artistOfDesign.get(d.id)!,
  imageUrl: placeholderArt(i * 53 + 5, `作品`, "artwork"),
  submittedAt: `2026-06-${20 + i}T18:00:00+09:00`,
}));

// 表示順は提出順を漏らさないため固定シャッフル（要件 6.1）
const displayOrder = shuffleFixed(
  artworks.map((a) => a.id),
  seededRng(99),
);
const labelOf = new Map<string, string>(
  displayOrder.map((artworkId, idx) => [
    artworkId,
    `作品 ${String(idx + 1).padStart(2, "0")}`,
  ]),
);

const truth = buildTruthMap(artworks, designs); // artworkId -> 真のデザイナー

// デモ投票: 各参加者が確率的に当てる投票用紙を生成
const ballots: Ballot[] = buildDemoBallots();

// ---- Project メタ（同じ土台を Voting / Result の2フェーズで見せる） -------

const projects: Record<ProjectId, Project> = {
  [DEMO_PROJECT_ID]: {
    id: DEMO_PROJECT_ID,
    title: "第7回 誰デザ",
    theme: THEME,
    description: "お題に沿ってキャラをデザインし、他の誰かが作画。誰がデザインしたかを当てよう。",
    phase: "Voting",
    gameType: "daredeza",
    isPublic: true,
    excludeArtistGuess: true, // デモ: 作画者を候補から除外（主催オプション）
    deadlines: { voting: "2026-07-12T23:59:00+09:00" },
  },
  [DEMO_RESULT_PROJECT_ID]: {
    id: DEMO_RESULT_PROJECT_ID,
    title: "第7回 誰デザ",
    theme: THEME,
    description: "答え合わせと正解率ランキング。",
    phase: "Result",
    gameType: "daredeza",
    isPublic: true,
    excludeArtistGuess: true,
    deadlines: {},
  },
};

// ---- 主催（organizer）用の可変状態 ----------------------------------------

const designIdOfAuthor = new Map(designs.map((d) => [d.authorId, d.id]));
const tokenOfParticipation = new Map(
  Object.entries(inviteTokenToId).map(([tok, pid]) => [pid, tok]),
);

// 匿名ラベル（F-10: 主催に「どのデザインが誰のものか」を悟らせない）。
// ラベル順はシード付きシャッフルなので、主催は番号から本人を辿れない。
const designLabelOrder = shuffleFixed(designs.map((d) => d.id), seededRng(555));
const designAnonLabel = new Map(
  designLabelOrder.map((did, i) => [did, `デザイン #${i + 1}`]),
);
const artistLabelOrder = shuffleFixed(
  participations.map((p) => p.id),
  seededRng(777),
);
const artistAnonLabel = new Map(
  artistLabelOrder.map((pid, i) => [pid, `作画者 #${i + 1}`]),
);

// 企画ごとの割当（design → artist）。初期はデモのシャッフル結果を反映。
type OrgAssignment = { designId: string; artistId: ParticipationId };
const assignmentsByProject = new Map<ProjectId, OrgAssignment[]>();
assignmentsByProject.set(
  DEMO_PROJECT_ID,
  ids.map((authorId, i) => ({
    designId: designIdOfAuthor.get(authorId)!,
    artistId: assignmentList[i]!.artistId,
  })),
);

// ---- 動的に作成した企画（新規企画作成フォーム）＋通知 -----------------------

const extraParticipations: Participation[] = [];
const extraTokenToId: Record<string, string> = {};
let projectSeq = 1;

const notifications: Notification[] = [];
let notifSeq = 1;

// 絵柄当ての作品（フォールバック用の汎用ストア）。artistId=作者=本人。
interface EgaraArt {
  id: string;
  projectId: ProjectId;
  artistId: ParticipationId;
  imageUrl: string;
  caption: string;
  order: number;
}
const egaraArtworks: EgaraArt[] = [];
let egaraSeq = 1;
function egaraArtsOf(id: ProjectId): EgaraArt[] {
  return egaraArtworks
    .filter((a) => a.projectId === id)
    .sort((a, b) => a.order - b.order);
}

function allParticipations(): Participation[] {
  return [...participations, ...extraParticipations];
}

function pushNotification(
  participationId: ParticipationId,
  body: string,
  href: string | null,
): void {
  notifications.push({
    id: `n${notifSeq++}`,
    participationId,
    body,
    href,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

// デモ: ネオに開始通知を1件入れておく（ベルの動作確認用）。
pushNotification(DEMO_ME, "「第7回 誰デザ」の投票がはじまりました！", "/vote");

// ---- Repository 実装 -----------------------------------------------------

class MemoryRepository implements Repository {
  async getProject(id: ProjectId): Promise<Project | null> {
    return projects[id] ?? null;
  }

  async listParticipations(): Promise<Participation[]> {
    return participations;
  }

  async getParticipationById(
    id: ParticipationId,
  ): Promise<Participation | null> {
    return allParticipations().find((p) => p.id === id) ?? null;
  }

  async getParticipationByInviteToken(
    token: string,
  ): Promise<Participation | null> {
    const id = inviteTokenToId[token] ?? extraTokenToId[token];
    return id ? (allParticipations().find((p) => p.id === id) ?? null) : null;
  }

  async getPublicArtworkCards(id: ProjectId): Promise<PublicArtworkCard[]> {
    const project = projects[id];
    if (!project || !isAtOrAfter(project.phase, "Voting")) return [];
    if (project.gameType === "egaraate") {
      return egaraArtsOf(id).map((a, i) => ({
        artworkId: a.id,
        imageUrl: a.imageUrl,
        label: `作品 ${String(i + 1).padStart(2, "0")}`,
        caption: a.caption,
      }));
    }
    // 固定シャッフル順で、作者情報を含めずに返す
    return displayOrder.map((artworkId) => {
      const art = artworks.find((a) => a.id === artworkId)!;
      const design = designs.find((d) => d.id === art.designId)!;
      return {
        artworkId,
        imageUrl: art.imageUrl,
        label: labelOf.get(artworkId)!,
        caption: design.caption,
      };
    });
  }

  async getBallotChoices(
    id: ProjectId,
    voterParticipationId: ParticipationId | null,
  ): Promise<Record<string, DesignerChoice[]>> {
    const project = projects[id];
    const out: Record<string, DesignerChoice[]> = {};
    if (!project || !isAtOrAfter(project.phase, "Voting")) return out;

    if (project.gameType === "egaraate") {
      // 絵柄当ては作画者本人が答えなので除外しない（自分だけ除く）
      const parts = allParticipations().filter((p) => p.projectId === id);
      for (const a of egaraArtsOf(id)) {
        out[a.id] = parts
          .filter((p) => p.id !== voterParticipationId)
          .map((p) => ({ participationId: p.id, displayName: p.displayName }));
      }
      return out;
    }

    const artistOf = new Map(artworks.map((a) => [a.id, a.artistId]));
    for (const artworkId of displayOrder) {
      const excludedArtist = project.excludeArtistGuess
        ? artistOf.get(artworkId)
        : undefined;
      out[artworkId] = participations
        .filter(
          (p) =>
            p.id !== voterParticipationId && // 自分（同名の人物）を除外
            p.id !== excludedArtist, // 作画者を除外（主催オプション時のみ）
        )
        .map((p) => ({ participationId: p.id, displayName: p.displayName }));
    }
    return out;
  }

  async getParticipantTask(
    id: ProjectId,
    _participationId: ParticipationId,
  ): Promise<ParticipantTask | null> {
    // _participationId は本来ここで提出状況の判定に使う（デモでは未使用）。
    const project = projects[id];
    if (!project) return null;
    const meta = PHASE_META[project.phase];
    return {
      phaseLabel: meta.label,
      action: participantActionFor(project.gameType, project.phase),
      deadline: project.deadlines.voting ?? null,
      done: false,
    };
  }

  async getRevealedResults(id: ProjectId): Promise<RevealedResult[]> {
    const project = projects[id];
    if (!project || !mayRevealAuthors(project.phase)) return []; // Result 以外は開示しない
    if (project.gameType === "egaraate") {
      const arts = egaraArtsOf(id);
      const egaraTruth = new Map(arts.map((a) => [a.id, a.artistId]));
      const projBallots = ballots.filter((b) => b.projectId === id);
      const t = artworkTallies(projBallots, egaraTruth);
      const nameOf = new Map(
        allParticipations()
          .filter((p) => p.projectId === id)
          .map((p) => [p.id, p.displayName]),
      );
      return arts.map((a, i) => {
        const tally = t.get(a.id);
        return {
          artworkId: a.id,
          imageUrl: a.imageUrl,
          label: `作品 ${String(i + 1).padStart(2, "0")}`,
          designerName: nameOf.get(a.artistId) ?? "?",
          artistName: nameOf.get(a.artistId) ?? "?",
          correctCount: tally?.correctCount ?? 0,
          totalVotes: tally?.totalVotes ?? 0,
        };
      });
    }
    const tallies = artworkTallies(ballots, truth);
    const nameOf = new Map(participations.map((p) => [p.id, p.displayName]));
    return displayOrder.map((artworkId) => {
      const art = artworks.find((a) => a.id === artworkId)!;
      const designerId = truth.get(artworkId)!;
      const tally = tallies.get(artworkId)!;
      return {
        artworkId,
        imageUrl: art.imageUrl,
        label: labelOf.get(artworkId)!,
        designerName: nameOf.get(designerId) ?? "?",
        artistName: nameOf.get(art.artistId) ?? "?",
        correctCount: tally.correctCount,
        totalVotes: tally.totalVotes,
      };
    });
  }

  async getParticipantRanking(id: ProjectId): Promise<RankingEntry[]> {
    const project = projects[id];
    if (!project || !mayRevealAuthors(project.phase)) return [];
    if (project.gameType === "egaraate") {
      const arts = egaraArtsOf(id);
      const egaraTruth = new Map(arts.map((a) => [a.id, a.artistId]));
      const projBallots = ballots.filter((b) => b.projectId === id);
      const nameOf = new Map(
        allParticipations()
          .filter((p) => p.projectId === id)
          .map((p) => [p.id, p.displayName]),
      );
      return participantRanking(projBallots, egaraTruth).map((row, i) => ({
        ...row,
        displayName: nameOf.get(row.participationId) ?? "?",
        rank: i + 1,
      }));
    }
    const nameOf = new Map(participations.map((p) => [p.id, p.displayName]));
    const rows = participantRanking(ballots, truth);
    return rows.map((row, i) => ({
      ...row,
      displayName: nameOf.get(row.participationId) ?? "?",
      rank: i + 1,
    }));
  }

  async getBallot(id: ProjectId, voter: VoterRef): Promise<Ballot | null> {
    return (
      ballots.find(
        (b) =>
          b.projectId === id &&
          ("participationId" in voter
            ? b.voterParticipationId === voter.participationId
            : b.anonymousKey === voter.anonymousKey),
      ) ?? null
    );
  }

  async saveBallot(ballot: Ballot): Promise<void> {
    // 同一投票者の既存分を探して置き換え（締切前の変更）。無ければ追加。
    const idx = ballots.findIndex(
      (b) =>
        b.projectId === ballot.projectId &&
        ((ballot.voterParticipationId != null &&
          b.voterParticipationId === ballot.voterParticipationId) ||
          (ballot.anonymousKey != null &&
            b.anonymousKey === ballot.anonymousKey)),
    );
    if (idx >= 0) ballots[idx] = ballot;
    else ballots.push(ballot);
  }

  async getMyDesignArtworkId(
    id: ProjectId,
    pid: ParticipationId,
  ): Promise<string | null> {
    if (projects[id]?.gameType === "egaraate") {
      return egaraArtsOf(id).find((a) => a.artistId === pid)?.id ?? null;
    }
    const design = designs.find(
      (d) => d.projectId === id && d.authorId === pid,
    );
    if (!design) return null;
    const art = artworks.find(
      (a) => a.projectId === id && a.designId === design.id,
    );
    return art?.id ?? null;
  }

  async submitOwnArtwork(input: {
    projectId: ProjectId;
    participationId: ParticipationId;
    imageUrl: string;
    caption: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const project = projects[input.projectId];
    if (!project) return { ok: false, reason: "企画が見つかりません。" };
    if (project.gameType !== "egaraate") {
      return { ok: false, reason: "この企画は絵柄当てではありません。" };
    }
    if (project.phase !== "ArtworkSubmission") {
      return { ok: false, reason: "現在は作品提出フェーズではありません。" };
    }
    const idx = egaraArtworks.findIndex(
      (a) =>
        a.projectId === input.projectId &&
        a.artistId === input.participationId,
    );
    if (idx >= 0) egaraArtworks.splice(idx, 1);
    egaraArtworks.push({
      id: `ea${egaraSeq++}`,
      projectId: input.projectId,
      artistId: input.participationId,
      imageUrl: input.imageUrl,
      caption: input.caption,
      order: Math.random(),
    });
    return { ok: true };
  }

  // ---- 主催操作 ----

  async getOrganizerOverview(
    id: ProjectId,
  ): Promise<OrganizerOverview | null> {
    const project = projects[id];
    if (!project) return null;

    if (project.gameType === "egaraate") {
      const arts = egaraArtsOf(id);
      const submitted = new Set(arts.map((a) => a.artistId));
      const roster = allParticipations()
        .filter((p) => p.projectId === id)
        .map((p) => ({
          displayName: p.displayName,
          inviteToken: tokenOfParticipation.get(p.id) ?? "",
          submittedDesign: false,
          submittedArtwork: submitted.has(p.id),
        }));
      return {
        project,
        roster,
        matching: null,
        preferenceSatisfied: null,
        counts: {
          participants: roster.length,
          designs: 0,
          artworks: arts.length,
        },
      };
    }

    const roster = allParticipations()
      .filter((p) => p.projectId === id)
      .map((p) => ({
        displayName: p.displayName,
        inviteToken: tokenOfParticipation.get(p.id) ?? "",
        submittedDesign: designs.some(
          (d) => d.projectId === id && d.authorId === p.id,
        ),
        submittedArtwork: artworks.some(
          (a) => a.projectId === id && a.artistId === p.id,
        ),
      }));

    const designById = new Map(designs.map((d) => [d.id, d]));
    const comfortOf = new Map(designs.map((d) => [d.authorId, d.preferredDifficulty]));
    const asg = assignmentsByProject.get(id) ?? null;
    const matching = asg
      ? asg.map((a) => {
          const dd: Difficulty = designById.get(a.designId)?.difficulty ?? 2;
          const ac: Difficulty = comfortOf.get(a.artistId) ?? 3;
          return {
            designLabel: designAnonLabel.get(a.designId) ?? "デザイン",
            artistLabel: artistAnonLabel.get(a.artistId) ?? "作画者",
            designDifficulty: dd,
            artistComfort: ac,
            satisfied: dd <= ac,
          };
        })
      : null;
    const preferenceSatisfied = matching
      ? { ok: matching.filter((m) => m.satisfied).length, total: matching.length }
      : null;

    return {
      project,
      roster,
      matching,
      preferenceSatisfied,
      counts: {
        participants: roster.length,
        designs: designs.filter((d) => d.projectId === id).length,
        artworks: artworks.filter((a) => a.projectId === id).length,
      },
    };
  }

  async advanceProjectPhase(
    id: ProjectId,
    direction: "next" | "prev",
  ): Promise<void> {
    const p = projects[id];
    if (!p) return;
    const target =
      direction === "next"
        ? nextPhaseFor(p.gameType, p.phase)
        : prevPhaseFor(p.gameType, p.phase);
    if (!target) return; // 端では動かさない
    projects[id] = { ...p, phase: target };
  }

  async setExcludeArtistGuess(id: ProjectId, value: boolean): Promise<void> {
    const p = projects[id];
    if (!p) return;
    projects[id] = { ...p, excludeArtistGuess: value };
  }

  async runShuffle(
    id: ProjectId,
  ): Promise<{ ok: boolean; reason?: string }> {
    // 作品が既にあるとシャッフル再実行で消えてしまうため禁止（データ保護）
    if (artworks.some((a) => a.projectId === id)) {
      return {
        ok: false,
        reason:
          "すでに作品が提出されているためシャッフルし直せません（作品保護）。",
      };
    }
    // 提出済みデザイン（デモは全員提出済み）。難易度と作画希望を渡して最適化。
    const submitted = designs.filter((d) => d.projectId === id);
    if (submitted.length < 2) {
      return { ok: false, reason: "提出が2件未満のためシャッフルできません。" };
    }
    const { assignments } = generatePreferredAssignments(
      submitted.map((d) => ({
        participantId: d.authorId,
        designDifficulty: d.difficulty,
        artistComfort: d.preferredDifficulty,
      })),
      { rng: cryptoRng() },
    );
    assignmentsByProject.set(
      id,
      assignments.map((a) => ({
        designId: designIdOfAuthor.get(a.designAuthorId)!,
        artistId: a.artistId,
      })),
    );
    return { ok: true };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectId> {
    const id = `pj${projectSeq++}-${randSuffix()}`;
    projects[id] = {
      id,
      title: input.title.trim() || "無題の企画",
      theme: input.theme.trim(),
      description: input.description.trim(),
      phase: "Recruiting",
      gameType: input.gameType,
      isPublic: input.isPublic,
      excludeArtistGuess: input.excludeArtistGuess,
      deadlines: {
        design: input.deadlines.design,
        artwork: input.deadlines.artwork,
        voting: input.deadlines.voting,
      },
    };
    input.participantNames.forEach((rawName, i) => {
      const name = rawName.trim() || `参加者${i + 1}`;
      const pid = `${id}-p${i + 1}`;
      const token = `inv-${randSuffix()}${randSuffix()}`;
      extraParticipations.push({
        id: pid,
        projectId: id,
        displayName: name,
        status: "invited",
      });
      extraTokenToId[token] = pid;
      tokenOfParticipation.set(pid, token);
    });
    return id;
  }

  async listOrganizerProjects(): Promise<OrganizerProjectSummary[]> {
    return Object.values(projects)
      .filter((p) => p.id !== DEMO_RESULT_PROJECT_ID)
      .map((p) => ({
        id: p.id,
        title: p.title,
        theme: p.theme,
        phase: p.phase,
        gameType: p.gameType,
        participants: allParticipations().filter((x) => x.projectId === p.id)
          .length,
      }));
  }

  async nudgeUnsubmitted(id: ProjectId): Promise<number> {
    const project = projects[id];
    if (!project) return 0;
    const roster = allParticipations().filter((p) => p.projectId === id);
    let count = 0;
    for (const p of roster) {
      let unsubmitted = false;
      if (project.phase === "DesignSubmission") {
        unsubmitted = !designs.some(
          (d) => d.projectId === id && d.authorId === p.id,
        );
      } else if (project.phase === "ArtworkSubmission") {
        unsubmitted = !artworks.some(
          (a) => a.projectId === id && a.artistId === p.id,
        );
      } else if (project.phase === "Voting") {
        unsubmitted = !ballots.some(
          (b) => b.projectId === id && b.voterParticipationId === p.id,
        );
      }
      if (unsubmitted) {
        pushNotification(
          p.id,
          `【${project.title}】締切が近づいています。まだ完了していない項目があります。`,
          "/dashboard",
        );
        count++;
      }
    }
    return count;
  }

  async listNotifications(pid: ParticipationId): Promise<Notification[]> {
    return notifications
      .filter((n) => n.participationId === pid)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async unreadNotificationCount(pid: ParticipationId): Promise<number> {
    return notifications.filter(
      (n) => n.participationId === pid && n.readAt === null,
    ).length;
  }

  async markNotificationsRead(pid: ParticipationId): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < notifications.length; i++) {
      const n = notifications[i]!;
      if (n.participationId === pid && n.readAt === null) {
        notifications[i] = { ...n, readAt: now };
      }
    }
  }
}

export const repository: Repository = new MemoryRepository();

// ---- ヘルパ --------------------------------------------------------------

function buildDemoBallots(): Ballot[] {
  const out: Ballot[] = [];
  // 参加者票: 各自 seed を変えて、当たりやすさに差をつける
  participations.forEach((voter, vi) => {
    if (voter.id === DEMO_ME) return; // デモ体験でネオは自分で投票する
    const rng = seededRng(1000 + vi);
    const skill = 0.35 + vi * 0.07; // 参加者ごとの「勘の良さ」
    const votes: Vote[] = [];
    for (const artworkId of displayOrder) {
      const trueDesigner = truth.get(artworkId)!;
      if (trueDesigner === voter.id) continue; // 自作品は投票不要
      const guess =
        rng.next() < skill
          ? trueDesigner
          : ids[rng.nextInt(ids.length)]!;
      votes.push({ artworkId, guessedDesignerId: guess });
    }
    out.push({
      projectId: DEMO_PROJECT_ID,
      voterParticipationId: voter.id,
      anonymousKey: null,
      votes,
      submittedAt: "2026-07-11T20:00:00+09:00",
    });
  });
  return out;
}

/** RNG で並べ替えた新しい配列を返す（元配列は不変）。 */
function shuffleFixed<T>(source: readonly T[], rng: ReturnType<typeof seededRng>): T[] {
  const a = source.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** 作品プレースホルダ（インライン SVG data URI）。ネットワーク不要。 */
function placeholderArt(seed: number, label: string, kind: "design" | "artwork"): string {
  const hue = (seed * 47) % 360;
  const hue2 = (hue + 45) % 360;
  const sat = kind === "artwork" ? 78 : 62;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000' viewBox='0 0 800 1000'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='hsl(${hue} ${sat}% 74%)'/>
        <stop offset='1' stop-color='hsl(${hue2} ${sat}% 60%)'/>
      </linearGradient>
    </defs>
    <rect width='800' height='1000' fill='url(#g)'/>
    <circle cx='${200 + (seed % 400)}' cy='${300 + (seed % 300)}' r='190' fill='hsl(${hue2} 90% 88% / 0.55)'/>
    <text x='400' y='520' font-family='sans-serif' font-size='38' fill='rgba(40,40,64,0.5)' text-anchor='middle'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
