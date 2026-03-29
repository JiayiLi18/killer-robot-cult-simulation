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
  const robots = Object.values(state.robots)
  const aliveCount = robots.filter(r => r.status === 'alive').length
  const deadCount = robots.filter(r => r.status === 'dead').length
  const ejectedCount = robots.filter(r => r.status === 'ejected').length
  const killersAlive = state.totalKillers - state.killersFound

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2"
        style={{ background: 'rgba(6,6,14,0.78)', borderBottom: '1px solid rgba(80,60,140,0.3)' }}>

        {/* Phase badge */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded border tracking-widest ${ps.cls}`}>
          {ps.label}
        </span>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          {/* Tick */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Tick</span>
            <span className="text-sm font-mono font-bold text-gray-300 tabular-nums">{state.tick}</span>
          </div>

          {/* Grace period */}
          {state.gracePeriodRemaining > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-yellow-500 uppercase tracking-widest leading-none">Grace</span>
              <span className="text-sm font-mono font-bold text-yellow-300 tabular-nums">{fmt(state.gracePeriodRemaining)}</span>
            </div>
          )}

          {/* Next VoG */}
          {state.phase === 'playing' && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-purple-400 uppercase tracking-widest leading-none">Next VoG</span>
              <span className="text-sm font-mono font-bold text-purple-300 tabular-nums">{fmt(state.nextVogIn)}</span>
            </div>
          )}

          {/* VoG countdown during VoG phase */}
          {state.phase === 'vog' && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-purple-400 uppercase tracking-widest leading-none">VoG</span>
              <span className="text-sm font-mono font-bold text-purple-300 tabular-nums animate-pulse">{fmt(state.countdown)}</span>
            </div>
          )}

          {/* Alive count */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-green-500 uppercase tracking-widest leading-none">Alive</span>
            <span className="text-sm font-mono font-bold text-green-300 tabular-nums">{aliveCount}</span>
          </div>

          {/* Dead count */}
          {deadCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Dead</span>
              <span className="text-sm font-mono font-bold text-gray-400 tabular-nums">{deadCount}</span>
            </div>
          )}

          {/* Ejected count */}
          {ejectedCount > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-orange-500 uppercase tracking-widest leading-none">Ejected</span>
              <span className="text-sm font-mono font-bold text-orange-300 tabular-nums">{ejectedCount}</span>
            </div>
          )}

          {/* Killers alive */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-red-500 uppercase tracking-widest leading-none">Killers</span>
            <span className="text-sm font-mono font-bold text-red-400 tabular-nums">{killersAlive}</span>
          </div>

          {/* LLM cost */}
          {state.llmStats && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-cyan-500 uppercase tracking-widest leading-none">LLM</span>
              <span className="text-sm font-mono font-bold text-cyan-300 tabular-nums">${state.llmStats.estimatedCost.toFixed(4)}</span>
            </div>
          )}
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
