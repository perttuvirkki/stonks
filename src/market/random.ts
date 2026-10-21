let spareGaussian: number | null = null;

// Standard normal via the polar Box–Muller method (caches the second value of each pair).
export const gaussian = () => {
  if (spareGaussian !== null) {
    const value = spareGaussian;
    spareGaussian = null;
    return value;
  }
  let u = 0;
  let v = 0;
  let s = 0;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s === 0 || s >= 1);
  const scale = Math.sqrt((-2 * Math.log(s)) / s);
  spareGaussian = v * scale;
  return u * scale;
};

// Fat-tailed shock: mostly normal, now and then a 2-3x move, like real minute bars.
export const shock = () => gaussian() * (Math.random() < 0.06 ? 2.4 : 1);

export const range = (min: number, max: number) => min + Math.random() * (max - min);

export const rangeInt = (min: number, max: number) => Math.floor(range(min, max + 1));

export const chance = (probability: number) => Math.random() < probability;

export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
