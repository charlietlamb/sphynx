export interface DashboardKeyHelp {
  chord: string;
  description: string;
}

export const DASHBOARD_KEY_HELP: readonly DashboardKeyHelp[] = [
  { chord: "j / k", description: "Move through the queue" },
  { chord: "p / \u21b5", description: "Open the focused pull" },
  { chord: "m", description: "Merge (with confirmation)" },
  { chord: "b", description: "Block (with confirmation)" },
  { chord: "1-9", description: "Filter to a branch (again to clear)" },
  { chord: "[ ]", description: "Switch repo" },
];
