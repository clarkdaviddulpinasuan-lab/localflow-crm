import { describe, it, expect, beforeEach } from 'vitest'
import {
  listSavedViews,
  saveSavedView,
  deleteSavedView,
  loadSavedView,
  renameSavedView,
} from '@/services/savedViews'

const page = 'customers'

describe('saved views service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty per page', () => {
    expect(listSavedViews(page)).toEqual([])
  })

  it('saves and lists a view with its state', () => {
    saveSavedView(page, 'High spenders', { filters: { status: 'vip', type: 'corporate' }, viewId: 'table' })
    const views = listSavedViews(page)
    expect(views).toHaveLength(1)
    expect(views[0].name).toBe('High spenders')
    expect(views[0].state.filters).toEqual({ status: 'vip', type: 'corporate' })
    expect(loadSavedView(page, views[0].id)?.name).toBe('High spenders')
  })

  it('replaces a saved view with the same name', () => {
    saveSavedView(page, 'Name', { filters: { status: 'active' } })
    saveSavedView(page, 'Name', { filters: { status: 'vip' } })
    const views = listSavedViews(page)
    expect(views).toHaveLength(1)
    expect(views[0].state.filters.status).toBe('vip')
  })

  it('deletes a saved view', () => {
    saveSavedView(page, 'Temp', { filters: {} })
    const [view] = listSavedViews(page)
    deleteSavedView(page, view.id)
    expect(listSavedViews(page)).toEqual([])
  })

  it('renames a saved view', () => {
    saveSavedView(page, 'Old', { filters: {} })
    const [view] = listSavedViews(page)
    renameSavedView(page, view.id, 'New name')
    expect(listSavedViews(page)[0].name).toBe('New name')
  })

  it('keeps pages isolated', () => {
    saveSavedView('customers', 'Customer view', { filters: {} })
    expect(listSavedViews('orders')).toEqual([])
  })
})