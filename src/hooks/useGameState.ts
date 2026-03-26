import { useState, useEffect, useRef, useCallback } from 'react'
import { GameState, Robot, RoomData } from '../types'
import { mockState } from '../mockState'

function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)) }
function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

const MOCK_MESSAGES = [
  'Why is the airlock open?', 'I saw everything.', 'Trust no one.',
  'The logs were deleted.', 'Something is wrong.', 'Who did this?',
  'I have a bad feeling.', null, null, null,
]

// Convert backend GameState (rooms field) to frontend GameState (map field)
function normalizeState(raw: Record<string, unknown>): GameState {
  const rooms = (raw.rooms ?? raw.map) as RoomData[]
  return {
    phase: raw.phase as GameState['phase'],
    map: rooms,
    robots: raw.robots as Record<string, Robot>,
    countdown: raw.countdown as number,
    killersFound: raw.killersFound as number,
    totalKillers: raw.totalKillers as number,
    councilCooldown: raw.councilCooldown as number,
    roomMessages: raw.roomMessages as GameState['roomMessages'],
  }
}

export interface GameActions {
  setPhase:           (phase: GameState['phase']) => void
  setCountdown:       (n: number) => void
  setCouncilCooldown: (n: number) => void
  addRobot:           (robot: Omit<Robot, 'id'>) => void
  updateRobot:        (id: string, updates: Partial<Robot>) => void
  removeRobot:        (id: string) => void
  moveRobot:          (id: string, roomId: string) => void
  appendBeliefs:      (id: string, text: string) => void
  triggerVog:         (message: string) => void
}

// ─── Mock mode (default) ─────────────────────────────────────────────────────

function useMockState(): { state: GameState; actions: GameActions } {
  const [state, setState] = useState<GameState>(() => deepClone(mockState))
  const ref = useRef<GameState>(deepClone(mockState))

  const update = useCallback((fn: (s: GameState) => GameState) => {
    const next = fn(deepClone(ref.current))
    ref.current = next
    setState(deepClone(next))
  }, [])

  useEffect(() => {
    const countdownTimer = setInterval(() => {
      update(s => {
        if (s.phase !== 'playing') return s
        if (s.countdown <= 1) {
          const robots = { ...s.robots }
          Object.keys(robots).forEach(id => {
            if (robots[id].status === 'alive') {
              const prev = robots[id].beliefs
              robots[id] = { ...robots[id], beliefs: prev ? `${prev} · [VoG]` : '[VoG]' }
            }
          })
          return { ...s, countdown: 30, phase: 'vog', robots }
        }
        return { ...s, countdown: s.countdown - 1 }
      })
    }, 1000)

    const vogRestoreTimer = setInterval(() => {
      update(s => s.phase === 'vog' ? { ...s, phase: 'playing' } : s)
    }, 10000)

    const cooldownTimer = setInterval(() => {
      update(s => s.councilCooldown > 0 ? { ...s, councilCooldown: s.councilCooldown - 1 } : s)
    }, 1000)

    const moveTimer = setInterval(() => {
      update(s => {
        const alive = Object.values(s.robots).filter(r => r.status === 'alive')
        if (!alive.length) return s
        const robot = pickRandom(alive)
        const currentRoom = s.map.find(r => r.id === robot.roomId)
        if (!currentRoom || !currentRoom.connections.length) return s
        const nextRoomId = pickRandom(currentRoom.connections)
        const map = s.map.map(r => ({
          ...r,
          robots: r.id === nextRoomId
            ? (r.robots.includes(robot.id) ? r.robots : [...r.robots, robot.id])
            : r.robots.filter(id => id !== robot.id),
        }))
        const msg = Math.random() < 0.35 ? pickRandom(MOCK_MESSAGES) : robot.lastMessage
        return {
          ...s, map,
          robots: { ...s.robots, [robot.id]: { ...robot, roomId: nextRoomId, lastMessage: msg } },
        }
      })
    }, 2000)

    return () => {
      clearInterval(countdownTimer)
      clearInterval(vogRestoreTimer)
      clearInterval(cooldownTimer)
      clearInterval(moveTimer)
    }
  }, [update])

  const actions: GameActions = {
    setPhase: phase => update(s => ({ ...s, phase })),
    setCountdown: n => update(s => ({ ...s, countdown: n })),
    setCouncilCooldown: n => update(s => ({ ...s, councilCooldown: n })),

    addRobot: robot => update(s => {
      const id = `bot_${Date.now()}`
      const roomId = robot.roomId || s.map[0].id
      return {
        ...s,
        map: s.map.map(r => ({ ...r, robots: r.id === roomId ? [...r.robots, id] : r.robots })),
        robots: { ...s.robots, [id]: { ...robot, id, roomId } },
      }
    }),

    updateRobot: (id, updates) => update(s => ({
      ...s, robots: { ...s.robots, [id]: { ...s.robots[id], ...updates } },
    })),

    removeRobot: id => update(s => {
      const { [id]: _, ...rest } = s.robots
      return { ...s, robots: rest, map: s.map.map(r => ({ ...r, robots: r.robots.filter(rid => rid !== id) })) }
    }),

    moveRobot: (id, roomId) => update(s => ({
      ...s,
      map: s.map.map(r => ({
        ...r,
        robots: r.id === roomId
          ? (r.robots.includes(id) ? r.robots : [...r.robots, id])
          : r.robots.filter(rid => rid !== id),
      })),
      robots: { ...s.robots, [id]: { ...s.robots[id], roomId } },
    })),

    appendBeliefs: (id, text) => update(s => {
      const prev = s.robots[id]?.beliefs ?? ''
      return { ...s, robots: { ...s.robots, [id]: { ...s.robots[id], beliefs: prev ? `${prev} · ${text}` : text } } }
    }),

    triggerVog: message => {
      update(s => {
        const robots = { ...s.robots }
        Object.keys(robots).forEach(id => {
          if (robots[id].status === 'alive') {
            const prev = robots[id].beliefs
            robots[id] = { ...robots[id], beliefs: prev ? `${prev} · ${message}` : message }
          }
        })
        return { ...s, phase: 'vog', countdown: 30, robots }
      })
    },
  }

  return { state, actions }
}

