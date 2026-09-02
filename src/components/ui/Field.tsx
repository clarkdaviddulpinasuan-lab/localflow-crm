import { cn } from '@/lib/cn'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

interface FieldWrapperProps {
  label?: string
  error?: string
  required?: boolean
  children: ReactNode
  hint?: string
  id?: string
}

export function FieldWrapper({ label, error, required, children, hint, id }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-surface-700">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  )
}

const baseInputStyles = cn(
  'w-full h-9 px-3 text-sm rounded-lg border border-surface-200 bg-white',
  'placeholder:text-surface-400 text-surface-900',
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
  'transition-colors duration-150 disabled:opacity-50 disabled:bg-surface-50'
)

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, required, hint, id, className, ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} required={required} hint={hint} id={id}>
      <input
        id={id}
        className={cn(baseInputStyles, error && 'border-danger-400 focus:ring-danger-500 focus:border-danger-400', className)}
        required={required}
        {...props}
      />
    </FieldWrapper>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, required, hint, id, className, options, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error} required={required} hint={hint} id={id}>
      <select
        id={id}
        className={cn(baseInputStyles, 'cursor-pointer', error && 'border-danger-400 focus:ring-danger-500', className)}
        required={required}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, required, hint, id, className, ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} required={required} hint={hint} id={id}>
      <textarea
        id={id}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border border-surface-200 bg-white',
          'placeholder:text-surface-400 text-surface-900',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          'transition-colors duration-150 disabled:opacity-50 disabled:bg-surface-50',
          error && 'border-danger-400 focus:ring-danger-500',
          className
        )}
        required={required}
        {...props}
      />
    </FieldWrapper>
  )
}
