import { useState, type FormEvent } from 'react'

interface JoinFormProps {
  onJoin: (name: string) => void
}

export function JoinForm({ onJoin }: JoinFormProps) {
  const [name, setName] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      onJoin(trimmed)
      setName('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xs">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your god name..."
        maxLength={20}
        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-accent-cyan transition-colors"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg font-mono text-sm hover:bg-accent-cyan/30 transition-colors disabled:opacity-30"
      >
        Join
      </button>
    </form>
  )
}
