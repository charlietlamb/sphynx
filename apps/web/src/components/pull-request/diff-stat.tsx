interface DiffStatProps {
  additions: number;
  deletions: number;
}

export function DiffStat({ additions, deletions }: DiffStatProps) {
  return (
    <span className="font-mono text-xs tabular-nums">
      <span className="text-addition">+{additions}</span>{" "}
      <span className="text-deletion">−{deletions}</span>
    </span>
  );
}
