import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reconcile read model",
  { minutes: 15 },
  internal.github.reconcile.reconcile,
  {}
);

export default crons;
