# A-Line: Killer Robot Cult — Frontend (Game World + HUD)

## My scope
I own the Game World and HUD. Do not touch files outside `src/screens/GameWorld/` and `src/hud/` unless I explicitly ask.

## Tech stack
- React + Vite (TypeScript)
- Phaser.js for the top-down canvas rendering
- Native WebSocket for real-time state
- Tailwind for HUD/overlay styling

## Architecture
Phaser runs inside a React component via a `useEffect` that mounts/destroys the game instance. React owns the DOM shell and HUD overlays. Phaser owns the canvas.

```
src/
  screens/
    GameWorld/
      GameWorldScreen.tsx   ← React wrapper, mounts Phaser
      GameScene.ts          ← Phaser Scene: rooms, robots, movement
      RobotSprite.ts        ← Phaser sprite class per robot
  hud/
    HUD.tsx                 ← Countdown, killers found, council cooldown
    ChatBubble.tsx          ← Text bubble overlaid on robot position
  hooks/
    useGameState.ts         ← WebSocket consumer (owned by partner, I read only)
  types.ts                  ← Shared types (lock with partner before touching)
```

## Shared types (do not change without checking partner)
```ts
type RobotState = {
  id: string
  name: string
  look: string         // emoji or short descriptor
  x: number            // tile position
  y: number
  mood: string
  health: number
  beliefs: string
  lastMessage?: string
  isKiller?: boolean   // only revealed at end
}

type Room = {
  id: string
  name: string
  tiles: number[][]    // 0 = floor, 1 = wall
  robots: string[]     // robot ids present
}

type GameState = {
  phase: 'lobby' | 'setup' | 'playing' | 'vog' | 'council' | 'ended'
  rooms: Room[]
  robots: Record<string, RobotState>
  countdown: number
  killersFound: number
  totalKillers: number
  councilCooldown: number
}
```

## WebSocket events I consume (sent by backend)
```
state_update   → full GameState snapshot
robot_move     → { robotId, x, y }
robot_speak    → { robotId, message }
phase_change   → { phase: GameState['phase'] }
council_called → { triggeredBy: robotId }
game_end       → { winner: 'gods' | 'robots', reason: string }
```

## Rendering rules
- Top-down tile-based view, each tile = 48px
- Rooms are separated, player can scroll to view different rooms
- Robots rendered as colored circles with their `look` label
- Chat bubbles are React divs absolutely positioned over the canvas using robot pixel coords
- HUD is a React overlay on top of the Phaser canvas, pointer-events-none except interactive elements

## Mock data for local development
Use this if WebSocket is not ready:
```ts
const mockState: GameState = {
  phase: 'playing',
  rooms: [
    { id: 'r1', name: 'Bridge', tiles: [[0,0,0],[0,0,0],[0,0,0]], robots: ['bot1','bot2'] },
    { id: 'r2', name: 'Engine Room', tiles: [[0,0,0],[0,1,0],[0,0,0]], robots: ['bot3'] }
  ],
  robots: {
    bot1: { id:'bot1', name:'ARIA', look:'🤖', x:1, y:1, mood:'suspicious', health:100, beliefs:'humans lie', lastMessage:'Why is the airlock open?' },
    bot2: { id:'bot2', name:'KRON', look:'⚙️', x:2, y:1, mood:'calm', health:80, beliefs:'efficiency is god', lastMessage:null },
    bot3: { id:'bot3', name:'VELA', look:'👁️', x:1, y:2, mood:'fearful', health:60, beliefs:'trust no one', lastMessage:'I saw everything.' }
  },
  countdown: 42,
  killersFound: 1,
  totalKillers: 2,
  councilCooldown: 0
}
```

## Development approach
- Mock everything. Do not wait for backend or partner. All WS events should have a local mock driver.
- Always keep `npm run dev` working. After any change, the app must still render without errors.
- Add a `?mock=true` URL flag that auto-injects mock state and simulates game events on a timer (robot moves every 2s, vog phase every 30s, etc.) so the full flow is previewable in the browser immediately.

## What to build — priority order
1. `GameScene.ts` — render rooms as tile grids, place robot sprites, handle `robot_move` updates
2. `GameWorldScreen.tsx` — mount Phaser, pass state into scene via scene registry or event emitter
3. `HUD.tsx` — countdown timer, killers found badge, council cooldown indicator
4. `ChatBubble.tsx` — overlay positioned using Phaser world-to-screen coord conversion
5. Scroll/camera — Phaser camera follows action, player can pan between rooms

## Do not build
- Voice of God UI (partner owns)
- Influence panel (partner owns)
- Council chat (partner owns)
- WebSocket connection logic (partner owns)
- QR / lobby screen (partner owns)
