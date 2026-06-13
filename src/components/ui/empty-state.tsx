import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 opacity-50" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" className="mt-3" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
