import { nextId } from '@/services/demoStore'

export type SavedViewPage = 'customers' | 'orders' | 'leads' | 'tasks'

export interface SavedViewState {
  filters: Record<string, unknown>
  /** Optional page-specific mode, e.g. 'board' vs 'list' / 'pipeline' vs 'table'. */
  viewId?: string
}

export interface SavedView {
  id: string
  page: SavedViewPage
  name: string
  state: SavedViewState
  createdAt: string
}

const KEY_PREFIX = 'localflow:crm:saved-views:'

export function savedViewsKey(page: SavedViewPage): string {
  return KEY_PREFIX + page
}

export function listSavedViews(page: SavedViewPage): SavedView[] {
  try {
    const raw = localStorage.getItem(savedViewsKey(page))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedView[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(page: SavedViewPage, views: SavedView[]) {
  try {
    localStorage.setItem(savedViewsKey(page), JSON.stringify(views))
  } catch {
    // storage may be unavailable (private mode)
  }
}

export function saveSavedView(
  page: SavedViewPage,
  name: string,
  state: SavedViewState
): SavedView {
  const view: SavedView = {
    id: nextId('view'),
    page,
    name: name.trim() || 'Untitled view',
    state,
    createdAt: new Date().toISOString(),
  }
  const views = listSavedViews(page).filter((v) => v.name !== view.name)
  views.push(view)
  persist(page, views)
  return view
}

export function deleteSavedView(page: SavedViewPage, id: string): void {
  persist(page, listSavedViews(page).filter((v) => v.id !== id))
}

export function loadSavedView(page: SavedViewPage, id: string): SavedView | null {
  return listSavedViews(page).find((v) => v.id === id) ?? null
}

export function renameSavedView(page: SavedViewPage, id: string, name: string): SavedView | null {
  let updated: SavedView | null = null
  const views = listSavedViews(page).map((v) => {
    if (v.id !== id) return v
    const next = { ...v, name: name.trim() || v.name }
    updated = next
    return next
  })
  if (updated) persist(page, views)
  return updated
}