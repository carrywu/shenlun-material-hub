import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  helper?: string
  className?: string
  children: React.ReactNode
}

function FormField({ label, error, required, helper, className, children }: FormFieldProps) {
  return (
    <div data-slot="form-field" className={cn("space-y-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {helper && !error && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

export { FormField, type FormFieldProps }
