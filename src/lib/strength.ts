/** Epley estimated one-rep max. Sets above 12 reps are too noisy to estimate from. */
export function e1rm(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0 || reps > 12) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function setVolume(sets: { weight: number; reps: number; warmup?: boolean }[]) {
  return sets.reduce((acc, s) => (s.warmup ? acc : acc + s.weight * s.reps), 0);
}

export function formatSet(s: { weight: number; reps: number }) {
  return s.weight > 0 ? `${trimKg(s.weight)}×${s.reps}` : `BW×${s.reps}`;
}

export const trimKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
