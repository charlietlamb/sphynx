const WHITESPACE = /\s+/;

export function initials(primary: string, fallback = "") {
  const source = primary.trim() || fallback;
  const parts = source.split(WHITESPACE).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
