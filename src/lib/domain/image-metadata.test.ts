import { test } from "node:test";
import assert from "node:assert/strict";
import { stripImageMetadata } from "./image-metadata.js";

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const u8 = (nums: number[]): Uint8Array => Uint8Array.from(nums);

/** haystack に needle（部分列）が含まれるか。 */
function includesSub(hay: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

test("JPEG: Exif(APP1)とCOMを除去し、JFIF(APP0)・DQT・スキャンデータは保持", () => {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const app1Exif = [0xff, 0xe1, 0x00, 0x0c, ...ascii("Exif\0\0"), 0, 0, 0, 0];
  const com = [0xff, 0xfe, 0x00, 0x08, ...ascii("secret")];
  const dqt = [0xff, 0xdb, 0x00, 0x03, 0x00];
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00];
  const scan = [0xaa, 0xbb];
  const eoi = [0xff, 0xd9];
  const input = u8([0xff, 0xd8, ...app0, ...app1Exif, ...com, ...dqt, ...sos, ...scan, ...eoi]);

  const { bytes, format } = stripImageMetadata(input);
  assert.equal(format, "jpeg");
  assert.deepEqual([bytes[0], bytes[1]], [0xff, 0xd8]); // SOI
  assert.ok(includesSub(bytes, ascii("JFIF")), "JFIF(APP0) は残す");
  assert.ok(includesSub(bytes, [0xff, 0xdb]), "DQT は残す");
  assert.ok(includesSub(bytes, [0xaa, 0xbb]), "スキャンデータは残す");
  assert.deepEqual([bytes[bytes.length - 2], bytes[bytes.length - 1]], [0xff, 0xd9]);
  assert.ok(!includesSub(bytes, ascii("Exif")), "Exif は除去");
  assert.ok(!includesSub(bytes, ascii("secret")), "COM(コメント) は除去");
  assert.ok(!includesSub(bytes, [0xff, 0xe1]), "APP1 マーカーは消える");
  assert.ok(!includesSub(bytes, [0xff, 0xfe]), "COM マーカーは消える");
});

test("PNG: eXIf/tEXt を除去し、IHDR/IEND は保持", () => {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = [0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 0, 8, 0, 0, 0, 8, 8, 6, 0, 0, 0, 0, 0, 0, 0];
  const exif = [0, 0, 0, 4, ...ascii("eXIf"), 1, 2, 3, 4, 0, 0, 0, 0];
  const text = [0, 0, 0, 10, ...ascii("tEXt"), ...ascii("Author=Neo"), 0, 0, 0, 0];
  const iend = [0, 0, 0, 0, ...ascii("IEND"), 0xae, 0x42, 0x60, 0x82];
  const input = u8([...sig, ...ihdr, ...exif, ...text, ...iend]);

  const { bytes, format } = stripImageMetadata(input);
  assert.equal(format, "png");
  assert.ok(includesSub(bytes, ascii("IHDR")), "IHDR は残す");
  assert.ok(includesSub(bytes, ascii("IEND")), "IEND は残す");
  assert.ok(!includesSub(bytes, ascii("eXIf")), "eXIf は除去");
  assert.ok(!includesSub(bytes, ascii("Author=Neo")), "tEXt は除去");
});

test("未知の形式はそのまま返す", () => {
  const input = u8([1, 2, 3, 4, 5]);
  const { bytes, format } = stripImageMetadata(input);
  assert.equal(format, "unknown");
  assert.deepEqual([...bytes], [1, 2, 3, 4, 5]);
});
