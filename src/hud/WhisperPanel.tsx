import { useState, useEffect, useRef } from 'react'
import { Robot } from '../types'

interface Props {
  robot: Robot
  screenX: number
  screenY: number
  onWhisper: (robotId: string, text: string) => void  // appends to beliefs
  onClose: () => void
}

export function WhisperPanel({ robot, screenX, screenY, onWhisper, onClose }: Props) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const words = input.trim().split(/\s+/).filter(Boolean).slice(0, 3)
  const isValid = words.length === 3

  const submit = () => {
    if (!isValid) return
    onWhisper(robot.id, words.join(' '))
    onClose()
  }

  const panelW = 250
  const panelH = 190
  const left = Math.min(screenX - panelW / 2, window.innerWidth - panelW - 8)
  const top  = Math.max(8, screenY - panelH - 40)

  return (
    <>
      <div className="absolute inset-0" onClick={onClose} style={{ zIndex: 300 }} />
      <div
        className="absolute rounded-xl shadow-2xl"
        style={{
          left, top, width: panelW, zIndex: 301,
          background: 'rgba(8,6,20,0.97)',
          border: '1px solid rgba(140,80,255,0.45)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-bold text-purple-300 tracking-widest uppercase">✦ Whisper of God</span>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-sm">✕</button>
        </div>

        {/* Robot info */}
        <div className="px-3 pb-2 flex items-center gap-3">
          {robot.imageUrl && (
            <img src={robot.imageUrl} alt={robot.name}
              className="w-10 h-10 rounded-full border border-purple-800 object-cover bg-gray-800" />
          )}
          <div>
            <div className="text-sm font-bold text-white">{robot.look} {robot.name}</div>
            <div className="text-xs text-gray-400">{robot.identity}</div>
          </div>
        </div>

        {/* Current beliefs preview */}
        {robot.beliefs && (
          <div className="mx-3 mb-2 px-2 py-1 rounded bg-gray-900 text-xs text-gray-400 italic truncate">
            {robot.beliefs}
          </div>
        )}

        <div className="h-px bg-purple-900 mx-3 mb-2 opacity-40" />

        {/* Input */}
        <div className="px-3 pb-1">
          <p className="text-xs text-gray-500 mb-1">3 words → appended to beliefs</p>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
            placeholder="e.g.  trust the door"
            className="w-full bg-gray-900 border border-purple-900 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-700 outline-none focus:border-purple-500 transition-colors"
          />
          <div className="flex gap-1 mt-1.5 min-h-[18px]">
            {words.map((w, i) => (
              <span key={i} className="text-xs bg-purple-950 border border-purple-700 text-purple-200 px-2 py-0.5 rounded-full">{w}</span>
            ))}
          </div>
        </div>

        <div className="px-3 pb-3 pt-1">
          <button
            onClick={submit}
            disabled={!isValid}
            className="w-full py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: isValid ? 'rgba(120,50,220,0.85)' : 'rgba(50,30,70,0.5)',
              color: isValid ? '#e0c0ff' : '#705080',
              cursor: isValid ? 'pointer' : 'default',
            }}
          >
            Whisper ({words.length}/3 words)
          </button>
        </div>
      </div>
    </>
  )
}
