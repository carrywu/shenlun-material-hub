import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps extends React.ComponentProps<"div"> {
  lines?: number
  className?: string
}

function LoadingSkeleton({ lines = 3, className, ...props }: LoadingSkeletonProps) {
  return (
    <div
      data-slot="loading-skeleton"
      role="status"
      aria-label="加载中"
      className={cn("space-y-3", className)}
      {...props}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-md bg-muted"
          style={{ width: `${Math.max(20, 85 - i * 10)}%` }}
        />
      ))}
    </div>
  )
}

interface LoadingIndicatorProps extends React.ComponentProps<"div"> {
  text?: string
  className?: string
}

function LoadingIndicator({ text = "加载中...", className, ...props }: LoadingIndicatorProps) {
  return (
    <div
      data-slot="loading-indicator"
      role="status"
      aria-label={text}
      className={cn("flex items-center justify-center py-12 text-muted-foreground", className)}
      {...props}
    >
      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export { LoadingSkeleton, LoadingIndicator }
