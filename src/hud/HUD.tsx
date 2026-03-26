import { GameState } from '../types'

interface Props { state: GameState }

const PHASE_STYLE: Record<GameState['phase'], { label: string; cls: string }> = {
  lobby:   { label: 'LOBBY',        cls: 'bg-blue-950 text-blue-300 border-blue-800' },
  setup:   { label: 'SETUP',        cls: 'bg-yellow-950 text-yellow-300 border-yellow-800' },
  playing: { label: 'PLAYING',      cls: 'bg-green-950 text-green-300 border-green-800' },
  vog:     { label: 'VOICE OF GOD', cls: 'bg-purple-950 text-purple-200 border-purple-700' },
  council: { label: 'COUNCIL',      cls: 'bg-red-950 text-red-300 border-red-800' },
  ended:   { label: 'GAME OVER',    cls: 'bg-gray-900 text-gray-300 border-gray-700' },
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function HUD({ state }: Props) {
  const ps = PHASE_STYLE[state.phase]
  const isUrgent = state.countdown <= 10

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2"
        style={{ background: 'rgba(6,6,14,0.78)', borderBottom: '1px solid rgba(80,60,140,0.3)' }}>

        {/* Phase badge */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded border tracking-widest ${ps.cls}`}>
          {ps.label}
        </span>

        {/* VoG countdown — center */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-500 uppercase tracking-widest leading-none mb-0.5">
            Next VoG
          </span>
          <span className={`text-xl font-mono font-bold tabular-nums leading-none ${
            isUrgent ? 'text-purple-400 animate-pulse' : 'text-gray-200'
          }`}>
            {fmt(state.countdown)}
          </span>
        </div>

        {/* Killers found */}
        <div className="flex items-center gap-1">
          {Array.from({ length: state.totalKillers }).map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-colors ${
              i < state.killersFound ? 'bg-red-500 border-red-300' : 'bg-transparent border-gray-700'
            }`} />
          ))}
        </div>
      </div>

      {/* VoG full-screen overlay */}
      {state.phase === 'vog' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(30,0,60,0.55)' }}>
          <div className="text-center">
            <div className="text-5xl font-bold text-purple-200 tracking-widest animate-pulse drop-shadow-lg">
              ✦ VOICE OF GOD ✦
            </div>
            <div className="text-sm text-purple-400 mt-2 tracking-widest">The gods are watching…</div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'ended' && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="text-5xl font-bold text-white tracking-widest">GAME OVER</div>
        </div>
      )}

      {/* Council cooldown bar */}
      {state.councilCooldown > 0 && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5"
          style={{ background: 'rgba(6,6,14,0.85)', borderTop: '1px solid rgba(160,40,40,0.3)' }}>
          <span className="text-xs font-bold text-red-500 uppercase tracking-wider shrink-0">Council CD</span>
          <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-600 transition-all duration-1000"
              style={{ width: `${Math.min(100, (state.councilCooldown / 60) * 100)}%` }} />
          </div>
          <span className="text-xs text-red-400 font-mono tabular-nums shrink-0">{state.councilCooldown}s</span>
        </div>
      )}
    </div>
  )
}
