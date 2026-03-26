import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { GameScene } from './GameScene'
import { GameState } from '../../types'
import { HUD } from '../../hud/HUD'
import { RobotInfoPanel } from '../../hud/RobotInfoPanel'
import { GameActions } from '../../hooks/useGameState'

interface Props {
  state: GameState
  actions: GameActions
}

export function GameWorldScreen({ state, actions }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const gameRef        = useRef<Phaser.Game | null>(null)
  const sceneRef       = useRef<GameScene | null>(null)
  const latestStateRef = useRef<GameState>(state)
  latestStateRef.current = state

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Mount Phaser
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#06060e',
      parent: containerRef.current,
      scene: [GameScene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    })
    gameRef.current = game
    game.events.once('ready', () => {
      const scene = game.scene.getScene('GameScene') as GameScene
      sceneRef.current = scene
      scene.onRobotClick      = (id) => setSelectedId(id)
      scene.onBackgroundClick = () => setSelectedId(null)
      scene.applyState(latestStateRef.current)
    })
    return () => { game.destroy(true); gameRef.current = null; sceneRef.current = null }
  }, [])

  // Push state updates to Phaser
  useEffect(() => { sceneRef.current?.applyState(state) }, [state])

  // Camera follow when robot is selected
  useEffect(() => { sceneRef.current?.setSelectedRobot(selectedId) }, [selectedId])

  const selectedRobot   = selectedId ? state.robots[selectedId] : null
  const selectedRoomName = selectedRobot
    ? (state.map.find(r => r.id === selectedRobot.roomId)?.name ?? '')
    : ''

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Phaser canvas — speech bubbles rendered inside Phaser at 60fps */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* HUD overlay */}
      <HUD state={state} />

      {/* Robot info panel — slides up from bottom on click */}
      {selectedRobot && (
        <RobotInfoPanel
          robot={selectedRobot}
          roomName={selectedRoomName}
          actions={actions}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
