/**
 * ドメインの型定義（要件定義 第7章 データモデル）。
 *
 * 匿名性の原則（1.4 / 6.1）:
 *  - Design / Artwork と「作者 Participation」の紐付けは秘匿対象。
 *  - 参加者・観覧者・主催に返す DTO には作者情報を含めない。
 *  - 秘匿解除は Result フェーズのみ（→ phase.ts）。
 */

export type ParticipationId = string;
export type ProjectId = string;
export type DesignId = string;
export type ArtworkId = string;

/** ゲーム種別。daredeza=誰デザ / egaraate=絵柄当て。 */
export type GameType = "daredeza" | "egaraate";

export const GAME_LABELS: Record<GameType, string> = {
  daredeza: "誰デザ",
  egaraate: "絵柄当て",
};

/** ゲームごとの「当てる対象」ラベル（投票文言に使う）。 */
export const GAME_GUESS_TARGET: Record<GameType, string> = {
  daredeza: "デザイナー",
  egaraate: "描いた人",
};

/** 公開範囲。public=一覧公開 / unlisted=リンク限定 / restricted=界隈限定。 */
export type Visibility = "public" | "unlisted" | "restricted";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "公開（一覧に載せる）",
  unlisted: "リンク限定（知っている人だけ）",
  restricted: "界隈限定（ジャンル/界隈で絞る）",
};

/** 難易度・希望のレベル（1=かんたん 2=ふつう 3=むずかしい）。 */
export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "かんたん",
  2: "ふつう",
  3: "むずかしい",
};

/** 作画希望のラベル（受け手が「描きたい難易度の上限」を選ぶ）。 */
export const COMFORT_LABELS: Record<Difficulty, string> = {
  1: "かんたんめ希望",
  2: "ふつうまで",
  3: "むずかしくてもOK",
};

/** 企画の進行フェーズ（詳細な遷移規則は phase.ts）。 */
export type Phase =
  | "Draft"
  | "Recruiting"
  | "DesignSubmission"
  | "Shuffling"
  | "ArtworkSubmission"
  | "Voting"
  | "Result";

/** 企画。 */
export interface Project {
  readonly id: ProjectId;
  readonly title: string;
  readonly theme: string;
  readonly description: string;
  readonly phase: Phase;
  /** ゲーム種別（誰デザ / 絵柄当て）。 */
  readonly gameType: GameType;
  /** 公開範囲（一覧掲載の可否・界隈限定など）。 */
  readonly visibility: Visibility;
  /** ジャンル/カテゴリ（任意）。 */
  readonly genre: string | null;
  /** 界隈（任意）。 */
  readonly circle: string | null;
  /** true なら観覧者も投票できる（投票開放）。 */
  readonly isPublic: boolean;
  /**
   * 主催オプション: 投票の作者候補から「その作品を描いた作画者」を除外するか。
   * 作画者はシャッフルで必ずデザイナー≠作画者なので正解にはなり得ない。
   * ただし候補から消すと作画者の匿名性がやや弱まるため、企画ごとに選べる。
   */
  readonly excludeArtistGuess: boolean;
  readonly deadlines: {
    readonly design?: string; // ISO 日時
    readonly artwork?: string;
    readonly voting?: string;
  };
}

/** 参加者の企画への参加。個別トークンで識別（要件 4.1 / 8.1）。 */
export interface Participation {
  readonly id: ParticipationId;
  readonly projectId: ProjectId;
  readonly displayName: string;
  readonly status: "invited" | "joined";
}

/** デザイン提出。authorId は秘匿対象なので DTO には出さない。 */
export interface Design {
  readonly id: DesignId;
  readonly projectId: ProjectId;
  readonly authorId: ParticipationId; // 秘匿
  readonly imageUrl: string;
  readonly caption: string; // 設定文
  /** このデザインの複雑さ（作者が提出時に自己申告）。 */
  readonly difficulty: Difficulty;
  /** 提出者が「描きたい難易度の上限」＝回ってくるデザインの希望（提出時）。 */
  readonly preferredDifficulty: Difficulty;
  readonly submittedAt: string;
}

/** シャッフル割当。作者 ≠ 作画者（shuffle.ts が保証）。 */
export interface Assignment {
  readonly projectId: ProjectId;
  readonly designId: DesignId;
  readonly designAuthorId: ParticipationId; // 秘匿
  readonly artistId: ParticipationId; // 秘匿
}

/** 作画提出。artistId は秘匿対象。 */
export interface Artwork {
  readonly id: ArtworkId;
  readonly projectId: ProjectId;
  /** 誰デザは元デザインID。絵柄当ては自作品のため無い。 */
  readonly designId?: DesignId;
  readonly artistId: ParticipationId; // 秘匿
  readonly imageUrl: string;
  readonly caption?: string;
  readonly submittedAt: string;
}

/** 1 票: 投票者が「この作品のデザイナーは誰か」を推理した内容。 */
export interface Vote {
  readonly artworkId: ArtworkId;
  readonly guessedDesignerId: ParticipationId;
}

/** 投票用紙: 1 投票者の一連の Vote（要件 4.5）。 */
export interface Ballot {
  readonly projectId: ProjectId;
  /** 参加者票なら participationId、観覧者票なら null。 */
  readonly voterParticipationId: ParticipationId | null;
  /** 観覧者票の重複抑止用の匿名セッション鍵。 */
  readonly anonymousKey: string | null;
  readonly votes: readonly Vote[];
  readonly submittedAt: string;
}

/* ------------------------------------------------------------------ DTO
 * 画面に返す用の、作者情報を含まない安全なビュー。
 */

/** 投票・ギャラリー画面に出す作品カード（作者・作画者を伏せる）。 */
export interface PublicArtworkCard {
  readonly artworkId: ArtworkId;
  readonly imageUrl: string;
  /** 表示上のラベル（例: "作品 03"）。提出順は漏らさない。 */
  readonly label: string;
  readonly caption: string;
}

/** 作者候補（投票の選択肢）。 */
export interface DesignerChoice {
  readonly participationId: ParticipationId;
  readonly displayName: string;
}

/** 結果発表での 1 作品の答え合わせ（Result フェーズのみ生成）。 */
export interface RevealedResult {
  readonly artworkId: ArtworkId;
  readonly imageUrl: string;
  readonly label: string;
  readonly designerName: string;
  readonly artistName: string;
  /** この作品を正しく当てた投票者数。 */
  readonly correctCount: number;
  readonly totalVotes: number;
}

/** サイト内通知（締切リマインド・催促・フェーズ移行など）。 */
export interface Notification {
  readonly id: string;
  readonly participationId: ParticipationId;
  readonly body: string;
  /** クリックで飛ぶ先（任意）。 */
  readonly href: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}
