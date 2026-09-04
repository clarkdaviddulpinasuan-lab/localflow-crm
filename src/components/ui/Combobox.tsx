import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { rankMatches } from '@/utils/searchMatch'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  emptyMessage?: string
  className?: string
}

export function Combobox({ id, value, onChange, options, placeholder, emptyMessage, className }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)
  const ranked = rankMatches(options, query, (o) => o.label)
  const filtered = query.trim() ? ranked.map((r) => r.item) : options

  function handleSelect(option: ComboboxOption) {
    onChange(option.value)
    setOpen(false)
    setQuery('')
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : -1))
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault()
        handleSelect(filtered[activeIndex])
      } else {
        setOpen(false)
      }
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        value={open ? query : selected ? selected.label : ''}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full h-9 px-3 pr-9 text-sm rounded-lg border border-surface-200 bg-white',
          'placeholder:text-surface-400 text-surface-900',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          'transition-colors duration-150'
        )}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-surface-200 bg-white shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-surface-400">{emptyMessage ?? 'No options'}</li>
          ) : (
            filtered.map((o, index) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(o)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer',
                  index === activeIndex ? 'bg-primary-50 text-primary-700' : 'hover:bg-primary-50',
                  o.value === value && 'font-medium'
                )}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
