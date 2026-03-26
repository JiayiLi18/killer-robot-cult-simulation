import { useState, useCallback, type KeyboardEvent } from 'react'

interface ThreeWordInputProps {
  onSubmit: (words: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ThreeWordInput({ onSubmit, placeholder = 'Enter 3 words...', disabled = false }: ThreeWordInputProps) {
  const [value, setValue] = useState('')
  const [shaking, setShaking] = useState(false)

  const words = value.trim().split(/\s+/).filter(Boolean)
  const wordCount = value.trim() === '' ? 0 : words.length
  const isValid = wordCount === 3 && words.every((w) => w.length <= 30)
  const isTooMany = wordCount > 3

  const handleSubmit = useCallback(() => {
    if (isValid) {
      onSubmit(words.join(' '))
      setValue('')
    } else {
      setShaking(true)
      setTimeout(() => setShaking(false), 300)
    }
  }, [isValid, words, onSubmit])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleSubmit()
    }
  }

  const borderColor = value.trim() === ''
    ? 'border-gray-600'
    : isValid
      ? 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
      : isTooMany
        ? 'border-red-500'
        : 'border-gray-500'

  return (
    <div className={`flex flex-col gap-2 ${shaking ? 'animate-shake' : ''}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={94}
          className={`w-full px-3 py-2 bg-gray-900 border ${borderColor} rounded-lg text-white font-mono text-sm outline-none transition-all duration-200 disabled:opacity-50`}
        />
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono ${
            isValid ? 'text-emerald-400' : isTooMany ? 'text-red-400' : 'text-gray-500'
          }`}
        >
          {wordCount}/3
        </span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!isValid || disabled}
        className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg font-mono text-sm hover:bg-accent-cyan/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </div>
  )
}
