import { useState } from 'react'
import { Robot } from '../types'
import { GameActions } from '../hooks/useGameState'

interface Props {
  robot: Robot
  roomName: string
  actions: GameActions
  onClose: () => void
}

const STATUS_STYLE = {
  alive:   { dot: 'bg-green-400',  text: 'text-green-300',  label: 'Alive' },
  dead:    { dot: 'bg-gray-500',   text: 'text-gray-400',   label: 'Dead' },
  ejected: { dot: 'bg-orange-400', text: 'text-orange-300', label: 'Ejected' },
}

export function RobotInfoPanel({ robot, roomName, actions, onClose }: Props) {
  const [whispering, setWhispering] = useState(false)
  const [input, setInput] = useState('')

  const words = input.trim().split(/\s+/).filter(Boolean)
  const isValid = words.length === 3

  const submitWhisper = () => {
    if (!isValid) return
    actions.appendBeliefs(robot.id, words.join(' '))
    setInput('')
    setWhispering(false)
  }

  const st = STATUS_STYLE[robot.status]

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100vw-16px)] rounded-t-2xl shadow-2xl z-50"
      style={{ background: 'rgba(8,6,20,0.97)', border: '1px solid rgba(100,80,200,0.35)', borderBottom: 'none' }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-8 h-1 rounded-full bg-gray-700" />
      </div>

      {/* Header: avatar + name + close */}
      <div className="flex items-start gap-3 px-4 pt-1 pb-3">
        <img
          src={robot.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${robot.id}`}
          alt={robot.name}
          className="w-14 h-14 rounded-xl border-2 bg-gray-800 object-cover shrink-0"
          style={{ borderColor: 'rgba(120,90,220,0.5)' }}
        />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-1">
            <div>
              <div className="text-base font-bold text-white leading-tight">
                {robot.look} {robot.name}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{robot.identity}</div>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-white mt-0.5 shrink-0 text-lg leading-none">✕</button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 text-xs font-bold ${st.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-gray-400 text-xs">{roomName}</span>
          </div>
        </div>
      </div>

      {/* Beliefs */}
      {robot.beliefs && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-xs text-purple-200 leading-relaxed"
          style={{ background: 'rgba(60,20,100,0.4)', border: '1px solid rgba(120,60,200,0.25)' }}>
          <span className="text-purple-500 font-bold text-xs mr-1">beliefs</span>
          {robot.beliefs}
        </div>
      )}

      {/* Whisper section */}
      <div className="px-4 pb-4">
        {!whispering ? (
          <button
            onClick={() => setWhispering(true)}
            disabled={robot.status !== 'alive'}
            className="w-full py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: robot.status === 'alive' ? 'rgba(100,40,200,0.7)' : 'rgba(40,30,60,0.5)',
              color: robot.status === 'alive' ? '#d4b0ff' : '#504060',
              cursor: robot.status === 'alive' ? 'pointer' : 'not-allowed',
            }}
          >
            ✦ Whisper of God
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Enter exactly 3 words → appended to beliefs</p>
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitWhisper(); if (e.key === 'Escape') setWhispering(false) }}
              placeholder="e.g.  trust the door"
              className="w-full bg-gray-900 border border-purple-900 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-purple-500 transition-colors"
            />
            <div className="flex gap-1.5 flex-wrap min-h-[22px]">
              {words.map((w, i) => (
                <span key={i} className="text-xs bg-purple-950 border border-purple-700 text-purple-200 px-2 py-0.5 rounded-full">{w}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={submitWhisper} disabled={!isValid}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: isValid ? 'rgba(100,40,200,0.85)' : 'rgba(40,30,60,0.5)',
                  color: isValid ? '#d4b0ff' : '#504060',
                }}>
                Whisper ({words.length}/3)
              </button>
              <button onClick={() => setWhispering(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white bg-gray-900 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
