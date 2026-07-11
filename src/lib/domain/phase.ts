/**
 * フェーズ状態機械（要件定義 第9章）。
 *
 * 企画は原則として前方向にのみ遷移する。各フェーズで「作者・作画者・割当」を
 * クライアントへ返してよいかの境界（秘匿境界）もここで一元管理する。
 * 秘匿解除は Result 到達時のみ。
 */
import type { Phase } from "./types.js";

export const PHASE_ORDER: readonly Phase[] = [
  "Draft",
  "Recruiting",
  "DesignSubmission",
  "Shuffling",
  "ArtworkSubmission",
  "Voting",
  "Result",
];

export interface PhaseMeta {
  readonly phase: Phase;
  readonly label: string;
  /** 参加者ダッシュボードに出す「今やること」の既定文言。 */
  readonly participantAction: string;
  /** このフェーズで作者・作画者・割当の対応を開示してよいか。 */
  readonly revealAuthors: boolean;
}

export const PHASE_META: Record<Phase, PhaseMeta> = {
  Draft: {
    phase: "Draft",
    label: "下書き",
    participantAction: "主催が企画を準備中です。",
    revealAuthors: false,
  },
  Recruiting: {
    phase: "Recruiting",
    label: "募集",
    participantAction: "参加登録を受付中です。",
    revealAuthors: false,
  },
  DesignSubmission: {
    phase: "DesignSubmission",
    label: "デザイン提出",
    participantAction: "キャラクターのデザインを提出しましょう。",
    revealAuthors: false,
  },
  Shuffling: {
    phase: "Shuffling",
    label: "シャッフル",
    participantAction: "割当を待っています。まもなく作画対象が届きます。",
    revealAuthors: false,
  },
  ArtworkSubmission: {
    phase: "ArtworkSubmission",
    label: "作画提出",
    participantAction: "割り当てられたデザインを作画して提出しましょう。",
    revealAuthors: false,
  },
  Voting: {
    phase: "Voting",
    label: "投票",
    participantAction: "各作品のデザイナーを推理して投票しましょう。",
    revealAuthors: false,
  },
  Result: {
    phase: "Result",
    label: "結果発表",
    participantAction: "答え合わせとランキングを確認しましょう。",
    revealAuthors: true,
  },
};

/** 前方向の次フェーズ。Result は終端。 */
export function nextPhase(phase: Phase): Phase | null {
  const i = PHASE_ORDER.indexOf(phase);
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1]! : null;
}

/** a は b より後（進行済み）か。 */
export function isAtOrAfter(a: Phase, b: Phase): boolean {
  return PHASE_ORDER.indexOf(a) >= PHASE_ORDER.indexOf(b);
}

/**
 * 通常操作で作者・作画者・割当の対応を返してよいか。
 * 唯一 true になるのは Result フェーズ（緊急開示 F-29 は別経路・監査ログ付き）。
 */
export function mayRevealAuthors(phase: Phase): boolean {
  return PHASE_META[phase].revealAuthors;
}

/** 前方向の遷移のみ許可（巻き戻しは主催の例外操作として別扱い）。 */
export function canAdvance(from: Phase, to: Phase): boolean {
  return PHASE_ORDER.indexOf(to) === PHASE_ORDER.indexOf(from) + 1;
}
