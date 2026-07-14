/**
 * リポジトリ抽象（サーバ専用）。
 *
 * 匿名性の技術的担保（要件 6.1）: 公開向けメソッドは作者・作画者情報を含まない
 * DTO のみを返す。作者を含むデータは Result フェーズ用メソッド or 監査ログ付き
 * 緊急開示（F-29, 将来）でのみ取得できる。
 *
 * 現段階はインメモリ実装（memory-repo.ts）。将来 Supabase 実装に差し替える。
 */
import type {
  ArtworkId,
  Ballot,
  DesignerChoice,
  Difficulty,
  GameType,
  Notification,
  Participation,
  Phase,
  Project,
  ProjectId,
  ParticipationId,
  PublicArtworkCard,
  RevealedResult,
  Visibility,
} from "$lib/domain/types.js";
import type { ScoreRow } from "$lib/domain/scoring.js";

/** 投票者の識別（参加者IDか、観覧者の匿名セッション鍵）。 */
export type VoterRef =
  | { participationId: ParticipationId }
  | { anonymousKey: string };

/** 新規企画作成の入力。 */
export interface CreateProjectInput {
  readonly title: string;
  readonly theme: string;
  readonly description: string;
  readonly gameType: GameType;
  readonly visibility: Visibility;
  readonly genre: string | null;
  readonly circle: string | null;
  readonly isPublic: boolean;
  readonly excludeArtistGuess: boolean;
  readonly deadlines: {
    readonly design?: string;
    readonly artwork?: string;
    readonly voting?: string;
  };
  readonly participantNames: string[];
}

/** 閲覧者向けの公開企画カード（募集/投票一覧）。 */
export interface PublicProjectSummary {
  readonly id: ProjectId;
  readonly title: string;
  readonly theme: string;
  readonly gameType: GameType;
  readonly phase: Phase;
  readonly visibility: Visibility;
  readonly genre: string | null;
  readonly circle: string | null;
  readonly participants: number;
  readonly artworks: number;
  /** 観覧者が投票できるか（isPublic）。 */
  readonly viewerVotable: boolean;
}

/** 企画一覧の1行。 */
export interface OrganizerProjectSummary {
  readonly id: ProjectId;
  readonly title: string;
  readonly theme: string;
  readonly phase: Phase;
  readonly gameType: GameType;
  readonly participants: number;
}

/** ランキング行に表示名を添えたもの。 */
export interface RankingEntry extends ScoreRow {
  readonly displayName: string;
  readonly rank: number;
}

/** 参加者ダッシュボードの「今やること」。 */
export interface ParticipantTask {
  readonly phaseLabel: string;
  readonly action: string;
  readonly deadline: string | null;
  readonly done: boolean;
}

/** 主催ダッシュボードの参加者行（招待リンク・提出状況）。 */
export interface OrganizerRosterEntry {
  readonly displayName: string;
  readonly inviteToken: string;
  readonly submittedDesign: boolean;
  readonly submittedArtwork: boolean;
}

/** 主催ダッシュボードの割当1件（匿名ラベル＋難易度/希望の充足）。 */
export interface OrganizerMatch {
  readonly designLabel: string;
  readonly artistLabel: string;
  readonly designDifficulty: Difficulty;
  readonly artistComfort: Difficulty;
  readonly satisfied: boolean;
}

/** 主催ダッシュボードの全体像。matching は匿名ラベル（作者↔提出物は伏せる）。 */
export interface OrganizerOverview {
  readonly project: Project;
  readonly roster: OrganizerRosterEntry[];
  readonly matching: OrganizerMatch[] | null;
  readonly preferenceSatisfied: { ok: number; total: number } | null;
  readonly counts: { participants: number; designs: number; artworks: number };
}

export interface Repository {
  getProject(id: ProjectId): Promise<Project | null>;
  listParticipations(projectId: ProjectId): Promise<Participation[]>;

  /** セッション復元用: 参加者IDから参加者を引く。 */
  getParticipationById(id: ParticipationId): Promise<Participation | null>;

  /** 招待トークンから参加者を引く（/join の入口）。無効なら null。 */
  getParticipationByInviteToken(token: string): Promise<Participation | null>;

