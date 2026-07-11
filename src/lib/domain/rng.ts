/**
 * 決定的な擬似乱数生成器（テスト・再現性のため）。
 *
 * 本番のシャッフルでは暗号学的乱数（crypto.getRandomValues 等）を注入する想定だが、
 * テストでは seed を固定して再現可能にしたいので、注入可能な RNG インタフェースを定義する。
 */
export interface Rng {
  /** [0, 1) の浮動小数を返す。 */
  next(): number;
  /** [0, maxExclusive) の整数を返す。 */
  nextInt(maxExclusive: number): number;
}

/**
 * mulberry32 — 高速でテストに十分な品質の決定的 PRNG。
 * 暗号用途ではない。本番の割当抽選には {@link cryptoRng} を使うこと。
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return Math.floor(next() * maxExclusive);
    },
  };
}

/**
 * 暗号学的乱数を用いた RNG。本番のシャッフル抽選で使用する。
 * Node.js / モダンブラウザの globalThis.crypto を利用する。
 */
export function cryptoRng(): Rng {
  const getRandomUint32 = (): number => {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0]!;
  };
  const next = (): number => getRandomUint32() / 4294967296;
  return {
    next,
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      // モジュロバイアスを避けるための棄却サンプリング
      const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
      let x = getRandomUint32();
      while (x >= limit) x = getRandomUint32();
      return x % maxExclusive;
    },
  };
}
