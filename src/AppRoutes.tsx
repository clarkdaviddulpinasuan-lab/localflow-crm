import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { Skeleton } from '@/components/ui/Skeleton'

function Loader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-80" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-6">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function lazyPage(loader: () => Promise<{ default: ComponentType }>): ComponentType {
  const LazyComponent = lazy(loader)
  return () => (
    <Suspense fallback={<Loader />}>
      <LazyComponent />
    </Suspense>
  )
}

function namedPage<M extends { [K in N]: ComponentType }, N extends keyof M>(importFn: () => Promise<M>, name: N): ComponentType {
  return lazyPage(async () => ({ default: (await importFn())[name] }))
}

const OverviewPage = namedPage(() => import('@/pages/OverviewPage'), 'OverviewPage')
const CustomersPage = namedPage(() => import('@/pages/CustomersPage'), 'CustomersPage')
const CustomerProfilePage = namedPage(() => import('@/pages/CustomerProfilePage'), 'CustomerProfilePage')
const SegmentsPage = namedPage(() => import('@/pages/SegmentsPage'), 'SegmentsPage')
const TemplatesPage = namedPage(() => import('@/pages/TemplatesPage'), 'TemplatesPage')
const AvailabilityPage = namedPage(() => import('@/pages/AvailabilityPage'), 'AvailabilityPage')
const BookingsPage = namedPage(() => import('@/pages/BookingsPage'), 'BookingsPage')
const OrdersPage = namedPage(() => import('@/pages/OrdersPage'), 'OrdersPage')
const TasksPage = namedPage(() => import('@/pages/TasksPage'), 'TasksPage')
const CalendarPage = namedPage(() => import('@/pages/CalendarPage'), 'CalendarPage')
const LeadsPage = namedPage(() => import('@/pages/LeadsPage'), 'LeadsPage')
const ReportsPage = namedPage(() => import('@/pages/ReportsPage'), 'ReportsPage')
const AutomationPage = namedPage(() => import('@/pages/AutomationPage'), 'AutomationPage')
const TeamPage = namedPage(() => import('@/pages/TeamPage'), 'TeamPage')
const ProfilePage = namedPage(() => import('@/pages/ProfilePage'), 'ProfilePage')
const ActivityPage = namedPage(() => import('@/pages/ActivityPage'), 'ActivityPage')
const NotificationsPage = namedPage(() => import('@/pages/NotificationsPage'), 'NotificationsPage')
const BusinessProfilePage = namedPage(() => import('@/pages/BusinessProfilePage'), 'BusinessProfilePage')
const SettingsPage = namedPage(() => import('@/pages/SettingsPage'), 'SettingsPage')
const LoginPage = namedPage(() => import('@/pages/LoginPage'), 'LoginPage')
const SignupPage = namedPage(() => import('@/pages/SignupPage'), 'SignupPage')
const ForgotPasswordPage = namedPage(() => import('@/pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = namedPage(() => import('@/pages/ResetPasswordPage'), 'ResetPasswordPage')
const NotFoundPage = namedPage(() => import('@/pages/NotFoundPage'), 'NotFoundPage')

function routeElement(node: ReactNode) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<Loader />}>{node}</Suspense>
    </ProtectedRoute>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/" element={routeElement(<OverviewPage />)} />
      <Route path="/customers" element={routeElement(<CustomersPage />)} />
      <Route path="/customers/:id" element={routeElement(<CustomerProfilePage />)} />
      <Route path="/segments" element={routeElement(<SegmentsPage />)} />
      <Route path="/templates" element={routeElement(<TemplatesPage />)} />
      <Route path="/availability" element={routeElement(<AvailabilityPage />)} />
      <Route path="/bookings" element={routeElement(<BookingsPage />)} />
      <Route path="/orders" element={routeElement(<OrdersPage />)} />
      <Route path="/tasks" element={routeElement(<TasksPage />)} />
      <Route path="/calendar" element={routeElement(<CalendarPage />)} />
      <Route path="/leads" element={routeElement(<LeadsPage />)} />
      <Route path="/reports" element={routeElement(<ReportsPage />)} />
      <Route path="/automation" element={routeElement(<AutomationPage />)} />
      <Route path="/team" element={routeElement(<TeamPage />)} />
      <Route path="/profile" element={routeElement(<ProfilePage />)} />
      <Route path="/activity" element={routeElement(<ActivityPage />)} />
      <Route path="/notifications" element={routeElement(<NotificationsPage />)} />
      <Route path="/business" element={routeElement(<BusinessProfilePage />)} />
      <Route path="/settings" element={routeElement(<SettingsPage />)} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