  /** 投票・ギャラリー用の作者を伏せた作品一覧（Voting 到達後のみ中身を返す）。 */
  getPublicArtworkCards(projectId: ProjectId): Promise<PublicArtworkCard[]>;

  /**
   * 作品ごとの「選べる作者候補」。サーバ側で除外を適用して返す:
   *  - 常に: 投票者自身（同名の人物）を除外
   *  - 主催が excludeArtistGuess を有効にしていれば: その作品の作画者を除外
   * 除外理由はクライアントに返さない（匿名性のため許可リストのみ返す）。
   * @param voterParticipationId 参加者なら自身のID、観覧者は null。
   */
  getBallotChoices(
    projectId: ProjectId,
    voterParticipationId: ParticipationId | null,
  ): Promise<Record<string, DesignerChoice[]>>;

  /** 参加者の「今やること」。 */
  getParticipantTask(
    projectId: ProjectId,
    participationId: ParticipationId,
  ): Promise<ParticipantTask | null>;

  /** 結果発表（Result フェーズのみ）。それ以外は空配列。 */
  getRevealedResults(projectId: ProjectId): Promise<RevealedResult[]>;

  /** 正解率ランキング（参加者のみ、Result フェーズのみ）。 */
  getParticipantRanking(projectId: ProjectId): Promise<RankingEntry[]>;

  /** 現在の投票者の既存の投票用紙を取得（変更可のため）。無ければ null。 */
  getBallot(projectId: ProjectId, voter: VoterRef): Promise<Ballot | null>;

  /** 投票用紙を保存（同一投票者の既存分があれば置き換え＝締切前の変更）。 */
  saveBallot(ballot: Ballot): Promise<void>;

  /** 投票者自身のデザインから作られた作品ID（自作品。投票対象外。無ければnull）。 */
  getMyDesignArtworkId(
    projectId: ProjectId,
    participationId: ParticipationId,
  ): Promise<ArtworkId | null>;

  /**
   * 絵柄当て: 参加者が自分の作品を1枚提出する（作者=作画者=本人）。
   * 既存があれば置換（締切前の差し替え）。ArtworkSubmission フェーズのみ。
   */
  submitOwnArtwork(input: {
    projectId: ProjectId;
    participationId: ParticipationId;
    imageUrl: string;
    caption: string;
  }): Promise<{ ok: boolean; reason?: string }>;

  // ---- 主催（organizer）操作 ----

  /** 主催ダッシュボードの全体像を取得。 */
  getOrganizerOverview(projectId: ProjectId): Promise<OrganizerOverview | null>;

  /** フェーズを前後に移動（前方向が原則、prev は例外操作）。 */
  advanceProjectPhase(
    projectId: ProjectId,
    direction: "next" | "prev",
  ): Promise<void>;

  /** 主催オプション: 作画者を投票候補から除外するか。 */
  setExcludeArtistGuess(projectId: ProjectId, value: boolean): Promise<void>;

  /** シャッフル実行（提出済みで derangement 割当を生成・保存）。 */
  runShuffle(
    projectId: ProjectId,
  ): Promise<{ ok: boolean; reason?: string }>;

  /** 新規企画を作成し、参加者と招待トークンを発行。企画IDを返す。 */
  createProject(input: CreateProjectInput): Promise<ProjectId>;

  /** 企画一覧（主催の全企画）。 */
  listOrganizerProjects(): Promise<OrganizerProjectSummary[]>;

  /**
   * 閲覧者向けの公開企画一覧（Recruiting/Voting など進行中）。
   *  - public は常に対象
   *  - restricted は filter（ジャンル/界隈）に一致する場合のみ対象
   *  - unlisted は常に対象外（リンク限定）
   * filter 未指定なら public のみ。
   */
  listPublicProjects(filter?: string): Promise<PublicProjectSummary[]>;

  /** 未提出者へ催促通知を送る（送った件数を返す）。 */
  nudgeUnsubmitted(projectId: ProjectId): Promise<number>;

  // ---- 通知 ----

  listNotifications(participationId: ParticipationId): Promise<Notification[]>;
  unreadNotificationCount(participationId: ParticipationId): Promise<number>;
  markNotificationsRead(participationId: ParticipationId): Promise<void>;
}
