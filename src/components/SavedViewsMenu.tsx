import { useEffect, useRef, useState } from 'react'
import { Bookmark, Check, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  listSavedViews,
  saveSavedView,
  deleteSavedView,
  type SavedViewPage,
  type SavedViewState,
  type SavedView,
} from '@/services/savedViews'

interface SavedViewsMenuProps {
  page: SavedViewPage
  state: SavedViewState
  onApply: (state: SavedViewState) => void
  disabled?: boolean
}

export function SavedViewsMenu({ page, state, onApply, disabled }: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const [name, setName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setViews(listSavedViews(page))
      setName('')
    }
  }, [open, page])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const saveCurrent = () => {
    const created = saveSavedView(page, name, state)
    setViews(listSavedViews(page))
    setActiveId(created.id)
    setName('')
    inputRef.current?.focus()
  }

  const remove = (id: string) => {
    deleteSavedView(page, id)
    setViews(listSavedViews(page))
    if (activeId === id) setActiveId(null)
  }

  const apply = (view: SavedView) => {
    setActiveId(view.id)
    onApply(view.state)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" icon={<Bookmark className="h-4 w-4" />} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        Views
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-surface-200 bg-white p-3 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Saved views</p>
            {views.length === 0 ? (
              <p className="text-sm text-surface-500 py-1">No saved views yet.</p>
            ) : (
              <ul className="space-y-1 mb-3">
                {views.map((v) => (
                  <li key={v.id}>
                    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-50">
                      <button
                        type="button"
                        onClick={() => apply(v)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-100 text-surface-500">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate text-sm text-surface-700">{v.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(v.id)}
                        aria-label={`Delete view ${v.name}`}
                        className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-surface-400 hover:bg-danger-50 hover:text-danger-600 group-hover:flex"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-surface-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Save current view</p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCurrent()
                  }}
                  placeholder="e.g. High-value buyers"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-surface-200 bg-surface-50 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={saveCurrent} disabled={!name.trim()}>
                  Save
                </Button>
              </div>
            </div>

            {activeId && (
              <p className="mt-2 text-xs text-surface-400">Applying the active view shows its saved filters.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export { listSavedViews }
export type { SavedViewPage, SavedViewState }