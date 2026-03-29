import { useState, useRef } from 'react'
import { useGameState } from './hooks/useGameState'
import { GameWorldScreen } from './screens/GameWorld/GameWorldScreen'
import { DevPanel } from './hud/DevPanel'
import { CouncilChat } from './god-ui/components/Council/CouncilChat'
import { CouncilResult } from './god-ui/components/Council/CouncilResult'
import { EndingScreen } from './god-ui/components/EndingScreen'
import { QRJoin } from './god-ui/components/Lobby/QRJoin'
import { JoinForm } from './god-ui/components/Lobby/JoinForm'
import { PlayerList } from './god-ui/components/Lobby/PlayerList'
import { VoGInput } from './god-ui/components/VoiceOfGod/VoGInput'
import { VoGVoting } from './god-ui/components/VoiceOfGod/VoGVoting'
import { VoGAnnounce } from './god-ui/components/VoiceOfGod/VoGAnnounce'
import type { CouncilMessage, CouncilResult as CouncilResultType, Nominee } from './god-ui/types/godUI'

const COUNCIL_COOLDOWN_SECS = 60

function LobbyPhase({ onJoin, lobby, actions, phase, isLive, wsConnected, currentPlayerId }: {
  onJoin: (name: string, roomCode?: string) => void
  lobby: NonNullable<import('./types').GameState['lobby']>
  actions: import('./hooks/useGameState').GameActions
  phase: import('./types').GameState['phase']
  isLive: boolean
  wsConnected: boolean
  currentPlayerId?: string
}) {
  const [hasJoined, setHasJoined] = useState(false)
  const [roomDraft, setRoomDraft] = useState(() =>
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('room') || 'default')
      : 'default',
  )
  const [robotName, setRobotName] = useState('')
  const [robotIdentity, setRobotIdentity] = useState('')
  const [robotLook, setRobotLook] = useState('')
  const [npcCount, setNpcCount] = useState(0)

  const currentPlayer = lobby.players.find((player) => player.id === currentPlayerId)
  const isReady = currentPlayer?.isReady ?? false
  const isHost = currentPlayer?.isHost ?? false
  const lobbyReady = currentPlayer?.lobbyReady ?? false
  const connectedPlayers = lobby.players.filter((p) => p.isConnected)
  const allLobbyReady =
    connectedPlayers.length > 0 && connectedPlayers.every((p) => p.lobbyReady)
  const readyCount = lobby.players.filter((player) => player.isReady).length
  const canLaunchSimulation =
    connectedPlayers.length > 0 && connectedPlayers.every((p) => p.isReady)

  const handleJoin = (name: string) => {
    if (isLive) {
      onJoin(name, roomDraft)
    } else {
      onJoin(name)
    }
    setHasJoined(true)
  }

  const joinQrUrl = `${window.location.origin}/?live&room=${encodeURIComponent(roomDraft)}`

  const handleReady = () => {
    actions.setReady({ robotName, robotIdentity, robotLook })
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 py-8 gap-8 bg-void">
      {phase === 'lobby' && !hasJoined ? (
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <img
            src="/Killer-Robot-Cult.png"
            alt="A-Line: Killer Robot Cult"
            className="w-64 md:w-80 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.15)] border border-gray-800/50"
          />
          <div className="flex flex-col items-center gap-6 w-full max-w-xs">
            {isLive && (
              <div className="w-full space-y-1">
                <label className="block text-gray-500 text-xs font-mono uppercase tracking-wider">Room code</label>
                <input
                  type="text"
                  value={roomDraft}
                  onChange={(e) => setRoomDraft(e.target.value.trim() || 'default')}
                  maxLength={32}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-cyan-400"
                />
                <p className="text-gray-600 text-xs font-mono">Same code on every tab to play together.</p>
              </div>
            )}
            <QRJoin roomCode={isLive ? roomDraft : lobby.roomCode} qrUrl={isLive ? joinQrUrl : lobby.qrUrl} />
            <JoinForm onJoin={handleJoin} />
          </div>
        </div>
      ) : phase === 'lobby' && isLive ? (
        <div className="w-full max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-mono font-bold text-white">Room: {lobby.roomCode}</h2>
          <p className="text-sm text-gray-400 font-mono">
            {wsConnected ? 'Connected' : 'Connecting…'}
          </p>
          <div className="flex flex-col gap-2">
            {lobbyReady ? (
              <button
                type="button"
                onClick={() => actions.setLobbyReady(false)}
                className="w-full py-3 bg-gray-800 text-gray-200 border border-gray-600 rounded-lg font-mono font-bold text-sm"
              >
                Not ready
              </button>
            ) : (
              <button
                type="button"
                onClick={() => actions.setLobbyReady(true)}
                disabled={!wsConnected}
                className="w-full py-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg font-mono font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ready
              </button>
            )}
          </div>
          {isHost ? (
            <button
              type="button"
              onClick={() => actions.startGame()}
              disabled={!allLobbyReady || !wsConnected}
              className="w-full py-3 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg font-mono font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start game
            </button>
          ) : (
            <p className="text-sm text-gray-500 font-mono">Waiting for host to start…</p>
          )}
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
                className="w-full py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg font-mono font-bold text-sm">
                Ready
              </button>
            ) : (
              <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                <span className="text-emerald-400 font-mono font-bold text-sm">Ready - waiting for others...</span>
              </div>
            )}
            {isLive && isHost && (
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">NPC Robots</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={npcCount}
                      onChange={(e) => setNpcCount(Math.max(0, Math.min(12, parseInt(e.target.value) || 0)))}
                      className="w-20 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-cyan-400 text-center"
                    />
                    <span className="text-gray-500 text-xs font-mono">AI-controlled robots (0–12)</span>
                  </div>
                </div>
                <button
                  onClick={() => actions.startSimulation(npcCount)}
                  disabled={!canLaunchSimulation || !wsConnected}
                  className="w-full py-3 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg font-mono font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Launch Simulation{npcCount > 0 ? ` (+${npcCount} NPCs)` : ''}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <PlayerList players={lobby.players} phase={phase} />
    </div>
  )
}

export default function App() {
  const { state, actions, wsConnected, currentGodId } = useGameState()
  const [councilActive, setCouncilActive] = useState(false)
  const [councilMessages] = useState<CouncilMessage[]>([])
  const [councilResult, setCouncilResult] = useState<CouncilResultType | null>(null)
  const [councilVote, setCouncilVote] = useState<string | undefined>()

  const [vogSubmission, setVogSubmission] = useState<string | undefined>()
  const [vogVote, setVogVote] = useState<string | undefined>()
  const prevVogPhaseRef = useRef<string | undefined>()

  // Reset VoG local state when a new round starts (phase goes to submission)
  const vogPhase = state.voiceOfGod?.phase
  if (vogPhase !== prevVogPhaseRef.current) {
    if (vogPhase === 'submission') {
      if (vogSubmission !== undefined) setVogSubmission(undefined)
      if (vogVote !== undefined) setVogVote(undefined)
    }
    prevVogPhaseRef.current = vogPhase
  }

  const startCouncil = () => {
    if (state.councilCooldown > 0) return
    actions.callCouncil()
    setCouncilResult(null)
    setCouncilVote(undefined)
  }

  const endCouncil = () => {
    setCouncilActive(false)
    setCouncilResult(null)
  }

  // Build nominees from backend council votes or from alive robots
  const nominees: Nominee[] = Object.values(state.robots)
    .filter(r => r.status === 'alive')
    .map(r => {
      const voteCount = state.council
        ? Object.values(state.council.votes).filter(v => v === r.id).length
        : 0
      return { robotId: r.id, robotName: r.name, votes: voteCount }
    })

  // Convert backend council messages to UI format
  const backendCouncilMessages: CouncilMessage[] = (state.council?.messages ?? []).map(m => ({
    agentId: m.agentId,
    message: m.message,
    timestamp: m.tick,
  }))

  // Council phase — no longer takes over the screen; game world stays visible
  // Council events show in the event log; player can vote via the bottom panel

  // Phase routing
  if (state.phase === 'lobby' || state.phase === 'setup') {
    const lobby = state.lobby ?? {
      roomId: '', roomCode: 'MOCK', qrUrl: '', players: [], isHost: false,
    }
    return (
      <LobbyPhase
        lobby={lobby}
        actions={actions}
        phase={state.phase}
        isLive={wsConnected !== undefined}
        wsConnected={wsConnected ?? false}
        currentPlayerId={currentGodId}
        onJoin={(name, roomCode) => actions.joinRoom(name, roomCode)}
      />
    )
  }

  if (state.phase === 'ended') {
    return (
      <EndingScreen
        killersFound={state.killersFound}
        totalKillers={state.totalKillers}
        summary={state.summary}
        onPlayAgain={() => actions.playAgain()}
      />
    )
  }

  const vog = state.voiceOfGod

  // Playing / VoG — partner's game world
  return (
    <div className="w-full h-full">
      <div className="w-full h-full">
        <GameWorldScreen state={state} actions={actions} />
        <DevPanel state={state} actions={actions} onStartCouncil={startCouncil} />
      </div>

      {/* VoG overlays — driven by backend state */}
      {vog?.phase === 'submission' && (
        <VoGInput
          isEligible={vog.selectedGods.length > 0}
          mySubmission={vogSubmission}
          onSubmit={(words) => {
            setVogSubmission(words)
            actions.submitVog(words)
          }}
        />
      )}
      {vog?.phase === 'voting' && (
        <VoGVoting
          submissions={vog.submissions}
          myVote={vogVote}
          onVote={(godId) => {
            setVogVote(godId)
            actions.voteVog(godId)
          }}
        />
      )}
      {vog?.phase === 'done' && vog.winnerWords && (
        <VoGAnnounce announcement={vog.winnerWords} />
      )}

      {/* Council vote panel — top bar below HUD during council phase */}
      {state.phase === 'council' && (
        <div className="fixed top-12 left-72 right-0 z-40">
          <div className="bg-surface/95 backdrop-blur-md border-b border-red-900/50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-red-400 font-mono text-sm font-bold uppercase tracking-widest">
                Council Vote
              </h3>
              <span className="text-red-400/60 font-mono text-xs">{state.countdown}s</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {nominees.filter(n => n.robotId !== '').map(n => (
                <button
                  key={n.robotId}
                  onClick={() => {
                    setCouncilVote(n.robotId)
                    actions.voteCouncil(n.robotId)
                  }}
                  disabled={!!councilVote}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-all ${
                    councilVote === n.robotId
                      ? 'bg-red-500/20 border-red-500 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                  } disabled:cursor-default`}
                >
                  {n.robotName} {n.votes > 0 ? `(${n.votes})` : ''}
                </button>
              ))}
              <button
                onClick={() => {
                  setCouncilVote('skip')
                  actions.voteCouncil('skip')
                }}
                disabled={!!councilVote}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-all ${
                  councilVote === 'skip'
                    ? 'bg-gray-500/20 border-gray-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'
                } disabled:cursor-default`}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Game button — top right */}
      <button
        onClick={() => { if (confirm('End the game and return to lobby?')) actions.endGame() }}
        className="fixed top-2 right-14 z-50 px-2.5 py-1 rounded-full text-xs font-mono"
        style={{ background: 'rgba(60,20,20,0.9)', border: '1px solid rgba(180,40,40,0.5)', color: '#d06060' }}
      >
        End Game
      </button>

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
