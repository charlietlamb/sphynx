export const WEAK_SCORE = 0.5;
export const STRONG_SCORE = 0.8;

export function scoreClass(ratio: number) {
  if (ratio >= STRONG_SCORE) {
    return "text-addition";
  }
  if (ratio < WEAK_SCORE) {
    return "text-deletion";
  }
  return "text-amber-500";
}
