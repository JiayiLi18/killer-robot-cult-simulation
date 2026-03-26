import { useState, useEffect, useRef, useCallback } from 'react'
import { GameState, Robot, RoomData, Player, RobotSetup, LobbyState } from '../types'
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
    voiceOfGod: raw.voiceOfGod as GameState['voiceOfGod'],
    council: raw.council as GameState['council'],
    lobby: normalizeLobby(raw.lobby),
  }
}

function normalizeLobby(raw: unknown): GameState['lobby'] {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const playersRaw = o.players
  if (!Array.isArray(playersRaw)) return o as GameState['lobby']
  const players = playersRaw.map((p) => {
    const x = p as Record<string, unknown>
    return {
      id: String(x.id),
      name: String(x.name),
      isHost: Boolean(x.isHost),
      isConnected: Boolean(x.isConnected),
      isReady: Boolean(x.isReady),
      lobbyReady: Boolean(x.lobbyReady),
    } as Player
  })
  return {
    roomId: String(o.roomId ?? ''),
    roomCode: String(o.roomCode ?? ''),
    qrUrl: String(o.qrUrl ?? ''),
    players,
    isHost: Boolean(o.isHost),
  }
}

function createInitialLobby(): LobbyState {
  const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase()
  return {
    roomId: `room-${roomCode}`,
    roomCode,
    qrUrl: `${window.location.origin}/join/${roomCode}`,
    players: [],
    isHost: false,
  }
}

export interface GameActions {
  // Original partner actions
  setPhase:           (phase: GameState['phase']) => void
  setCountdown:       (n: number) => void
  setCouncilCooldown: (n: number) => void
  addRobot:           (robot: Omit<Robot, 'id'>) => void
  updateRobot:        (id: string, updates: Partial<Robot>) => void
  removeRobot:        (id: string) => void
  moveRobot:          (id: string, roomId: string) => void
  appendBeliefs:      (id: string, text: string) => void
  triggerVog:         (message: string) => void
  // God UI lobby actions
  joinRoom:           (name: string, roomCode?: string) => void
  setReady:           (robotSetup: RobotSetup) => void
  // Live lobby: mark ready before host starts (server-driven)
  setLobbyReady:      (ready: boolean) => void
  // Backend game control
  startGame:          () => void
  startSimulation:    () => void
  defineRobot:        (name: string, look: string, identity: string, imageUrl?: string) => void
  // VoG & council voting
  submitVog:          (words: string) => void
  voteVog:            (forGodId: string) => void
  voteCouncil:        (targetRobotId: string) => void
}

// ─── Mock mode (default) ─────────────────────────────────────────────────────

function useMockState(enabled: boolean): { state: GameState; actions: GameActions } {
  const [state, setState] = useState<GameState>(() => ({
    ...deepClone(mockState),
    phase: 'lobby' as const,
    lobby: createInitialLobby(),
  }))
  const ref = useRef<GameState>(state)
  ref.current = state

  const update = useCallback((fn: (s: GameState) => GameState) => {
    const next = fn(deepClone(ref.current))
    ref.current = next
    setState(deepClone(next))
  }, [])

  useEffect(() => {
    if (!enabled) return

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
        if (s.phase !== 'playing' && s.phase !== 'vog') return s
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
  }, [enabled, update])

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

    // Backend game control (no-ops in mock mode)
    startGame:       () => { /* mock: auto-started */ },
    startSimulation: () => { /* mock: auto-started */ },
    defineRobot:     () => { /* mock: use addRobot instead */ },
    submitVog:       () => { /* mock: use triggerVog instead */ },
    voteVog:         () => { /* mock: not applicable */ },
    voteCouncil:     () => { /* mock: not applicable */ },

    // God UI lobby actions
    setLobbyReady: () => {},

    joinRoom: (name, _roomCode) => update(s => {
      const playerId = `god_${Math.random().toString(36).slice(2, 8)}`
      const player: Player = {
        id: playerId,
        name,
        isHost: !s.lobby?.players.length,
        isConnected: true,
        isReady: false,
      }
      return {
        ...s,
        lobby: s.lobby ? {
          ...s.lobby,
          players: [...s.lobby.players, player],
          isHost: !s.lobby.players.length,
        } : undefined,
      }
    }),

    setReady: (_robotSetup) => update(s => {
      if (!s.lobby?.players.length) return s
      const players = s.lobby.players.map((p, i) =>
        i === s.lobby!.players.length - 1 ? { ...p, isReady: true, robotSetup: _robotSetup } : p
      )
      const allReady = players.length >= 2 && players.every(p => p.isReady)
      return {
        ...s,
        lobby: { ...s.lobby, players },
        phase: allReady ? 'playing' : s.phase,
      }
    }),
  }

  return { state, actions }
}

// ─── WebSocket mode ───────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
const GOD_ID_STORAGE_KEY = 'krc:godId'

