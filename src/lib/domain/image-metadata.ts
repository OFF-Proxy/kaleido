/**
 * 画像メタデータ（Exif 等）除去（要件定義 6.1）。
 *
 * アップロード画像の Exif（撮影機材・GPS・日時など）や XMP/IPTC/コメントから
 * 作者が推測されるのを防ぐため、投稿時にメタデータを剥がす。
 *
 * 純関数・ランタイム非依存（Uint8Array のみ）。Cloudflare Workers でも Node でも動く。
 * ピクセルは再エンコードせず、メタデータを持つセグメント/チャンクだけを取り除く。
 */

export type StripResult = {
  /** メタデータを除去した画像バイト列。 */
  readonly bytes: Uint8Array;
  /** 判別した形式。unknown はそのまま返している。 */
  readonly format: "jpeg" | "png" | "unknown";
};

/** 画像バイト列からメタデータを除去する。未知形式はそのまま返す。 */
export function stripImageMetadata(input: Uint8Array): StripResult {
  if (isJpeg(input)) return { bytes: stripJpeg(input), format: "jpeg" };
  if (isPng(input)) return { bytes: stripPng(input), format: "png" };
  return { bytes: input, format: "unknown" };
}

// ------------------------------------------------------------------ JPEG

function isJpeg(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/**
 * JPEG からメタデータセグメントを除去する。
 * 除去対象: APP1〜APP15（0xFFE1〜0xFFEF: Exif/XMP/IPTC/Photoshop 等）と COM（0xFFFE: コメント）。
 * 保持: SOI, APP0(JFIF), 量子化/ハフマンテーブル・フレーム等、そして SOS 以降の圧縮データ。
 */
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8]; // SOI
  let i = 2;
  const n = b.length;

  while (i + 1 < n) {
    // マーカー境界（0xFF）まで進む
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    // 連続する 0xFF のパディングをスキップ
    let marker = b[i + 1]!;
    while (marker === 0xff && i + 2 < n) {
      i++;
      marker = b[i + 1]!;
    }

    // SOS: ここから圧縮スキャンデータ。残り全部をそのままコピーして終了。
    if (marker === 0xda) {
      for (let k = i; k < n; k++) out.push(b[k]!);
      return Uint8Array.from(out);
    }
    // EOI
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      i += 2;
      continue;
    }
    // 長さを持たないスタンドアロンマーカー（RSTn, TEM）
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }

    // 長さ付きセグメント
    if (i + 3 >= n) break;
    const len = (b[i + 2]! << 8) | b[i + 3]!; // 長さは自身の2バイトを含む
    const segEnd = i + 2 + len;
    if (len < 2 || segEnd > n) break; // 壊れている: 打ち切り

    const isAppMeta = marker >= 0xe1 && marker <= 0xef; // APP1..APP15
    const isComment = marker === 0xfe; // COM
    if (!isAppMeta && !isComment) {
      for (let k = i; k < segEnd; k++) out.push(b[k]!); // セグメントを保持
    }
    i = segEnd;
  }

  return Uint8Array.from(out);
}

// ------------------------------------------------------------------- PNG

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array): boolean {
  if (b.length < 8) return false;
  for (let i = 0; i < 8; i++) if (b[i] !== PNG_SIG[i]) return false;
  return true;
}

/**
 * PNG からメタデータチャンクを除去する。
 * 除去対象: eXIf, tEXt, zTXt, iTXt, tIME（メタデータ）。
 * 保持: IHDR/PLTE/IDAT/IEND などの重要チャンクと、その他の描画に関わる補助チャンク。
 */
function stripPng(b: Uint8Array): Uint8Array {
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const out: number[] = [];
  for (let k = 0; k < 8; k++) out.push(b[k]!); // 署名

  let i = 8;
  const n = b.length;
  while (i + 8 <= n) {
    const len =
      (b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!;
    const type = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    const chunkEnd = i + 12 + len; // len(4)+type(4)+data(len)+crc(4)
    if (len < 0 || chunkEnd > n) break; // 壊れている

    if (!drop.has(type)) {
      for (let k = i; k < chunkEnd; k++) out.push(b[k]!);
    }
    i = chunkEnd;
    if (type === "IEND") break;
  }

  return Uint8Array.from(out);
}
