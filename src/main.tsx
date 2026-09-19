import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { queryClient } from './lib/queryClient'
import { prefetchInitialData } from './lib/prefetch'

// Persists the React Query cache to localStorage so re-opening the app shows
// the last-known data instantly (no blank/loading state behind the intro
// splash) while a background refetch quietly brings it up to date. Bump
// `buster` if a migration changes a cached table's shape enough that old
// persisted entries could break the UI.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'enzopack-query-cache',
})

prefetchInitialData(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: 'v2',
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
