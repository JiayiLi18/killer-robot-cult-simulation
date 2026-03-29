import { Overlay } from './shared/Overlay'
import type { GameSummary } from '../../types'

interface EndingScreenProps {
  killersFound: number
  totalKillers: number
  summary?: GameSummary
  onPlayAgain: () => void
}

function fmt(ticks: number) {
  const m = Math.floor(ticks / 60)
  const s = ticks % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function EndingScreen({ killersFound, totalKillers, summary, onPlayAgain }: EndingScreenProps) {
  const isCrewWin = summary ? summary.winner === 'crew' : killersFound >= totalKillers

  return (
    <Overlay visible={true}>
      <div className="bg-surface border border-gray-700 rounded-xl p-6 max-h-[90vh] overflow-y-auto max-w-lg mx-auto">
        <h1
          className={`text-3xl font-mono font-bold mb-4 text-center ${
            isCrewWin ? 'text-accent-cyan' : 'text-accent-red'
          }`}
          style={{
            textShadow: isCrewWin
              ? '0 0 20px rgba(6,182,212,0.4)'
              : '0 0 20px rgba(239,68,68,0.4)',
          }}
        >
          {isCrewWin ? 'Crew Wins' : 'Killers Win'}
        </h1>

        {summary && (
          <div className="space-y-4">
            {/* Narrative */}
            {summary.narrative && (
              <p className="text-gray-300 font-mono text-sm leading-relaxed italic text-center px-2">
                {summary.narrative}
              </p>
            )}

            {/* Killers reveal */}
            <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-center">
              <p className="text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">The Killers Were</p>
              <p className="text-white font-mono text-sm font-bold">{summary.killers.join(', ')}</p>
            </div>

            {/* Stats row */}
            <div className="flex justify-center gap-3 text-center flex-wrap">
              <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
                <p className="text-gray-500 text-[10px] font-mono uppercase">Duration</p>
                <p className="text-white text-sm font-mono font-bold">{fmt(summary.duration)}</p>
              </div>
              <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
                <p className="text-gray-500 text-[10px] font-mono uppercase">Kills</p>
                <p className="text-red-400 text-sm font-mono font-bold">{summary.kills.length}</p>
              </div>
              <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
                <p className="text-gray-500 text-[10px] font-mono uppercase">Ejections</p>
                <p className="text-yellow-400 text-sm font-mono font-bold">{summary.ejections.length}</p>
              </div>
              <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
                <p className="text-gray-500 text-[10px] font-mono uppercase">Survivors</p>
                <p className="text-green-400 text-sm font-mono font-bold">{summary.survivors.length}</p>
              </div>
              <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
                <p className="text-gray-500 text-[10px] font-mono uppercase">LLM Cost</p>
                <p className="text-cyan-400 text-sm font-mono font-bold">${summary.llmCost.toFixed(4)}</p>
              </div>
            </div>

            {/* Kill timeline */}
            {summary.kills.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs font-mono font-bold uppercase tracking-wider mb-1">Timeline</p>
                <div className="space-y-0.5">
                  {summary.kills.map((k, i) => (
                    <div key={`k${i}`} className="flex gap-2 text-[11px] font-mono">
                      <span className="text-gray-600 tabular-nums w-10 shrink-0">{fmt(k.tick)}</span>
                      <span className="text-red-400">{k.killerName}</span>
                      <span className="text-gray-500">killed</span>
                      <span className="text-gray-300">{k.victimName}</span>
                    </div>
                  ))}
                  {summary.ejections.map((e, i) => (
                    <div key={`e${i}`} className="flex gap-2 text-[11px] font-mono">
                      <span className="text-gray-600 tabular-nums w-10 shrink-0">{fmt(e.tick)}</span>
                      <span className={e.wasKiller ? 'text-green-400' : 'text-orange-400'}>{e.name}</span>
                      <span className="text-gray-500">ejected {e.wasKiller ? '(killer)' : '(innocent)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!summary && (
          <div className="flex justify-center gap-4 my-4">
            <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
              <p className="text-gray-500 text-xs font-mono">Killers Found</p>
              <p className="text-white text-lg font-mono font-bold">{killersFound}/{totalKillers}</p>
            </div>
          </div>
        )}

        <div className="text-center mt-4">
          <button
            onClick={onPlayAgain}
            className="px-6 py-3 bg-accent-purple/20 text-accent-purple border border-accent-purple/40 rounded-lg font-mono font-bold hover:bg-accent-purple/30 transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </Overlay>
  )
}
