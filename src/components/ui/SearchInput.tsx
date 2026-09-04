import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { rankMatches } from '@/utils/searchMatch'
import { Spinner } from '@/components/ui/Spinner'

interface SearchInputProps<T> {
  /** Committed search term shown in the box. */
  value: string
  /** Called whenever the committed term changes (typing or selection). */
  onChange: (value: string) => void
  /** Full dataset used to build suggestions. */
  items: T[]
  /** Returns the text to display for a suggestion row. */
  getLabel: (item: T) => string
  /** Returns the text to match against for the query (defaults to getLabel). */
  getMatchText?: (item: T) => string
  /** Called when the user picks a suggestion. */
  onSelect?: (item: T) => void
  /** Optional secondary line rendered under the label. */
  getSubLabel?: (item: T) => string | undefined
  placeholder?: string
  loading?: boolean
  noResultsMessage?: string
  className?: string
}

export function SearchInput<T>({
  value,
  onChange,
  items,
  getLabel,
  getMatchText,
  onSelect,
  getSubLabel,
  placeholder,
  loading,
  noResultsMessage = 'No results found',
  className,
}: SearchInputProps<T>) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the local query in sync when the committed value changes externally.
  useEffect(() => {
    setQuery(value)
  }, [value])

  const matchText = (item: T) => (getMatchText ? getMatchText(item) : getLabel(item))
  const matches = rankMatches(items, query, matchText)

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function commit(next: string) {
    onChange(next)
    setQuery(next)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (matches.length ? (i + 1) % matches.length : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (matches.length ? (i - 1 + matches.length) % matches.length : -1))
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && matches[activeIndex]) {
        e.preventDefault()
        select(matches[activeIndex].item)
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  function select(item: T) {
    const label = getLabel(item)
    commit(label)
    onSelect?.(item)
    setOpen(false)
    setActiveIndex(-1)
  }

  const showDropdown = open && (query.trim().length > 0 || matches.length > 0)

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
        <Search className="h-4 w-4" />
      </span>
      <input
        ref={inputRef}
        type="text"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-9 text-sm rounded-lg border border-surface-200 bg-surface-50 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
      />
      {loading ? (
        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400">
          <Spinner size="sm" />
        </span>
      ) : query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('')
            onChange('')
            inputRef.current?.focus()
            setOpen(false)
            setActiveIndex(-1)
          }}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-surface-200 bg-white shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-surface-400">{noResultsMessage}</li>
          ) : (
            matches.map(({ item }, index) => (
              <li
                key={index}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(item)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer',
                  index === activeIndex ? 'bg-primary-50 text-primary-700' : 'text-surface-700'
                )}
              >
                {getLabel(item)}
                {getSubLabel && getSubLabel(item) && (
                  <span className="block text-xs text-surface-400">{getSubLabel(item)}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
