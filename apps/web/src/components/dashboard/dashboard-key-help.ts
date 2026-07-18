export interface DashboardKeyHelp {
  action: string;
  chord: string;
  description: string;
  keys: string;
}

export const DASHBOARD_KEY_HELP: readonly DashboardKeyHelp[] = [
  {
    action: "move",
    chord: "j / k",
    description: "Move through the queue",
    keys: "j k",
  },
  {
    action: "open",
    chord: "p / ↵",
    description: "Open the focused pull",
    keys: "p",
  },
  {
    action: "merge",
    chord: "m",
    description: "Merge (with confirmation)",
    keys: "m",
  },
  {
    action: "block",
    chord: "b",
    description: "Block (with confirmation)",
    keys: "b",
  },
  {
    action: "branch",
    chord: "1-9",
    description: "Filter to a branch (again to clear)",
    keys: "1–9",
  },
  {
    action: "repo",
    chord: "[ ]",
    description: "Switch repo",
    keys: "[ ]",
  },
];
