import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { GameWorldScreen } from './screens/GameWorld/GameWorldScreen'
import { DevPanel } from './hud/DevPanel'
import { CouncilView } from './hud/CouncilView'

const COUNCIL_COOLDOWN_SECS = 60

export default function App() {
  const { state, actions, wsConnected } = useGameState()
  const [councilActive, setCouncilActive] = useState(false)

  const startCouncil = () => {
    if (state.councilCooldown > 0) return
    actions.setPhase('council')
    setCouncilActive(true)
  }

  const endCouncil = () => {
    setCouncilActive(false)
    actions.setPhase('playing')
    actions.setCouncilCooldown(COUNCIL_COOLDOWN_SECS)
  }

  return (
    <div className="w-full h-full">
      {/* Game world always mounted, hidden during council */}
      <div className={councilActive ? 'hidden' : 'w-full h-full'}>
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

      {/* Council overlay — replaces game view */}
      {councilActive && (
        <CouncilView state={state} onEnd={endCouncil} />
      )}
    </div>
  )
}
