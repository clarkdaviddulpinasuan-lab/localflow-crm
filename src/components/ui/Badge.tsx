import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

const variantStyles = {
  default: 'bg-surface-100 text-surface-700',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-info-100 text-info-700',
}

const dotStyles = {
  default: 'bg-surface-500',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[variant])} />
      )}
      {children}
    </span>
  )
}

export function getStatusBadge(status: string): { variant: BadgeProps['variant']; label: string } {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    new: { variant: 'info', label: 'New' },
    active: { variant: 'success', label: 'Active' },
    vip: { variant: 'warning', label: 'VIP' },
    inactive: { variant: 'default', label: 'Inactive' },
    pending: { variant: 'warning', label: 'Pending' },
    confirmed: { variant: 'primary', label: 'Confirmed' },
    checked_in: { variant: 'info', label: 'Checked In' },
    completed: { variant: 'success', label: 'Completed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    no_show: { variant: 'danger', label: 'No-show' },
    paid: { variant: 'success', label: 'Paid' },
    partial: { variant: 'warning', label: 'Partial' },
    refunded: { variant: 'info', label: 'Refunded' },
    processing: { variant: 'primary', label: 'Processing' },
    todo: { variant: 'default', label: 'To Do' },
    in_progress: { variant: 'primary', label: 'In Progress' },
    waiting: { variant: 'warning', label: 'Waiting' },
    low: { variant: 'default', label: 'Low' },
    medium: { variant: 'info', label: 'Medium' },
    high: { variant: 'warning', label: 'High' },
    urgent: { variant: 'danger', label: 'Urgent' },
    contacted: { variant: 'info', label: 'Contacted' },
    qualified: { variant: 'primary', label: 'Qualified' },
    proposal: { variant: 'warning', label: 'Proposal' },
    won: { variant: 'success', label: 'Won' },
    lost: { variant: 'danger', label: 'Lost' },
  }
  return map[status] || { variant: 'default', label: status }
}
