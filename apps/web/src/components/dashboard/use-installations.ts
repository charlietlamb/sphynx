import {
  type Installation,
  InstallationsSchema,
} from "@sphynx/schema/review-queue";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { fetchGithub } from "@/lib/github-api";

async function fetchInstallations() {
  const response = await fetchGithub("/installations", "installations");
  return await Schema.decodeUnknownPromise(InstallationsSchema)(
    await response.json()
  );
}

function installationsQuery() {
  return queryOptions({
    queryKey: ["installations"],
    queryFn: fetchInstallations,
    staleTime: 5 * 60_000,
  });
}

export function useInstallations(selected: number | null, enabled: boolean) {
  const server = useQuery({ ...installationsQuery(), enabled });
  const installations: readonly Installation[] =
    server.data?.installations ?? [];

  return {
    active:
      installations.find((entry) => entry.id === selected) ??
      installations[0] ??
      null,
    installations,
    isError: server.isError,
    isPending: server.isPending,
  };
}
