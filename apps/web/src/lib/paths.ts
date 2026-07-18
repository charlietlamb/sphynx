export function baseName(path: string) {
  return path.split("/").at(-1) ?? path;
}
