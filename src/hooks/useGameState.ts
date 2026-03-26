import { useState, useEffect, useRef, useCallback } from 'react'
import { GameState, Robot } from '../types'
import { mockState } from '../mockState'
import { ROOM_LAYOUTS } from '../worldMap'

function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)) }

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

const MOCK_MESSAGES = [
  'Why is the airlock open?', 'I saw everything.', 'Trust no one.',
  'The logs were deleted.', 'Something is wrong.', 'Who did this?',
  'I have a bad feeling.', null, null, null,
]

export interface GameActions {
  setPhase:           (phase: GameState['phase']) => void
  setCountdown:       (n: number) => void
  setCouncilCooldown: (n: number) => void
  addRobot:           (robot: Omit<Robot, 'id'>) => void
  updateRobot:        (id: string, updates: Partial<Robot>) => void
  removeRobot:        (id: string) => void
  moveRobot:          (id: string, roomId: string) => void   // ignores connections — admin only
  appendBeliefs:      (id: string, text: string) => void
  triggerVog:         (message: string) => void
}

export function useGameState(): { state: GameState; actions: GameActions } {
  const [state, setState] = useState<GameState>(() => deepClone(mockState))
  const ref = useRef<GameState>(deepClone(mockState))

  const update = useCallback((fn: (s: GameState) => GameState) => {
    const next = fn(deepClone(ref.current))
    ref.current = next
    setState(deepClone(next))
  }, [])

  useEffect(() => {
    // VoG countdown — ticks every second, auto-fires VoG at 0
    const countdownTimer = setInterval(() => {
      update(s => {
        if (s.phase !== 'playing') return { ...s, countdown: s.countdown }
        if (s.countdown <= 1) {
          // Auto-trigger VoG: append "[VoG]" to all alive robots' beliefs, reset to 30s
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

    // Restore playing phase 10s after VoG
    const vogRestoreTimer = setInterval(() => {
      update(s => s.phase === 'vog' ? { ...s, phase: 'playing' } : s)
    }, 10000)

    // Council cooldown ticker
    const cooldownTimer = setInterval(() => {
      update(s => s.councilCooldown > 0 ? { ...s, councilCooldown: s.councilCooldown - 1 } : s)
    }, 1000)

    // Robots move to adjacent rooms every 2s
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