// ─── WebSocket mode ───────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
const GOD_ID  = `god_${Math.random().toString(36).slice(2, 8)}`

function useWsState(): { state: GameState; actions: GameActions; connected: boolean } {
  const [state, setState] = useState<GameState>(() => deepClone(mockState))
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => {
    let ws: WebSocket
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        // Auto-join so we can send whispers/vog
        ws.send(JSON.stringify({ type: 'join', godId: GOD_ID }))
      }

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'state') {
          setState(normalizeState(msg.data))
        }
      }

      ws.onerror = () => { /* close handler will reconnect */ }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Attempt reconnect after 3s
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [])

  // In WS mode, admin actions that change game state are no-ops
  // (server is authoritative). Whisper/VoG translate to WS messages.
  const actions: GameActions = {
    setPhase:           () => { /* server controls phase */ },
    setCountdown:       () => { /* server controls countdown */ },
    setCouncilCooldown: () => { /* server controls cooldown */ },
    addRobot:           () => { /* use server API */ },
    updateRobot:        () => { /* use server API */ },
    removeRobot:        () => { /* use server API */ },
    moveRobot:          () => { /* server controls movement */ },
    appendBeliefs: (id, text) => send({ type: 'whisper', godId: GOD_ID, targetRobotId: id, words: text }),
    triggerVog:    (message)  => send({ type: 'submitVog', godId: GOD_ID, words: message }),
  }

  return { state, actions, connected }
}

// ─── Auto-select mode based on VITE_WS_URL env var or ?live param ─────────────

export function useGameState(): { state: GameState; actions: GameActions; wsConnected?: boolean } {
  const useLive = typeof window !== 'undefined'
    && (new URLSearchParams(window.location.search).has('live')
        || import.meta.env.VITE_WS_URL)

  // Always call both hooks (Rules of Hooks); only expose the active one
  const mock = useMockState()
  const ws   = useWsState()

  if (useLive) return { state: ws.state, actions: ws.actions, wsConnected: ws.connected }
  return { state: mock.state, actions: mock.actions }
}
