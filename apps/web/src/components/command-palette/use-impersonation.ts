import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useDebounced } from "@/lib/use-debounced";

interface ImpersonationUser {
  email: string;
  id: string;
  image?: string | null;
  name: string;
}

interface ImpersonationInput {
  active: boolean;
  impersonatedBy?: string | null;
  query: string;
  userId?: string;
}

async function searchUsers(searchValue: string, userId: string) {
  const search = (searchField: "email" | "name") =>
    authClient.admin.listUsers({
      query: {
        limit: 10,
        searchField,
        searchOperator: "contains",
        searchValue,
      },
    });
  const results = await Promise.all([search("name"), search("email")]);
  const users = new Map<string, ImpersonationUser>();
  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
    for (const user of result.data?.users ?? []) {
      if (user.id !== userId && user.role !== "admin") {
        users.set(user.id, {
          email: user.email,
          id: user.id,
          image: user.image,
          name: user.name,
        });
      }
    }
  }
  return [...users.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10);
}

function reload() {
  window.location.assign("/");
}

export function useImpersonation({
  active,
  impersonatedBy,
  query,
  userId,
}: ImpersonationInput) {
  const isImpersonating = Boolean(impersonatedBy);
  const debouncedQuery = useDebounced(query.trim(), 200);
  const permission = useQuery({
    enabled: active && Boolean(userId) && !isImpersonating,
    queryFn: async () => {
      const result = await authClient.admin.hasPermission({
        permissions: { user: ["impersonate"] },
      });
      return result.data?.success === true;
    },
    queryKey: ["auth", "can-impersonate", userId],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const users = useQuery({
    enabled:
      active &&
      permission.data === true &&
      Boolean(userId) &&
      debouncedQuery.length >= 2,
    queryFn: () => searchUsers(debouncedQuery, userId ?? ""),
    queryKey: ["auth", "impersonation-users", debouncedQuery],
    retry: false,
  });
  const start = useMutation({
    mutationFn: async (targetUserId: string) => {
      const result = await authClient.admin.impersonateUser({
        userId: targetUserId,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: reload,
  });
  const stop = useMutation({
    mutationFn: async () => {
      const result = await authClient.admin.stopImpersonating();
      if (result.error) {
        throw new Error(result.error.message);
      }
    },
    onError: (error) => toast.error(error.message),
    onSuccess: reload,
  });

  let emptyMessage = "No users found.";
  if (query.trim().length < 2) {
    emptyMessage = "Type at least 2 characters.";
  } else if (users.isFetching) {
    emptyMessage = "Searching users…";
  } else if (users.isError) {
    emptyMessage = "Could not search users.";
  }

  return {
    canImpersonate: permission.data === true,
    emptyMessage,
    isImpersonating,
    start: start.mutate,
    stop: stop.mutate,
    users: users.data ?? [],
  };
}
