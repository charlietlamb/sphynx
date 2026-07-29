import type * as Contract from "@sphynx/schema/read-model";
import { type Infer, v } from "convex/values";

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

export type {
  WorkbenchEvent,
  WorkbenchEventKind,
} from "@sphynx/schema/read-model";

export interface GitHubUser {
  avatarUrl: string;
  login: string;
}

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _kindParity: Exact<
  Infer<typeof workbenchEventKindValidator>,
  Contract.WorkbenchEventKind
> = true;
