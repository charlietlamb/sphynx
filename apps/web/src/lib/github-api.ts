import { INSTALLATION_HEADER } from "@sphynx/schema/review-queue";

/**
 * Every read and write goes through the app's own routes. There is no anonymous
 * data path: signed-out visitors get the landing page, and every GitHub call is
 * made with an installation credential so it draws on the app's rate limit
 * rather than the anonymous 60/hour per-IP cap.
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
