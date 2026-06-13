import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  lines?: number
  className?: string
}

export function LoadingSkeleton({ lines = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-md bg-muted"
          style={{ width: `${85 - i * 10}%` }}
        />
      ))}
    </div>
  )
}

interface LoadingIndicatorProps {
  text?: string
  className?: string
}

export function LoadingIndicator({ text = "加载中...", className }: LoadingIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center py-12 text-muted-foreground", className)}>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}
