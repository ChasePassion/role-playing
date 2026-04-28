import { useQuery } from "@tanstack/react-query";
import { getMyEntitlements } from "@/lib/api";
import { queryKeys } from "./query-keys";

export function useUserEntitlementsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.auth.entitlements(userId),
    queryFn: ({ signal }) => getMyEntitlements({ signal }),
    enabled: Boolean(userId),
  });
}
