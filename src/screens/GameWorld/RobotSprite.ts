import Phaser from 'phaser'
import { Robot } from '../../types'

const STATUS_COLOR: Record<Robot['status'], number> = {
  alive:   0x44aaff,
  dead:    0x444444,
  ejected: 0xff4400,
}

// Max characters before the bubble truncates
const BUBBLE_MAX = 36

export class RobotSprite {
  private circle:     Phaser.GameObjects.Arc
  private statusRing: Phaser.GameObjects.Arc
  // Speech bubble lives INSIDE the container so it moves with the robot at 60 fps
  private bubble:     Phaser.GameObjects.Text
  private bubbleBg:   Phaser.GameObjects.Graphics
  container: Phaser.GameObjects.Container

  constructor(
    scene: Phaser.Scene,
    robot: Robot,
    worldX: number,
    worldY: number,
    onClick: (id: string) => void,
  ) {
    const color = STATUS_COLOR[robot.status]

    // --- visual layers ---
    const glow = scene.add.arc(0, 0, 24, 0, 360, false, color, 0.12)

    this.statusRing = scene.add.arc(0, 0, 18, 0, 360, false, 0, 0)
    this.statusRing.setStrokeStyle(2, color, 0.8)

    this.circle = scene.add.arc(0, 0, 14, 0, 360, false, color, robot.status === 'dead' ? 0.3 : 0.85)

    const emoji = scene.add.text(0, 0, robot.look, { fontSize: '14px' }).setOrigin(0.5, 0.5)

    const nameTag = scene.add.text(0, 22, robot.name, {
      fontSize: '9px',
      color: robot.status === 'alive' ? '#cce4ff' : '#666666',
      fontFamily: 'Courier New, monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    // Dead / ejected icon
    const statusIcon = robot.status !== 'alive'
      ? scene.add.text(10, -10, robot.status === 'dead' ? '💀' : '🚀', { fontSize: '10px' }).setOrigin(0.5, 1)
      : null

    // --- speech bubble (in world space, child of container) ---
    this.bubbleBg = scene.add.graphics()
    this.bubble = scene.add.text(0, -48, '', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Courier New, monospace',
      wordWrap: { width: 120 },
    }).setOrigin(0.5, 1)

    const children = [glow, this.statusRing, this.circle, emoji, nameTag, this.bubbleBg, this.bubble]
    if (statusIcon) children.push(statusIcon)

    this.container = scene.add.container(worldX, worldY, children)
    this.container.setDepth(10)
    this.container.setSize(48, 48)
    this.container.setInteractive()

    // Interaction
    if (robot.status === 'alive') {
      this.container.on('pointerover', () => {
        this.statusRing.setStrokeStyle(3, 0xffffff, 1)
        scene.input.setDefaultCursor('pointer')
      })
      this.container.on('pointerout', () => {
        this.statusRing.setStrokeStyle(2, color, 0.8)
        scene.input.setDefaultCursor('default')
      })
    }
    this.container.on('pointerdown', () => onClick(robot.id))

    // Apply initial message
    this.setMessage(robot.lastMessage ?? null)
  }

  setMessage(msg: string | null | undefined) {
    if (!msg) {
      this.bubble.setVisible(false)
      this.bubbleBg.setVisible(false)
      return
    }
    const text = msg.length > BUBBLE_MAX ? msg.slice(0, BUBBLE_MAX - 1) + '…' : msg
    this.bubble.setText(text).setVisible(true)

    // Redraw background pill
    const b = this.bubble.getBounds()
    const pad = 5
    const bw = b.width  + pad * 2
    const bh = b.height + pad * 2
    const bx = -bw / 2
    const by = -48 - bh + 2   // align with bubble text top

    this.bubbleBg.clear()
    this.bubbleBg.fillStyle(0x111122, 0.88)
    this.bubbleBg.fillRoundedRect(bx, by, bw, bh, 5)
    this.bubbleBg.lineStyle(1, 0x4455aa, 0.7)
    this.bubbleBg.strokeRoundedRect(bx, by, bw, bh, 5)
    // Tail
    this.bubbleBg.fillStyle(0x111122, 0.88)
    this.bubbleBg.fillTriangle(-4, -48, 4, -48, 0, -42)
    this.bubbleBg.setVisible(true)
  }

  updateStatus(status: Robot['status']) {
    const color = STATUS_COLOR[status]
    this.circle.setFillStyle(color, status === 'dead' ? 0.3 : 0.85)
    this.statusRing.setStrokeStyle(2, color, 0.8)
  }

  // Kept for beliefs display — called from GameScene but not shown in world unless needed
  setBeliefsBadge(_beliefs: string) { /* beliefs shown in info panel only */ }

  getPixelPosition() { return { x: this.container.x, y: this.container.y } }
  destroy() { this.container.destroy() }
}
