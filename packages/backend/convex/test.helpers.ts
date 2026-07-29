declare global {
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
}

export const testModules = import.meta.glob("./**/*.*s");
