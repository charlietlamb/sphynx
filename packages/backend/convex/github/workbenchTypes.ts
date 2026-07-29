import { v } from "convex/values";

export const workbenchEventKindValidator = v.union(
  v.literal("pr-opened"),
  v.literal("pr-merged"),
  v.literal("pr-closed"),
  v.literal("pr-reopened"),
  v.literal("pr-ready"),
  v.literal("review-approved"),
  v.literal("review-changes"),
  v.literal("review-commented"),
  v.literal("comment"),
  v.literal("push"),
  v.literal("branch-created"),
  v.literal("branch-deleted"),
  v.literal("release")
);

export type WorkbenchEventKind =
  | "pr-opened"
  | "pr-merged"
  | "pr-closed"
  | "pr-reopened"
  | "pr-ready"
  | "review-approved"
  | "review-changes"
  | "review-commented"
  | "comment"
  | "push"
  | "branch-created"
  | "branch-deleted"
  | "release";

export interface GitHubUser {
  login: string;
  avatarUrl: string;
}

export interface WorkbenchEvent {
  id: string;
  at: string;
  actor: GitHubUser;
  kind: WorkbenchEventKind;
  pull: {
    number: number;
    title: string | null;
  } | null;
  detail: string | null;
  url: string | null;
}
