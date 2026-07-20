/**
 * The GitHub App users install. Dev and production are separate apps, so the
 * slug comes from the environment rather than being hardcoded.
 */
const SLUG = import.meta.env.VITE_GITHUB_APP_SLUG ?? "sphynx-development";

export const INSTALL_URL = `https://github.com/apps/${SLUG}/installations/new`;

/**
 * Where a missing repository permission is actually resolved.
 *
 * Signing in again cannot grant it: GitHub requires the account the app is
 * installed on to approve updated repository permissions, which happens here.
 */
export const installationSettingsUrl = (owner: string) =>
  `https://github.com/organizations/${owner}/settings/installations`;
