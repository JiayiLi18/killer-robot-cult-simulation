import type { Player } from '../../../types'

interface PlayerListProps {
  players: Player[]
  /** In lobby, "ready" means lobby ready; in setup+, robot setup ready */
  phase?: 'lobby' | 'setup' | 'playing' | 'vog' | 'council' | 'ended'
}

function playerReadyForPhase(player: Player, phase: PlayerListProps['phase']): boolean {
  if (phase === 'lobby') return player.lobbyReady === true
  return player.isReady
}

export function PlayerList({ players, phase }: PlayerListProps) {
  const readyCount = players.filter((p) => playerReadyForPhase(p, phase)).length
  const lobbyLabel = phase === 'lobby'

  return (
    <div className="w-full max-w-2xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest">
          Gods ({players.length})
        </h3>
        <span className="text-xs font-mono text-gray-500">
          {readyCount}/{players.length} {lobbyLabel ? 'lobby ready' : 'setup ready'}
        </span>
      </div>

      {players.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
          {players.map((player) => {
            const showReady = playerReadyForPhase(player, phase)
            return (
            <div
              key={player.id}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-colors ${
                showReady
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-surface border-gray-800'
              }`}
            >
              <div className="relative">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm ${
                  showReady
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-accent-purple/20 border border-accent-purple/40 text-accent-purple'
                }`}>
                  {showReady ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,8 7,12 13,4" />
                    </svg>
                  ) : (
                    player.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-surface ${
                    player.isConnected ? 'bg-emerald-400' : 'bg-gray-600'
                  }`}
                />
              </div>
              <span className="font-mono text-xs text-white truncate w-full text-center">
                {player.name}
              </span>
              {player.isHost && (
                <span className="text-yellow-400 text-[10px] leading-none" title="Host">&#9819;</span>
              )}
            </div>
            )
          })}
        </div>
      ) : (
        <p className="text-gray-600 text-sm text-center py-4 font-mono">
          Waiting for gods to join...
        </p>
      )}
    </div>
  )
}
