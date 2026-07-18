const AGE_STEPS: readonly [number, string][] = [
  [60, "m"],
  [24, "h"],
  [365, "d"],
];

export function shortAge(iso: string, now: number) {
  let value = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  for (const [limit, unit] of AGE_STEPS) {
    if (value < limit) {
      return `${value}${unit}`;
    }
    value = Math.round(value / limit);
  }
  return `${value}y`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function fullDate(iso: string) {
  return DATE_FORMAT.format(new Date(iso));
}

export function ageDays(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / 86_400_000;
}
