/**
 * The GitHub App users install. Dev and production are separate apps, so the
 * slug comes from the environment rather than being hardcoded.
 */
const SLUG = import.meta.env.VITE_GITHUB_APP_SLUG ?? "sphynx-development";

export const INSTALL_URL = `https://github.com/apps/${SLUG}/installations/new`;
