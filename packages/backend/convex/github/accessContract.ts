import { type Infer, v } from "convex/values";

export const installationValidator = v.object({
  id: v.number(),
  accountLogin: v.string(),
  accountType: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
  repositorySelection: v.string(),
});

export type InstallationAccess = Infer<typeof installationValidator>;
