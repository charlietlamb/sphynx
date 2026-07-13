const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(EDGE_DASHES, "");
}
