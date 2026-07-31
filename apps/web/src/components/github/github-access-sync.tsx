import { useInstallations } from "@/components/dashboard/use-installations";

export function GitHubAccessSync() {
  useInstallations(null, true);
  return null;
}
