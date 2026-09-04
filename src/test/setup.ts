import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Every service talks to Supabase now that demo mode is gone. Route all
// imports of @/lib/supabase to the in-memory mock so tests stay deterministic
// without a live project.
vi.mock('@/lib/supabase', async () => {
  const mod = await import('@/test/supabaseMock')
  return { supabase: mod.supabaseMock }
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
