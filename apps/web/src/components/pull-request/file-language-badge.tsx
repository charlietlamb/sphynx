const EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

function FileLanguageBadge({ path }: { path: string }) {
  const language = EXTENSION_PATTERN.exec(path)?.[1]?.toUpperCase();
  if (!language) {
    return null;
  }
  return (
    <span className="rounded-sm border border-border bg-muted/40 px-1 py-px font-mono text-[10px] text-muted-foreground leading-4">
      {language}
    </span>
  );
}

export function renderFileLanguagePrefix(item: { id: string }) {
  return <FileLanguageBadge path={item.id} />;
}
