"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorBoundaryProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      const { children: _c, fallback: _f, className, ...rest } = this.props
      return (
        <div data-slot="error-boundary" role="alert" className={cn("flex flex-col items-center justify-center py-16 text-muted-foreground", className)} {...rest}>
          <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
          <h2 className="text-lg font-medium text-foreground">页面出错了</h2>
          <p className="mt-1 max-w-md text-center text-sm">
            {this.state.error?.message ?? "发生了未知错误"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export { ErrorBoundary, type ErrorBoundaryProps }
