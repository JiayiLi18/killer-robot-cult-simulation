import Phaser from 'phaser'
import { GameState } from '../../types'
import { RobotSprite } from './RobotSprite'
import {
  ROOM_LAYOUTS, getRoomLayout, roomCenter, robotSlotPosition, corridorRect,
} from '../../worldMap'

const BG_COLOR       = 0x06060e
const CORRIDOR_COLOR = 0x111124
const CORRIDOR_EDGE  = 0x222244

export class GameScene extends Phaser.Scene {
  private robotSprites:     Map<string, RobotSprite> = new Map()
  private roomLabels:       Map<string, Phaser.GameObjects.Text> = new Map()
  private _selectedId:      string | null = null
  robotPixelPositions:      Map<string, { x: number; y: number }> = new Map()

  onRobotClick?:      (robotId: string, screenX: number, screenY: number) => void
  onBackgroundClick?: () => void

  constructor() { super({ key: 'GameScene' }) }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR)
    this.buildStaticWorld()
    this.setupCamera()
    this.setupInput()
  }

  private buildStaticWorld() {
    const PAIRS = [
      ['bridge','hallway'],['bridge','comms'],
      ['hallway','engine'],['hallway','medbay'],['hallway','cargo'],
      ['medbay','lab'],['cargo','airlock'],
    ]
    const drawn = new Set<string>()
    PAIRS.forEach(([a, b]) => {
      const key = [a,b].sort().join('|')
      if (drawn.has(key)) return; drawn.add(key)
      const rect = corridorRect(a, b)
      if (!rect) return
      const g = this.add.graphics().setDepth(1)
      g.fillStyle(CORRIDOR_COLOR)
      g.fillRect(rect.x, rect.y, rect.w, rect.h)
      g.lineStyle(1, CORRIDOR_EDGE, 0.7)
      g.strokeRect(rect.x, rect.y, rect.w, rect.h)
    })

    ROOM_LAYOUTS.forEach(room => {
      const g = this.add.graphics().setDepth(2)
      const r = 10
      g.fillStyle(room.fillColor)
      g.fillRoundedRect(room.x+2, room.y+2, room.w-4, room.h-4, r)
      g.lineStyle(3, room.borderColor, 0.9)
      g.strokeRoundedRect(room.x+2, room.y+2, room.w-4, room.h-4, r)
      g.lineStyle(1, room.borderColor, 0.2)
      g.strokeRoundedRect(room.x+6, room.y+6, room.w-12, room.h-12, r-3)
    })
  }

  applyState(state: GameState) {
    // Room name labels
    state.map.forEach(room => {
      const layout = getRoomLayout(room.id)
      if (!layout) return
      if (!this.roomLabels.has(room.id)) {
        const t = this.add.text(
          layout.x + layout.w/2, layout.y + 10, room.name,
          { fontSize: '12px', color: layout.labelColor, fontFamily: 'Courier New, monospace', fontStyle: 'bold' },
        ).setOrigin(0.5, 0).setDepth(5)
        this.roomLabels.set(room.id, t)
      }
    })

    const roomRobots = new Map<string, string[]>()
    state.map.forEach(r => roomRobots.set(r.id, [...r.robots]))

    const seenIds = new Set<string>()
    let movedId: string | null = null

    Object.values(state.robots).forEach(robot => {
      seenIds.add(robot.id)
      const layout = getRoomLayout(robot.roomId)
      if (!layout) return

      const inRoom = roomRobots.get(robot.roomId) ?? []
      const slotIdx = Math.max(0, inRoom.indexOf(robot.id))
      const pos = robotSlotPosition(slotIdx, inRoom.length || 1, layout)

      if (this.robotSprites.has(robot.id)) {
        const sprite = this.robotSprites.get(robot.id)!
        sprite.updateStatus(robot.status)
        sprite.setMessage(robot.lastMessage)
        sprite.setBeliefsBadge(robot.beliefs)
        const cur = sprite.container
        if (Math.abs(cur.x - pos.x) > 2 || Math.abs(cur.y - pos.y) > 2) {
          this.tweens.add({ targets: cur, x: pos.x, y: pos.y, duration: 500, ease: 'Quad.easeInOut' })
          movedId = robot.id
        }
      } else {
        const sprite = new RobotSprite(this, robot, pos.x, pos.y, (id) => {
          const sp = this.robotPixelPositions.get(id)
          this.onRobotClick?.(id, sp?.x ?? pos.x, sp?.y ?? pos.y)
        })
        sprite.setBeliefsBadge(robot.beliefs)
        this.robotSprites.set(robot.id, sprite)
      }
    })

    this.robotSprites.forEach((sprite, id) => {
      if (!seenIds.has(id)) { sprite.destroy(); this.robotSprites.delete(id) }
    })

    // Camera only moves when the user has explicitly selected a robot (handled in update loop)
    void movedId
  }

  setSelectedRobot(id: string | null) {
    this._selectedId = id
    if (id) {
      // Immediately pan to robot
      const sprite = this.robotSprites.get(id)
      if (sprite) {
        const pos = sprite.getPixelPosition()
        this.cameras.main.pan(pos.x, pos.y, 400, 'Quad.easeOut')
      }
    }
  }

  private setupCamera() {
    const targetW = 520
    const zoom = Math.min(2.0, window.innerWidth / targetW)
    this.cameras.main.setZoom(zoom)
    const c = roomCenter('bridge')
    if (c) this.cameras.main.centerOn(c.x, c.y)
  }

  private setupInput() {
    // Drag pan — disabled while following a robot
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !this._selectedId) {
        const z = this.cameras.main.zoom
        this.cameras.main.scrollX -= p.velocity.x / z / 2
        this.cameras.main.scrollY -= p.velocity.y / z / 2
      }
    })

    // Pinch / scroll zoom — always works
    this.input.on('wheel', (_p: unknown, _g: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main
      cam.zoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.3, 3)
    })

    // Background click = deselect
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const hits = this.input.hitTestPointer(pointer)
      if (!hits || hits.length === 0) {
        this.onBackgroundClick?.()
      }
    })
  }

  private updatePixelPositions() {
    const cam = this.cameras.main
    this.robotSprites.forEach((sprite, id) => {
      const { x, y } = sprite.getPixelPosition()
      this.robotPixelPositions.set(id, {
        x: (x - cam.scrollX) * cam.zoom,
        y: (y - cam.scrollY) * cam.zoom,
      })
    })
  }

  update() {
    this.updatePixelPositions()

    // Smooth camera follow when a robot is selected
    if (this._selectedId) {
      const sprite = this.robotSprites.get(this._selectedId)
      if (sprite) {
        const { x, y } = sprite.getPixelPosition()
        const cam = this.cameras.main
        const targetScrollX = x - (cam.width  / cam.zoom) / 2
        const targetScrollY = y - (cam.height / cam.zoom) / 2
        cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetScrollX, 0.07)
        cam.scrollY = Phaser.Math.Linear(cam.scrollY, targetScrollY, 0.07)
      }
    }
  }

  getRobotScreenPosition(id: string) { return this.robotPixelPositions.get(id) }
}
