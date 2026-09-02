import { useBusiness } from '@/contexts/BusinessContext'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'

interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { terminology } = useBusiness()

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          description ??
          `Coming soon — ${terminology.mainEntity} functionality will be available in the next phase.`
        }
      />
      <Card>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-full bg-surface-100 flex items-center justify-center mb-4">
            <span className="h-5 w-5 rounded-full border-2 border-surface-300" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 mb-1">Module under construction</h3>
          <p className="text-sm text-surface-500 max-w-sm">
            {title} is part of the roadmap and will be completed in an upcoming phase.
          </p>
        </div>
      </Card>
    </div>
  )
}
