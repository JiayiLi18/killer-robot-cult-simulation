import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { GameWorldScreen } from './screens/GameWorld/GameWorldScreen'
import { DevPanel } from './hud/DevPanel'
import { CouncilChat } from './god-ui/components/Council/CouncilChat'
import { CouncilResult } from './god-ui/components/Council/CouncilResult'
import { EndingScreen } from './god-ui/components/EndingScreen'
import { QRJoin } from './god-ui/components/Lobby/QRJoin'
import { JoinForm } from './god-ui/components/Lobby/JoinForm'
import { PlayerList } from './god-ui/components/Lobby/PlayerList'
import type { CouncilMessage, CouncilResult as CouncilResultType, Nominee } from './god-ui/types/godUI'

const COUNCIL_COOLDOWN_SECS = 60

function LobbyPhase({ onJoin, lobby, actions }: {
  onJoin: (name: string) => void
  lobby: NonNullable<import('./types').GameState['lobby']>
  actions: import('./hooks/useGameState').GameActions
}) {
  const [hasJoined, setHasJoined] = useState(false)
  const [robotName, setRobotName] = useState('')
  const [robotIdentity, setRobotIdentity] = useState('')
  const [robotLook, setRobotLook] = useState('')

  const lastPlayer = lobby.players[lobby.players.length - 1]
  const isReady = lastPlayer?.isReady ?? false

  const handleJoin = (name: string) => {
    onJoin(name)
    setHasJoined(true)
  }

  const handleReady = () => {
    actions.setReady({ robotName, robotIdentity, robotLook })
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 py-8 gap-8 bg-void">
      {!hasJoined ? (
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <img
            src="/Killer-Robot-Cult.png"
            alt="A-Line: Killer Robot Cult"
            className="w-64 md:w-80 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.15)] border border-gray-800/50"
          />
          <div className="flex flex-col items-center gap-6">
            <QRJoin roomCode={lobby.roomCode} qrUrl={lobby.qrUrl} />
            <JoinForm onJoin={handleJoin} />
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-mono font-bold text-white">Define Your Robot</h2>
          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Robot Name</label>
              <input type="text" value={robotName} onChange={(e) => setRobotName(e.target.value)}
                placeholder="e.g. BOLT-7" maxLength={20} disabled={isReady}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Robot Identity</label>
              <textarea value={robotIdentity} onChange={(e) => setRobotIdentity(e.target.value)}
                placeholder="Who is this robot? What drives them?" maxLength={200} rows={3} disabled={isReady}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Robot Look</label>
              <textarea value={robotLook} onChange={(e) => setRobotLook(e.target.value)}
                placeholder="Describe your robot's appearance..." maxLength={200} rows={3} disabled={isReady}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-purple-400 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {!isReady ? (
              <button onClick={handleReady}
                className="w-full py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg font-mono font-bold text-sm hover:bg-emerald-500/30 transition-colors">
                Ready
              </button>
            ) : (
              <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                <span className="text-emerald-400 font-mono font-bold text-sm">Ready — waiting for others...</span>
              </div>
            )}
          </div>
        </>
      )}
      <PlayerList players={lobby.players} />
    </div>
  )
}

export default function App() {
  const { state, actions, wsConnected } = useGameState()
  const [councilActive, setCouncilActive] = useState(false)
  const [councilMessages] = useState<CouncilMessage[]>([])
  const [councilResult, setCouncilResult] = useState<CouncilResultType | null>(null)
  const [councilVote, setCouncilVote] = useState<string | undefined>()

  const startCouncil = () => {
    if (state.councilCooldown > 0) return
    actions.setPhase('council')
    setCouncilActive(true)
    setCouncilResult(null)
    setCouncilVote(undefined)
  }

  const endCouncil = () => {
    setCouncilActive(false)
    setCouncilResult(null)
    actions.setPhase('playing')
    actions.setCouncilCooldown(COUNCIL_COOLDOWN_SECS)
  }

  const nominees: Nominee[] = Object.values(state.robots)
    .filter(r => r.status === 'alive')
    .map(r => ({ robotId: r.id, robotName: r.name, votes: 0 }))

  // Phase routing
  if (state.phase === 'lobby' || state.phase === 'setup') {
    const lobby = state.lobby ?? {
      roomId: '', roomCode: 'MOCK', qrUrl: '', players: [], isHost: false,
    }
    return (
      <LobbyPhase
        lobby={lobby}
        actions={actions}
        onJoin={(name) => actions.joinRoom(name)}
      />
    )
  }

  if (state.phase === 'ended') {
    return (
      <EndingScreen
        killersFound={state.killersFound}
        totalKillers={state.totalKillers}
        onPlayAgain={() => actions.setPhase('lobby')}
      />
    )
  }

  // Council phase — our full-screen overlay
  if (councilActive && state.phase === 'council') {
    if (councilResult) {
      return (
        <CouncilResult
          result={councilResult}
          robots={state.robots}
          onContinue={endCouncil}
        />
      )
    }
    return (
      <CouncilChat
        messages={councilMessages}
        nominees={nominees}
        myVote={councilVote}
        robots={state.robots}
        onVote={(robotId) => setCouncilVote(robotId)}
      />
    )
  }

  // Playing / VoG — partner's game world
  return (
    <div className="w-full h-full">
      <div className="w-full h-full">
        <GameWorldScreen state={state} actions={actions} />
        <DevPanel state={state} actions={actions} onStartCouncil={startCouncil} />
      </div>

      {/* WS connection indicator (live mode only) */}
      {wsConnected !== undefined && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
          style={{ background: 'rgba(6,6,14,0.9)', border: `1px solid ${wsConnected ? 'rgba(40,180,80,0.5)' : 'rgba(180,40,40,0.5)'}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: wsConnected ? '#40c060' : '#c04040' }} />
          <span style={{ color: wsConnected ? '#60d080' : '#d06060' }}>
            {wsConnected ? 'live' : 'connecting…'}
          </span>
        </div>
      )}
    </div>
  )
}