/** Same tab session = same id after reload; new tab = new id */
function getOrCreateSessionGodId(): string {
  try {
    let id = sessionStorage.getItem(GOD_ID_STORAGE_KEY)
    if (!id) {
      id = `god_${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem(GOD_ID_STORAGE_KEY, id)
    }
    return id
  } catch {
    return `god_${Math.random().toString(36).slice(2, 8)}`
  }
}

function createInitialLiveState(): GameState {
  return {
    ...deepClone(mockState),
    phase: 'lobby',
    map: [],
    robots: {},
    countdown: 0,
    killersFound: 0,
    totalKillers: 0,
    councilCooldown: 0,
    roomMessages: {},
    lobby: createInitialLobby(),
  }
}

function useWsState(enabled: boolean): { state: GameState; actions: GameActions; connected: boolean; godId: string } {
  const [state, setState] = useState<GameState>(() => createInitialLiveState())
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const godIdRef = useRef<string | null>(null)
  if (godIdRef.current === null) {
    godIdRef.current = typeof window !== 'undefined' ? getOrCreateSessionGodId() : 'god_ssr'
  }
  const godId = godIdRef.current
  const defaultGodName = `God ${godId.slice(-4).toUpperCase()}`
  const playerNameRef = useRef(defaultGodName)
  const roomIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('room') || 'default')
      : 'default',
  )
  const pendingSendRef = useRef<object[]>([])

  const send = useCallback((msg: object) => {
    const sock = wsRef.current
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(msg))
      return
    }
    pendingSendRef.current.push(msg)
  }, [])

  const sendJoin = useCallback((name?: string) => {
    send({
      type: 'join',
      godId,
      name: name ?? playerNameRef.current,
      roomId: roomIdRef.current,
    })
  }, [send, godId])

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      wsRef.current = null
      return
    }

    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined
    let ws: WebSocket | undefined
    let disposed = false

    const connect = () => {
      if (disposed) return
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed) return
        setConnected(true)
        const openSocket = wsRef.current
        if (!openSocket) return
        const backlog = pendingSendRef.current.splice(0)
        for (const m of backlog) {
          try {
            openSocket.send(JSON.stringify(m))
          } catch {
            /* ignore */
          }
        }
      }

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'state') {
          setState(normalizeState(msg.data))
        } else if (msg.type === 'error' && import.meta.env.DEV) {
          console.warn('[ws]', (msg as { error?: string }).error)
        }
      }

      ws.onerror = () => { /* close handler will reconnect */ }

      ws.onclose = () => {
        wsRef.current = null
        setConnected(false)
        if (disposed) return
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      disposed = true
      pendingSendRef.current = []
      if (reconnectTimeout !== undefined) clearTimeout(reconnectTimeout)
      ws?.close()
      wsRef.current = null
    }
  }, [enabled])

  const actions: GameActions = {
    setPhase:           () => { /* server controls phase */ },
    setCountdown:       () => { /* server controls countdown */ },
    setCouncilCooldown: () => { /* server controls cooldown */ },
    addRobot:           () => { /* use defineRobot instead */ },
    updateRobot:        () => { /* server controls */ },
    removeRobot:        () => { /* server controls */ },
    moveRobot:          () => { /* server controls movement */ },
    appendBeliefs: (id, text) => send({ type: 'whisper', godId, targetRobotId: id, words: text }),
    triggerVog:    (message)  => send({ type: 'submitVog', godId, words: message }),
    joinRoom:      (name, roomCode) => {
      if (roomCode !== undefined) {
        const code = roomCode.trim() || 'default'
        roomIdRef.current = code
        if (typeof window !== 'undefined') {
          const u = new URL(window.location.href)
          u.searchParams.set('room', code)
          window.history.replaceState(null, '', u.toString())
        }
      }
      playerNameRef.current = name.trim() || defaultGodName
      sendJoin(playerNameRef.current)
    },
    setLobbyReady: (ready) => {
      send({ type: 'lobbyReady', godId, ready })
    },
    setReady:      (setup)    => {
      send({ type: 'defineRobot', godId, name: setup.robotName, look: setup.robotLook, identity: setup.robotIdentity })
    },
    // Backend game control
    startGame:       ()                          => send({ type: 'startGame', godId }),
    startSimulation: ()                          => send({ type: 'startSimulation', godId }),
    defineRobot:     (name, look, identity, imageUrl) => send({ type: 'defineRobot', godId, name, look, identity, imageUrl }),
    // VoG & council voting
    submitVog:       (words)          => send({ type: 'submitVog', godId, words }),
    voteVog:         (forGodId)       => send({ type: 'voteVog', godId, forGodId }),
    voteCouncil:     (targetRobotId)  => send({ type: 'voteCouncil', godId, targetAgentId: targetRobotId }),
  }

  return { state, actions, connected, godId }
}

// ─── Live server: opt in with ?live or VITE_WS_URL (otherwise mock, no WebSocket) ─

export function useGameState(): { state: GameState; actions: GameActions; wsConnected?: boolean; currentGodId?: string } {
  const useLive = typeof window !== 'undefined'
    && (new URLSearchParams(window.location.search).has('live')
      || Boolean(import.meta.env.VITE_WS_URL))

  // Always call both hooks (Rules of Hooks); only expose the active one
  const mock = useMockState(!useLive)
  const ws   = useWsState(useLive)

  if (useLive) return { state: ws.state, actions: ws.actions, wsConnected: ws.connected, currentGodId: ws.godId }
  return { state: mock.state, actions: mock.actions }
}
