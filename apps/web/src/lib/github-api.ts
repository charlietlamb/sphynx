import { INSTALLATION_HEADER } from "@sphynx/schema/review-queue";

/**
 * Every authenticated read and write goes through the app's own routes. There
 * is no anonymous data path — signed-out visitors get the landing page, and
 * public pull-request pages use `/api/public/github` directly.
 */
const API_BASE = "/api/github";

/**
 * Reads are scoped to one GitHub App installation. Naming it here keeps the
 * server from re-discovering installations on every request.
 */
function installationHeaders(installationId: number | null) {
  return installationId === null
    ? undefined
    : { [INSTALLATION_HEADER]: `${installationId}` };
}

export async function fetchGithub(
  path: string,
  label: string,
  installationId: number | null = null
) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: installationHeaders(installationId),
  });
  if (!response.ok) {
    throw new Error(`${label} unavailable (${response.status})`);
  }
  return response;
}
