/**
 * セッション（個別トークン認証）のCookieユーティリティ。
 *
 * 招待トークンで参加者を識別したのち、参加者IDを HMAC-SHA256 で署名した値を
 * httpOnly Cookie に保存する。改ざん（他人へのなりすまし）を署名で防ぐ。
 *
 * ランタイム非依存: Web Crypto（globalThis.crypto.subtle）を使うため、
 * Cloudflare Workers（edge）でも Node でもそのまま動く。
 * 本番では SESSION_SECRET を必ず環境変数で設定すること。
 */
import { env } from "$env/dynamic/private";

const encoder = new TextEncoder();

/** セッションCookie名。 */
export const SESSION_COOKIE = "dd_session";

async function hmacKey(): Promise<CryptoKey> {
  const secret = env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(value: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(value),
  );
  return toBase64Url(sig);
}

/** 参加者IDを署名付きトークンに変換する。 */
export async function makeSessionToken(
  participationId: string,
): Promise<string> {
  return `${participationId}.${await sign(participationId)}`;
}

/** Cookie値を検証し、正しければ参加者IDを返す。改ざん・不正なら null。 */
export async function readSessionToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(id);
  // 長さが違えば不一致。長さが同じ場合は定数時間比較。
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? id : null;
}

/** Cookie設定の共通オプション。 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 30, // 30日
} as const;

// ---- 主催（organizer）セッション ----
// 参加者(dd_session)とは別枠。主催ユーザーIDを署名して保持する。

/** 主催セッションCookie名。 */
export const ORG_SESSION_COOKIE = "dd_org";

/** 主催ユーザーIDを署名付きトークンにする（makeSessionToken と同形式）。 */
export async function makeOrgSessionToken(userId: string): Promise<string> {
  return makeSessionToken(userId);
}

/** 主催セッションCookieを検証して主催ユーザーIDを返す。不正なら null。 */
export async function readOrgSessionToken(
  token: string | undefined,
): Promise<string | null> {
  return readSessionToken(token);
}

// ---- 共同ホスト招待トークン ----
// オーナーが発行するリンク。projectId を署名して「このリンクは正規発行」を担保する。

const COHOST_PREFIX = "cohost:";

/** cohost 招待トークンを作る（projectId を署名）。 */
export async function makeCohostInviteToken(
  projectId: string,
): Promise<string> {
  return makeSessionToken(`${COHOST_PREFIX}${projectId}`);
}

/** cohost 招待トークンを検証して projectId を返す。不正なら null。 */
export async function readCohostInviteToken(
  token: string | undefined,
): Promise<string | null> {
  const value = await readSessionToken(token);
  if (!value || !value.startsWith(COHOST_PREFIX)) return null;
  return value.slice(COHOST_PREFIX.length);
}
