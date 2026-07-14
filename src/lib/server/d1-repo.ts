/**
 * D1（Cloudflare SQLite）リポジトリ実装。
 * 採点・希望シャッフルなどのドメイン純関数を再利用し、永続化を SQL で行う。
 */
import {
  participantRanking,
  artworkTallies,
  type ScoreRow,
} from "$lib/domain/scoring.js";
import { generatePreferredAssignments } from "$lib/domain/shuffle.js";
import {
  PHASE_META,
  PHASE_ORDER,
  mayRevealAuthors,
  isAtOrAfter,
} from "$lib/domain/phase.js";
import type {
  Ballot,
  DesignerChoice,
  Difficulty,
  Notification,
  Participation,
  Project,
  ProjectId,
  ParticipationId,
  Phase,
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

type Row = Record<string, unknown>;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const label = (order: number) => `作品 ${String(order + 1).padStart(2, "0")}`;

export function createD1Repository(db: D1Database): Repository {
  const all = async (sql: string, ...args: unknown[]): Promise<Row[]> => {
    const r = await db
      .prepare(sql)
      .bind(...(args as never[]))
      .all();
    return (r.results ?? []) as Row[];
  };
  const one = async (sql: string, ...args: unknown[]): Promise<Row | null> =>
    (await db
      .prepare(sql)
      .bind(...(args as never[]))
      .first()) as Row | null;
  const run = async (sql: string, ...args: unknown[]): Promise<void> => {
    await db
      .prepare(sql)
      .bind(...(args as never[]))
      .run();
  };

  function toProject(r: Row | null): Project | null {
    if (!r) return null;
    return {
      id: r.id as string,
      title: r.title as string,
      theme: r.theme as string,
      description: r.description as string,
      phase: r.phase as Phase,
      isPublic: !!(r.is_public as number),
      excludeArtistGuess: !!(r.exclude_artist_guess as number),
      deadlines: {
        design: (r.deadline_design as string) ?? undefined,
        artwork: (r.deadline_artwork as string) ?? undefined,
        voting: (r.deadline_voting as string) ?? undefined,
      },
    };
  }

  const gameTypeOf = async (id: ProjectId): Promise<string> => {
    const r = await one("SELECT game_type AS g FROM projects WHERE id=?", id);
    return (r?.g as string) ?? "daredeza";
  };

  async function namesMap(id: ProjectId): Promise<Map<string, string>> {
    const rows = await all(
      "SELECT id, display_name FROM participations WHERE project_id=?",
      id,
    );
    return new Map(rows.map((r) => [r.id as string, r.display_name as string]));
  }

  /** artworkId -> 当てるべき本人（daredeza=デザイナー / egaraate=作画者）。 */
  async function truthOf(
    id: ProjectId,
    gameType: string,
  ): Promise<Map<string, string>> {
    if (gameType === "egaraate") {
      const rows = await all(
        "SELECT id, artist_id FROM artworks WHERE project_id=?",
        id,
      );
      return new Map(rows.map((r) => [r.id as string, r.artist_id as string]));
    }
    const rows = await all(
      "SELECT a.id AS aid, d.author_id AS author FROM artworks a JOIN designs d ON d.id=a.design_id WHERE a.project_id=?",
      id,
    );
    return new Map(rows.map((r) => [r.aid as string, r.author as string]));
  }

  async function ballotsOf(id: ProjectId): Promise<Ballot[]> {
    const brows = await all(
      "SELECT * FROM ballots WHERE project_id=?",
      id,
    );
    const vrows = await all(
      "SELECT v.* FROM votes v JOIN ballots b ON b.id=v.ballot_id WHERE b.project_id=?",
      id,
    );
    const byBallot = new Map<string, Vote[]>();
    for (const v of vrows) {
      const arr = byBallot.get(v.ballot_id as string) ?? [];
      arr.push({
        artworkId: v.artwork_id as string,
        guessedDesignerId: v.guessed_designer_id as string,
      });
      byBallot.set(v.ballot_id as string, arr);
    }
    return brows.map((b) => ({
      projectId: b.project_id as string,
      voterParticipationId: (b.voter_participation_id as string) ?? null,
      anonymousKey: (b.anonymous_key as string) ?? null,
      votes: byBallot.get(b.id as string) ?? [],
      submittedAt: b.submitted_at as string,
    }));
  }

  const repo: Repository = {
    async getProject(id) {
      return toProject(await one("SELECT * FROM projects WHERE id=?", id));
    },

    async listParticipations(id) {
      const rows = await all(
        "SELECT * FROM participations WHERE project_id=?",
        id,
      );
      return rows.map(toParticipation);
    },

    async getParticipationById(id) {
      const r = await one("SELECT * FROM participations WHERE id=?", id);
      return r ? toParticipation(r) : null;
    },

    async getParticipationByInviteToken(token) {
      const r = await one(
        "SELECT * FROM participations WHERE invite_token=?",
        token,
      );
      return r ? toParticipation(r) : null;
    },

    async getPublicArtworkCards(id) {
      const project = await this.getProject(id);
      if (!project || !isAtOrAfter(project.phase, "Voting")) return [];
      const rows = await all(
        "SELECT a.id AS aid, a.image_key, a.display_order, a.caption AS acap, d.caption AS dcap FROM artworks a LEFT JOIN designs d ON d.id=a.design_id WHERE a.project_id=? ORDER BY a.display_order",
        id,
      );
      return rows.map(
        (r): PublicArtworkCard => ({
          artworkId: r.aid as string,
          imageUrl: r.image_key as string,
          label: label(r.display_order as number),
          caption: ((r.dcap as string) || (r.acap as string) || "") as string,
        }),
      );
    },

    async getBallotChoices(id, voterParticipationId) {
      const project = await this.getProject(id);
      const out: Record<string, DesignerChoice[]> = {};
      if (!project || !isAtOrAfter(project.phase, "Voting")) return out;
      const gt = await gameTypeOf(id);
      const parts = await all(
        "SELECT id, display_name FROM participations WHERE project_id=?",
        id,
      );
      const artists = await all(
        "SELECT id, artist_id FROM artworks WHERE project_id=?",
        id,
      );
      const artistOf = new Map(
        artists.map((a) => [a.id as string, a.artist_id as string]),
      );
      const artworkIds = await all(
        "SELECT id FROM artworks WHERE project_id=? ORDER BY display_order",
        id,
      );
      for (const a of artworkIds) {
        const aid = a.id as string;
        // egaraate は作画者が答えなので除外しない
        const excludedArtist =
          gt !== "egaraate" && project.excludeArtistGuess
            ? artistOf.get(aid)
            : undefined;
        out[aid] = parts
          .filter(
            (p) =>
              (p.id as string) !== voterParticipationId &&
              (p.id as string) !== excludedArtist,
          )
          .map((p) => ({
            participationId: p.id as string,
            displayName: p.display_name as string,
          }));
      }
      return out;
    },

    async getParticipantTask(id) {
      const project = await this.getProject(id);
      if (!project) return null;
      const meta = PHASE_META[project.phase];
      return {
        phaseLabel: meta.label,
        action: meta.participantAction,
        deadline: project.deadlines.voting ?? null,
        done: false,
      } satisfies ParticipantTask;
    },

    async getRevealedResults(id) {
      const project = await this.getProject(id);
      if (!project || !mayRevealAuthors(project.phase)) return [];
      const gt = await gameTypeOf(id);
      const truth = await truthOf(id, gt);
      const ballots = await ballotsOf(id);
      const tallies = artworkTallies(ballots, truth);
      const names = await namesMap(id);
      const arts = await all(
        "SELECT id, image_key, display_order, artist_id FROM artworks WHERE project_id=? ORDER BY display_order",
        id,
      );
      return arts.map((a): RevealedResult => {
        const aid = a.id as string;
        const designerId = truth.get(aid);
        const t = tallies.get(aid);
        return {
          artworkId: aid,
          imageUrl: a.image_key as string,
          label: label(a.display_order as number),
          designerName: (designerId && names.get(designerId)) || "?",
          artistName: names.get(a.artist_id as string) || "?",
          correctCount: t?.correctCount ?? 0,
          totalVotes: t?.totalVotes ?? 0,
        };
      });
    },

    async getParticipantRanking(id) {
      const project = await this.getProject(id);
      if (!project || !mayRevealAuthors(project.phase)) return [];
      const gt = await gameTypeOf(id);
      const truth = await truthOf(id, gt);
      const ballots = await ballotsOf(id);
      const names = await namesMap(id);
      const rows: ScoreRow[] = participantRanking(ballots, truth);
      return rows.map((row, i) => ({
        ...row,
        displayName: names.get(row.participationId) ?? "?",
        rank: i + 1,
      }));
    },

    async getBallot(id, voter) {
      const brow =
        "participationId" in voter
          ? await one(
              "SELECT * FROM ballots WHERE project_id=? AND voter_participation_id=?",
              id,
              voter.participationId,
            )
          : await one(
              "SELECT * FROM ballots WHERE project_id=? AND anonymous_key=?",
              id,
              voter.anonymousKey,
            );
      if (!brow) return null;
      const vrows = await all(
        "SELECT * FROM votes WHERE ballot_id=?",
        brow.id as string,
      );
      return {
        projectId: brow.project_id as string,
        voterParticipationId: (brow.voter_participation_id as string) ?? null,
        anonymousKey: (brow.anonymous_key as string) ?? null,
        votes: vrows.map((v) => ({
          artworkId: v.artwork_id as string,
          guessedDesignerId: v.guessed_designer_id as string,
        })),
        submittedAt: brow.submitted_at as string,
      };
    },

    async saveBallot(ballot) {
      // 既存の同一投票者ぶんを消して入れ直す（締切前の変更＝upsert）
      const existing =
        ballot.voterParticipationId != null
          ? await one(
              "SELECT id FROM ballots WHERE project_id=? AND voter_participation_id=?",
              ballot.projectId,
              ballot.voterParticipationId,
            )
          : await one(
              "SELECT id FROM ballots WHERE project_id=? AND anonymous_key=?",
              ballot.projectId,
              ballot.anonymousKey,
            );
      if (existing) {
        await run("DELETE FROM ballots WHERE id=?", existing.id as string);
      }
      const bid = crypto.randomUUID();
      await run(
        "INSERT INTO ballots (id, project_id, voter_participation_id, anonymous_key, submitted_at) VALUES (?,?,?,?,?)",
        bid,
        ballot.projectId,
        ballot.voterParticipationId,
        ballot.anonymousKey,
        ballot.submittedAt,
      );
      for (const v of ballot.votes) {
        await run(
          "INSERT INTO votes (id, ballot_id, artwork_id, guessed_designer_id) VALUES (?,?,?,?)",
          crypto.randomUUID(),
          bid,
          v.artworkId,
          v.guessedDesignerId,
        );
      }
    },

    async getMyDesignArtworkId(id, pid) {
      const gt = await gameTypeOf(id);
      if (gt === "egaraate") {
        const r = await one(
          "SELECT id FROM artworks WHERE project_id=? AND artist_id=?",
          id,
          pid,
        );
        return (r?.id as string) ?? null;
      }
      const r = await one(
        "SELECT a.id AS aid FROM artworks a JOIN designs d ON d.id=a.design_id WHERE a.project_id=? AND d.author_id=?",
        id,
        pid,
      );
      return (r?.aid as string) ?? null;
    },

    async getOrganizerOverview(id) {
      const project = await this.getProject(id);
      if (!project) return null;
      const parts = await all(
        "SELECT * FROM participations WHERE project_id=?",
        id,
      );
      const designs = await all(
        "SELECT author_id, preferred_difficulty FROM designs WHERE project_id=?",
        id,
      );
      const designSet = new Set(designs.map((d) => d.author_id as string));
      const comfortOf = new Map(
        designs.map((d) => [
          d.author_id as string,
          d.preferred_difficulty as Difficulty,
        ]),
      );
      const artworks = await all(
        "SELECT artist_id FROM artworks WHERE project_id=?",
        id,
      );
      const artistSet = new Set(artworks.map((a) => a.artist_id as string));

      const roster = parts.map((p) => ({
        displayName: p.display_name as string,
        inviteToken: p.invite_token as string,
        submittedDesign: designSet.has(p.id as string),
        submittedArtwork: artistSet.has(p.id as string),
      }));

      // 匿名ラベル（ハッシュ順で本人を辿れないように）
      const asg = await all(
        "SELECT a.design_id, a.artist_id, d.difficulty FROM assignments a JOIN designs d ON d.id=a.design_id WHERE a.project_id=?",
        id,
      );
      let matching: OrganizerOverview["matching"] = null;
      let preferenceSatisfied: OrganizerOverview["preferenceSatisfied"] = null;
      if (asg.length > 0) {
        const designIds = [...new Set(asg.map((a) => a.design_id as string))]
          .sort((x, y) => hashStr(x) - hashStr(y));
        const dLabel = new Map(
          designIds.map((did, i) => [did, `デザイン #${i + 1}`]),
        );
        const artistIds = [...new Set(asg.map((a) => a.artist_id as string))]
          .sort((x, y) => hashStr(x) - hashStr(y));
        const aLabel = new Map(
          artistIds.map((aid, i) => [aid, `作画者 #${i + 1}`]),
        );
        matching = asg.map((a) => {
          const dd = a.difficulty as Difficulty;
          const ac = comfortOf.get(a.artist_id as string) ?? 3;
          return {
            designLabel: dLabel.get(a.design_id as string) ?? "デザイン",
            artistLabel: aLabel.get(a.artist_id as string) ?? "作画者",
            designDifficulty: dd,
            artistComfort: ac,
            satisfied: dd <= ac,
          };
        });
        preferenceSatisfied = {
          ok: matching.filter((m) => m.satisfied).length,
          total: matching.length,
        };
      }

      return {
        project,
        roster,
        matching,
        preferenceSatisfied,
        counts: {
          participants: parts.length,
          designs: designs.length,
          artworks: artworks.length,
        },
      };
    },

    async advanceProjectPhase(id, direction) {
      const p = await this.getProject(id);
      if (!p) return;
      const i = PHASE_ORDER.indexOf(p.phase);
      const ni =
        direction === "next"
          ? Math.min(i + 1, PHASE_ORDER.length - 1)
          : Math.max(i - 1, 0);
      await run("UPDATE projects SET phase=? WHERE id=?", PHASE_ORDER[ni], id);
    },

    async setExcludeArtistGuess(id, value) {
      await run(
        "UPDATE projects SET exclude_artist_guess=? WHERE id=?",
        value ? 1 : 0,
        id,
      );
    },

    async runShuffle(id) {
      // 作品が既にあるとシャッフル再実行で消えてしまうため禁止（データ保護）
      const hasArt = await one(
        "SELECT 1 AS x FROM artworks WHERE project_id=? LIMIT 1",
        id,
      );
      if (hasArt) {
        return {
          ok: false,
          reason:
            "すでに作品が提出されているためシャッフルし直せません（作品保護）。",
        };
      }
      const designs = await all(
        "SELECT id, author_id, difficulty, preferred_difficulty FROM designs WHERE project_id=?",
        id,
      );
      if (designs.length < 2) {
        return { ok: false, reason: "提出が2件未満のためシャッフルできません。" };
      }
      const { assignments } = generatePreferredAssignments(
        designs.map((d) => ({
          participantId: d.author_id as string,
          designDifficulty: d.difficulty as number,
          artistComfort: d.preferred_difficulty as number,
        })),
        {},
      );
      const designIdOf = new Map(
        designs.map((d) => [d.author_id as string, d.id as string]),
      );
      await run("DELETE FROM assignments WHERE project_id=?", id);
      for (const a of assignments) {
        await run(
          "INSERT INTO assignments (id, project_id, design_id, design_author_id, artist_id) VALUES (?,?,?,?,?)",
          crypto.randomUUID(),
          id,
          designIdOf.get(a.designAuthorId),
          a.designAuthorId,
          a.artistId,
        );
      }
      return { ok: true };
    },

    async createProject(input) {
      const now = new Date().toISOString();
      const id = `pj-${crypto.randomUUID().slice(0, 8)}`;
      const uid = `u-${crypto.randomUUID().slice(0, 8)}`;
      await run(
        "INSERT INTO users (id, display_name, created_at) VALUES (?,?,?)",
        uid,
        "主催",
        now,
      );
      await run(
        "INSERT INTO projects (id, owner_id, title, theme, description, phase, game_type, visibility, is_public, exclude_artist_guess, deadline_design, deadline_artwork, deadline_voting, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        uid,
        input.title.trim() || "無題の企画",
        input.theme.trim(),
        input.description.trim(),
        "Recruiting",
        "daredeza",
        input.isPublic ? "public" : "unlisted",
        input.isPublic ? 1 : 0,
        input.excludeArtistGuess ? 1 : 0,
        input.deadlines.design ?? null,
        input.deadlines.artwork ?? null,
        input.deadlines.voting ?? null,
        now,
      );
      await run(
        "INSERT INTO project_organizers (project_id, user_id, role, created_at) VALUES (?,?,?,?)",
        id,
        uid,
        "owner",
        now,
      );
      let i = 0;
      for (const raw of input.participantNames) {
        i++;
        const name = raw.trim() || `参加者${i}`;
        await run(
          "INSERT INTO participations (id, project_id, user_id, display_name, invite_token, status, created_at) VALUES (?,?,?,?,?,?,?)",
          `${id}-p${i}`,
          id,
          null,
          name,
          `inv-${crypto.randomUUID().slice(0, 10)}`,
          "invited",
          now,
        );
      }
      return id;
    },

    async listOrganizerProjects() {
      const rows = await all(
        "SELECT p.id, p.title, p.theme, p.phase, (SELECT count(*) FROM participations x WHERE x.project_id=p.id) AS n FROM projects p ORDER BY p.created_at DESC",
      );
      return rows.map(
        (r): OrganizerProjectSummary => ({
          id: r.id as string,
          title: r.title as string,
          theme: r.theme as string,
          phase: r.phase as Phase,
          participants: r.n as number,
        }),
      );
    },

    async nudgeUnsubmitted(id) {
      const project = await this.getProject(id);
      if (!project) return 0;
      const parts = await all(
        "SELECT id FROM participations WHERE project_id=?",
        id,
      );
      const now = new Date().toISOString();
      let count = 0;
      for (const p of parts) {
        const pid = p.id as string;
        let unsubmitted = false;
        if (project.phase === "DesignSubmission") {
          unsubmitted = !(await one(
            "SELECT 1 AS x FROM designs WHERE project_id=? AND author_id=?",
            id,
            pid,
          ));
        } else if (project.phase === "ArtworkSubmission") {
          unsubmitted = !(await one(
            "SELECT 1 AS x FROM artworks WHERE project_id=? AND artist_id=?",
            id,
            pid,
          ));
        } else if (project.phase === "Voting") {
          unsubmitted = !(await one(
            "SELECT 1 AS x FROM ballots WHERE project_id=? AND voter_participation_id=?",
            id,
            pid,
          ));
        }
        if (unsubmitted) {
          await run(
            "INSERT INTO notifications (id, participation_id, body, created_at) VALUES (?,?,?,?)",
            crypto.randomUUID(),
            pid,
            `【${project.title}】締切が近づいています。まだ完了していない項目があります。`,
            now,
          );
          count++;
        }
      }
      return count;
    },

    async listNotifications(pid) {
      const rows = await all(
        "SELECT * FROM notifications WHERE participation_id=? ORDER BY created_at DESC",
        pid,
      );
      return rows.map(
        (r): Notification => ({
          id: r.id as string,
          participationId: r.participation_id as string,
          body: r.body as string,
          href: (r.href as string) ?? null,
          readAt: (r.read_at as string) ?? null,
          createdAt: r.created_at as string,
        }),
      );
    },

    async unreadNotificationCount(pid) {
      const r = await one(
        "SELECT count(*) AS n FROM notifications WHERE participation_id=? AND read_at IS NULL",
        pid,
      );
      return (r?.n as number) ?? 0;
    },

    async markNotificationsRead(pid) {
      await run(
        "UPDATE notifications SET read_at=? WHERE participation_id=? AND read_at IS NULL",
        new Date().toISOString(),
        pid,
      );
    },
  };

  return repo;
}

function toParticipation(r: Row): Participation {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    displayName: r.display_name as string,
    status: r.status as "invited" | "joined",
  };
}
