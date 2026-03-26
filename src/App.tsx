import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { GameWorldScreen } from './screens/GameWorld/GameWorldScreen'
import { CouncilChat } from './god-ui/components/Council/CouncilChat'
import { CouncilResult } from './god-ui/components/Council/CouncilResult'
import { EndingScreen } from './god-ui/components/EndingScreen'
import { QRJoin } from './god-ui/components/Lobby/QRJoin'
import { PlayerList } from './god-ui/components/Lobby/PlayerList'
import { VoGInput } from './god-ui/components/VoiceOfGod/VoGInput'
import { VoGVoting } from './god-ui/components/VoiceOfGod/VoGVoting'
import { VoGAnnounce } from './god-ui/components/VoiceOfGod/VoGAnnounce'
import type { CouncilMessage, CouncilResult as CouncilResultType, Nominee } from './god-ui/types/godUI'

// ── Lobby flow: join → define robot → ready ──────────────────

type LobbyStep = 'join' | 'define-robot'

function LobbyPhase({ state, actions, godId, roomCode }: {
  state: import('./types').GameState
  actions: import('./hooks/useGameState').GameActions
  godId: string
  roomCode: string | null
}) {
  const [step, setStep] = useState<LobbyStep>('join')
  const [godName, setGodName] = useState('')
  const [robotName, setRobotName] = useState('')
  const [robotIdentity, setRobotIdentity] = useState('')
  const [robotLook, setRobotLook] = useState('')

  const lobby = state.lobby
  const displayCode = lobby?.roomCode ?? roomCode ?? '...'
  const qrUrl = `${window.location.origin}?room=${displayCode}`
  const hasJoined = lobby?.players.some(p => p.id === godId) ?? false
  const hasRobot = lobby?.players.find(p => p.id === godId)?.hasRobot ?? false

  // Auto-advance step based on server state
  const effectiveStep = hasRobot ? 'define-robot' : hasJoined ? 'define-robot' : step

  const handleJoin = () => {
    const trimmed = godName.trim()
    if (!trimmed) return
    actions.joinLobby(trimmed)
    setStep('define-robot')
  }

  const handleDefineRobot = () => {
    if (!robotName.trim()) return
    actions.defineRobot(
      robotName.trim(),
      robotLook.trim() || '🤖',
      robotIdentity.trim() || 'Unknown',
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6 bg-void overflow-y-auto">
      {effectiveStep === 'join' && (
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <img
            src="/Killer-Robot-Cult.png"
            alt="A-Line: Killer Robot Cult"
            className="w-48 md:w-64 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.15)] border border-gray-800/50"
          />
          <div className="flex flex-col items-center gap-6">
            <QRJoin roomCode={displayCode} qrUrl={qrUrl} />
            <form onSubmit={(e) => { e.preventDefault(); handleJoin() }} className="flex gap-2 w-full max-w-xs">
            <input
              type="text"
              value={godName}
              onChange={(e) => setGodName(e.target.value)}
              placeholder="Your god name..."
              maxLength={20}
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-accent-cyan transition-colors"
            />
            <button
              type="submit"
              disabled={!godName.trim()}
              className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg font-mono text-sm hover:bg-accent-cyan/30 transition-colors disabled:opacity-30"
            >
              Join
            </button>
          </form>
          </div>
        </div>
      )}

      {effectiveStep === 'define-robot' && (
        <img
          src="/Killer-Robot-Cult.png"
          alt="A-Line: Killer Robot Cult"
          className="w-32 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.15)] border border-gray-800/50"
        />
      )}

      {effectiveStep === 'define-robot' && !hasRobot && (
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-mono font-bold text-white text-center">Define Your Robot</h2>
          <div>
            <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Robot Name</label>
            <input type="text" value={robotName} onChange={(e) => setRobotName(e.target.value)}
              placeholder="e.g. BOLT-7" maxLength={20}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Robot Identity</label>
            <textarea value={robotIdentity} onChange={(e) => setRobotIdentity(e.target.value)}
              placeholder="Who is this robot? What drives them?" maxLength={200} rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Robot Look</label>
            <textarea value={robotLook} onChange={(e) => setRobotLook(e.target.value)}
              placeholder="Describe your robot's appearance..." maxLength={200} rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm outline-none focus:border-purple-400 transition-colors resize-none"
            />
          </div>
          <button onClick={handleDefineRobot}
            disabled={!robotName.trim()}
            className="w-full py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg font-mono font-bold text-sm hover:bg-emerald-500/30 transition-colors disabled:opacity-30">
            Ready
          </button>
        </div>
      )}

      {effectiveStep === 'define-robot' && hasRobot && (
        <div className="w-full max-w-sm py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
          <span className="text-emerald-400 font-mono font-bold text-sm">Ready -- waiting for others...</span>
        </div>
      )}

      {/* Player list */}
      {lobby && lobby.players.length > 0 && (
        <PlayerList players={lobby.players} />
      )}

      {/* Room code at bottom */}
      {effectiveStep === 'define-robot' && (
        <div className="text-center">
          <p className="text-gray-500 text-xs mb-1">Room Code</p>
          <p className="text-lg font-mono font-bold text-accent-cyan tracking-widest">{displayCode}</p>
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────

export default function App() {
  const { state, actions, connected, godId, roomCode } = useGameState()
  const [councilResult, setCouncilResult] = useState<CouncilResultType | null>(null)
  const [councilVote, setCouncilVote] = useState<string | undefined>()
  const [vogSubmission, setVogSubmission] = useState<string | undefined>()
  const [vogVote, setVogVote] = useState<string | undefined>()

  // Connection indicator
  const connectionBadge = (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
      style={{ background: 'rgba(6,6,14,0.9)', border: `1px solid ${connected ? 'rgba(40,180,80,0.5)' : 'rgba(180,40,40,0.5)'}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? '#40c060' : '#c04040' }} />
      <span style={{ color: connected ? '#60d080' : '#d06060' }}>
        {connected ? 'live' : 'connecting...'}
      </span>
    </div>
  )

  // Not connected yet — show connecting screen
  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-void">
        {connectionBadge}
        <p className="text-gray-500 font-mono text-sm">Connecting to server...</p>
      </div>
    )
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

  // Council phase
  if (state.phase === 'council') {
    if (councilResult) {
      return (
        <>
          {connectionBadge}
          <CouncilResult
            result={councilResult}
            robots={state.robots}
            onContinue={() => setCouncilResult(null)}
          />
        </>
      )
    }
    return (
      <>
        {connectionBadge}
        <CouncilChat
          messages={backendCouncilMessages}
          nominees={nominees}
          myVote={councilVote}
          robots={state.robots}
          onVote={(robotId) => {
            setCouncilVote(robotId)
            actions.voteCouncil(robotId)
          }}
        />
      </>
    )
  }

  // Lobby / Setup phase
  if (state.phase === 'lobby' || state.phase === 'setup') {
    return (
      <>
        {connectionBadge}
        <LobbyPhase state={state} actions={actions} godId={godId} roomCode={roomCode} />
      </>
    )
  }

  // Ended phase
  if (state.phase === 'ended') {
    return (
      <>
        {connectionBadge}
        <EndingScreen
          killersFound={state.killersFound}
          totalKillers={state.totalKillers}
          onPlayAgain={() => { /* server controls restart */ }}
        />
      </>
    )
  }

  // Playing / VoG phase
  const vog = state.voiceOfGod

  return (
    <div className="w-full h-full">
      <div className="w-full h-full">
        <GameWorldScreen state={state} actions={actions} />
      </div>

      {/* VoG overlays */}
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

      {connectionBadge}
    </div>
  )
}
