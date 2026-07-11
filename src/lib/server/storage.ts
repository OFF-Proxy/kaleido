/**
 * R2（Cloudflare オブジェクトストレージ）ヘルパ。
 *
 * 保存前に必ず画像メタデータ（Exif 等）を除去する（要件 6.1）。
 * バケットは platform.env.BUCKET（wrangler.toml の binding = "BUCKET"）。
 * 型は @cloudflare/workers-types 導入後に R2Bucket へ厳密化する。
 */
import { stripImageMetadata } from "$lib/domain/image-metadata.js";

interface R2ObjectBodyish {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  size?: number;
}
interface R2Bucketish {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyish | null>;
  delete(key: string): Promise<void>;
}

/** 許可する画像 MIME。 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** 1枚あたりの上限（10MB）。 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function isAllowedImageType(t: string): t is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(t);
}

/** 提出画像のオブジェクトキーを組み立てる（projectId 配下に置く）。 */
export function submissionKey(
  projectId: string,
  kind: "design" | "artwork",
  id: string,
): string {
  return `${projectId}/${kind}/${id}`;
}

/**
 * 画像を Exif 除去してから R2 に保存する。
 * @returns 保存したオブジェクトキー
 */
export async function putSubmissionImage(
  bucket: unknown,
  key: string,
  bytes: Uint8Array,
  contentType: AllowedImageType,
): Promise<string> {
  const cleaned = stripImageMetadata(bytes).bytes;
  await (bucket as R2Bucketish).put(key, cleaned, {
    httpMetadata: { contentType },
  });
  return key;
}

/** R2 から画像オブジェクトを取得（サーバ経由配信用。作者匿名性のため直リンクにしない）。 */
export async function getSubmissionImage(
  bucket: unknown,
  key: string,
): Promise<R2ObjectBodyish | null> {
  return (bucket as R2Bucketish).get(key);
}
