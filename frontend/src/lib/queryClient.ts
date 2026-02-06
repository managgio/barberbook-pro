import { QueryClient } from "@tanstack/react-query";
import { isApiRequestError } from "@/lib/networkErrors";

const shouldRetry = (failureCount: number, error: unknown) => {
  if (failureCount >= 2) return false;

  if (isApiRequestError(error)) {
    if (error.kind === "OFFLINE" || error.kind === "ABORTED") return false;
    if ([400, 401, 403, 404].includes(error.status)) return false;
    if (error.kind === "TIMEOUT" || error.kind === "NETWORK") return true;
    if (error.status >= 500) return true;
  }

  return true;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: shouldRetry,
    },
    mutations: {
      retry: 0,
    },
  },
});
