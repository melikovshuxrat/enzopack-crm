import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep cached data around long enough to be useful across a full
      // localStorage-persisted session (see main.tsx), not just the default 5 min.
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  },
})
