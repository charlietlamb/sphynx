interface DiffStatProps {
  additions: number;
  deletions: number;
}

export function DiffStat({ additions, deletions }: DiffStatProps) {
  return (
    <span className="font-mono text-xs tabular-nums">
      <span className="text-emerald-600 dark:text-emerald-400">
        +{additions}
      </span>{" "}
      <span className="text-destructive">−{deletions}</span>
    </span>
  );
}
