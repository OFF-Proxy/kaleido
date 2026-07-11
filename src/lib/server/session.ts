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
