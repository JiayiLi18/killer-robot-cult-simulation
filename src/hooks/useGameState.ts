import { useState, useEffect, useRef, useCallback } from 'react'
import { GameState, Robot, RoomData } from '../types'

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
    lobby: raw.lobby as GameState['lobby'],
  }
}

const EMPTY_STATE: GameState = {
  phase: 'lobby',
  map: [],
  robots: {},
  countdown: 0,
  killersFound: 0,
  totalKillers: 0,
  councilCooldown: 0,
}

export interface GameActions {
  // Lobby
  joinLobby:      (name: string) => void
  defineRobot:    (name: string, look: string, identity: string) => void
  // In-game
  whisper:        (robotId: string, words: string) => void
  submitVog:      (words: string) => void
  voteVog:        (forGodId: string) => void
  voteCouncil:    (targetRobotId: string) => void
}

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
const GOD_ID = `god_${Math.random().toString(36).slice(2, 8)}`

export function useGameState(): {
  state: GameState
  actions: GameActions
  connected: boolean
  godId: string
  roomCode: string | null
} {
  const [state, setState] = useState<GameState>(EMPTY_STATE)
  const [connected, setConnected] = useState(false)
  const [roomCode, setRoomCode] = useState<string | null>(null)
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
      }

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'state') {
          setState(normalizeState(msg.data))
        } else if (msg.type === 'roomInfo') {
          setRoomCode(msg.roomCode)
        }
      }

      ws.onerror = () => { /* close handler will reconnect */ }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimeout)
      ws?.close()
    }
  }, [])

  const actions: GameActions = {
    joinLobby: (name) => send({ type: 'join', godId: GOD_ID, name }),
    defineRobot: (name, look, identity) => send({ type: 'defineRobot', godId: GOD_ID, name, look, identity }),
    whisper: (robotId, words) => send({ type: 'whisper', godId: GOD_ID, targetRobotId: robotId, words }),
    submitVog: (words) => send({ type: 'submitVog', godId: GOD_ID, words }),
    voteVog: (forGodId) => send({ type: 'voteVog', godId: GOD_ID, forGodId }),
    voteCouncil: (targetRobotId) => send({ type: 'voteCouncil', godId: GOD_ID, targetAgentId: targetRobotId }),
  }

  return { state, actions, connected, godId: GOD_ID, roomCode }
}
