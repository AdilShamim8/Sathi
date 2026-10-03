/** Deterministic seeded PRNG (mulberry32) for reproducible synthetic data. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    int: (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min,
    pick<T>(arr: T[]): T {
      return arr[Math.floor(rand() * arr.length)];
    },
    chance(p: number): boolean {
      return rand() < p;
    },
    /** approx normal via central limit */
    normal(mean: number, sd: number): number {
      let s = 0;
      for (let i = 0; i < 6; i++) s += rand();
      return mean + sd * (s - 3);
    },
  };
}

export type Rng = ReturnType<typeof makeRng>;
