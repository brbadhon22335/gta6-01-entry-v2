// A small seeded random number generator (mulberry32): the same seed always
// builds the same city and the same traffic, so the screenshot scenes are
// repeatable and two runs of the game agree.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from 0 up to (but not including) n, from a random source. */
export function pickInt(random, n) {
  return Math.floor(random() * n);
}

/** One item of an array, picked by a random source. */
export function pickOne(random, list) {
  return list[Math.floor(random() * list.length)];
}
