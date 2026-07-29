"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { userToken } from "./userToken";

const API_URL = process.env.GITHUB_API_URL ?? "https://api.github.com";
const API_VERSION = process.env.GITHUB_API_VERSION ?? "2022-11-28";

interface RawInstallation {
  account: { login: string; type: string; avatar_url: string } | null;
  id: number;
  repository_selection: string;
}

/**
 * The installations the signed-in user can access, from GitHub as the user. A
 * live passthrough — the app can't materialize which installations a given user
 * belongs to. Feeds the org switcher.
 */
export const listInstallations = action({
  args: {},
  returns: v.object({
    installations: v.array(
      v.object({
        id: v.number(),
        accountLogin: v.string(),
        accountType: v.string(),
        avatarUrl: v.union(v.string(), v.null()),
        repositorySelection: v.string(),
      })
    ),
  }),
  handler: async (ctx) => {
    const token = await userToken(ctx);
    const res = await fetch(`${API_URL}/user/installations?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
      },
    });
    if (!res.ok) {
      throw new Error(`list installations failed: ${res.status}`);
    }
    const body = (await res.json()) as { installations: RawInstallation[] };
    return {
      installations: body.installations.map((raw) => ({
        id: raw.id,
        accountLogin: raw.account?.login ?? "",
        accountType: raw.account?.type ?? "",
        avatarUrl: raw.account?.avatar_url ?? null,
        repositorySelection: raw.repository_selection,
      })),
    };
  },
});
