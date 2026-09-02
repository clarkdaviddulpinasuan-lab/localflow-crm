import type { ReactNode } from 'react'

export function ChartContainer({ children, height = 280 }: { children: ReactNode; height?: number }) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      {children}
    </div>
  )
}
