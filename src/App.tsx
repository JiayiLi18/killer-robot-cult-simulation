import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { GameWorldScreen } from './screens/GameWorld/GameWorldScreen'
import { DevPanel } from './hud/DevPanel'
import { CouncilView } from './hud/CouncilView'

const COUNCIL_COOLDOWN_SECS = 60

export default function App() {
  const { state, actions } = useGameState()
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

      {/* Council overlay — replaces game view */}
      {councilActive && (
        <CouncilView state={state} onEnd={endCouncil} />
      )}
    </div>
  )
}
