import { useState } from 'react'
import { Robot } from '../types'
import { GameActions } from '../hooks/useGameState'
import { ThreeWordInput } from '../god-ui/components/shared/ThreeWordInput'

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

interface WhisperEntry {
  words: string
  timestamp: number
}

export function RobotInfoPanel({ robot, roomName, actions, onClose }: Props) {
  const [whispering, setWhispering] = useState(false)
  const [recentWhispers, setRecentWhispers] = useState<WhisperEntry[]>([])

  const submitWhisper = (words: string) => {
    actions.whisper(robot.id, words)
    setRecentWhispers(prev => [{ words, timestamp: Date.now() }, ...prev].slice(0, 10))
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
            <ThreeWordInput
              onSubmit={submitWhisper}
              placeholder="e.g. trust the door"
            />
            <button
              onClick={() => setWhispering(false)}
              className="w-full py-1.5 rounded-lg text-xs text-gray-500 hover:text-white bg-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Recent whispers feed */}
        {recentWhispers.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-24 overflow-y-auto">
            <p className="text-xs text-gray-600 font-mono uppercase tracking-wider">Recent Whispers</p>
            {recentWhispers.map((w, i) => (
              <div key={i} className="text-xs text-purple-300 font-mono px-2 py-1 rounded bg-purple-950/40 border border-purple-900/30"
                style={{ animation: 'fadeIn 0.3s ease-out' }}>
                "{w.words}"
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
