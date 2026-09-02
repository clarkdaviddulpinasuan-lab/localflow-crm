import {
  demoBusiness,
  demoProfile,
  demoTeam,
  demoCustomers,
  demoBookings,
  demoOrders,
  demoTasks,
  demoLeads,
  demoActivities,
  demoNotifications,
  demoSettings,
  demoFollowUps,
  demoMessageTemplates,
  demoCommunications,
} from '@/data/demo'
import type {
  Business,
  Profile,
  Customer,
  Booking,
  Order,
  Task,
  Lead,
  Activity,
  Notification,
  BusinessSettings,
  FollowUp,
  MessageTemplate,
  Communication,
} from '@/types'

const STORAGE_KEY = 'localflow:crm:demo:v1'

interface DemoStore {
  business: Business
  profile: Profile
  team: Profile[]
  customers: Customer[]
  bookings: Booking[]
  orders: Order[]
  tasks: Task[]
  leads: Lead[]
  activities: Activity[]
  notifications: Notification[]
  settings: BusinessSettings[]
  followUps: FollowUp[]
  messageTemplates: MessageTemplate[]
  communications: Communication[]
}

function initialState(): DemoStore {
  return {
    business: demoBusiness,
    profile: demoProfile,
    team: demoTeam,
    customers: demoCustomers,
    bookings: demoBookings,
    orders: demoOrders,
    tasks: demoTasks,
    leads: demoLeads,
    activities: demoActivities,
    notifications: demoNotifications,
    settings: demoSettings,
    followUps: demoFollowUps,
    messageTemplates: demoMessageTemplates,
    communications: demoCommunications,
  }
}

let cache: DemoStore | null = null

function load(): DemoStore {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoStore>
      cache = { ...initialState(), ...parsed, settings: parsed.settings ?? demoSettings, followUps: parsed.followUps ?? demoFollowUps, messageTemplates: parsed.messageTemplates ?? demoMessageTemplates, communications: parsed.communications ?? demoCommunications }
      return cache!
    }
  } catch {
    // ignore corrupted storage
  }
  cache = initialState()
  return cache
}

function persist(state: DemoStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be unavailable (private mode)
  }
}

export function getStore(): DemoStore {
  return load()
}

export function updateStore(mutator: (state: DemoStore) => void) {
  const state = load()
  mutator(state)
  persist(state)
}

export function resetStore() {
  cache = initialState()
  persist(cache)
}

export type { DemoStore }

// Generators for stable IDs in demo mode
let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}
