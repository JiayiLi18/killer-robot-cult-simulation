import { useEffect, useRef, useState, useMemo } from 'react'
import { GameState } from '../types'

// Distinct colors for robot names in the log
const ROBOT_COLORS = [
  '#60a5fa', // blue
  '#f97316', // orange
  '#4ade80', // green
  '#f472b6', // pink
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#fb7185', // rose
  '#34d399', // emerald
  '#c084fc', // purple
  '#f87171', // red
  '#38bdf8', // sky
  '#a3e635', // lime
  '#e879f9', // fuchsia
  '#fdba74', // light orange
  '#67e8f9', // light cyan
]

export type LogEntry = {
  id: number
  tick: number
  type: 'talk' | 'kill' | 'move' | 'vog' | 'council' | 'system'
  // Segments: plain text or { name, color } for colored robot names
  segments: LogSegment[]
}

type LogSegment = string | { name: string; color: string }

let nextId = 0

function getRobotColorMap(robots: Record<string, { name: string }>): Map<string, string> {
  const map = new Map<string, string>()
  const names = Object.values(robots).map(r => r.name)
  names.sort() // stable order
  names.forEach((name, i) => {
    map.set(name, ROBOT_COLORS[i % ROBOT_COLORS.length])
  })
  return map
}

export function useEventLog(state: GameState) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const prevRef = useRef<GameState | null>(null)
  const colorMapRef = useRef<Map<string, string>>(new Map())

  // Update color map when robots change
  const robotKeys = Object.keys(state.robots).sort().join(',')
  useMemo(() => {
    colorMapRef.current = getRobotColorMap(state.robots)
  }, [robotKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  const colorOf = (name: string): string => colorMapRef.current.get(name) ?? '#9ca3af'

  const nameSegment = (name: string): LogSegment => ({ name, color: colorOf(name) })

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state

    if (!prev || state.phase === 'lobby' || state.phase === 'setup') return

    const newEntries: LogEntry[] = []

    // Detect new room messages (conversations)
    if (state.roomMessages) {
      const prevMessages = prev.roomMessages ?? {}
      for (const [roomId, msgs] of Object.entries(state.roomMessages)) {
        const prevMsgs = prevMessages[roomId] ?? []
        const prevTicks = new Set(prevMsgs.map(m => `${m.from}:${m.tick}:${m.message}`))
        for (const msg of msgs) {
          const key = `${msg.from}:${msg.tick}:${msg.message}`
          if (!prevTicks.has(key)) {
            const roomName = state.map.find(r => r.id === roomId)?.name ?? roomId
            newEntries.push({
              id: nextId++,
              tick: msg.tick,
              type: 'talk',
              segments: [`[${roomName}] `, nameSegment(msg.fromName), `: ${msg.message}`],
            })
          }
        }
      }
    }

    // Detect kills (alive -> dead)
    for (const [id, robot] of Object.entries(state.robots)) {
      const prevRobot = prev.robots[id]
      if (!prevRobot) continue

      if (prevRobot.status === 'alive' && robot.status === 'dead') {
        const roomName = state.map.find(r => r.id === robot.roomId)?.name ?? ''
        newEntries.push({
          id: nextId++,
          tick: state.tick,
          type: 'kill',
          segments: [nameSegment(robot.name), ` was killed in ${roomName}!`],
        })
      }

      if (prevRobot.status === 'alive' && robot.status === 'ejected') {
        const ejection = state.ejections?.find(e => e.name === robot.name)
        const roleText = ejection
          ? (ejection.wasKiller ? ' (KILLER!)' : ' (innocent)')
          : ''
        newEntries.push({
          id: nextId++,
          tick: state.tick,
          type: 'council',
          segments: [nameSegment(robot.name), ` was ejected${roleText}`],
        })
      }

      // Detect movement
      if (prevRobot.roomId !== robot.roomId && robot.status === 'alive') {
        const toRoom = state.map.find(r => r.id === robot.roomId)?.name ?? ''
        newEntries.push({
          id: nextId++,
          tick: state.tick,
          type: 'move',
          segments: [nameSegment(robot.name), ` moved to ${toRoom}`],
        })
      }
    }

    // Detect VoG announcement
    if (state.voiceOfGod?.winnerWords && !prev.voiceOfGod?.winnerWords) {
      newEntries.push({
        id: nextId++,
        tick: state.tick,
        type: 'vog',
        segments: [`Voice of God: "${state.voiceOfGod.winnerWords}"`],
      })
    }

    // Detect council deliberation messages
    if (state.council?.messages && prev.council?.messages) {
      const prevCount = prev.council.messages.length
      for (let i = prevCount; i < state.council.messages.length; i++) {
        const msg = state.council.messages[i]
        const name = state.robots[msg.agentId]?.name ?? msg.agentId.slice(0, 6)
        newEntries.push({
          id: nextId++,
          tick: msg.tick,
          type: 'council',
          segments: [nameSegment(name), `: ${msg.message}`],
        })
      }
    }

    // Detect council votes
    if (state.council?.votes && prev.council?.votes) {
      const prevVotes = prev.council.votes
      for (const [voterId, targetId] of Object.entries(state.council.votes)) {
        if (!prevVotes[voterId]) {
          const voterName = state.robots[voterId]?.name ?? voterId.slice(0, 6)
          if (targetId === 'skip') {
            newEntries.push({
              id: nextId++,
              tick: state.tick,
              type: 'council',
              segments: [nameSegment(voterName), ' voted to skip'],
            })
          } else {
            const targetName = state.robots[targetId]?.name ?? targetId.slice(0, 6)
            newEntries.push({
              id: nextId++,
              tick: state.tick,
              type: 'council',
              segments: [nameSegment(voterName), ' voted to eject ', nameSegment(targetName)],
            })
          }
        }
      }
    }

    // Detect phase changes
    if (prev.phase !== state.phase) {
      if (state.phase === 'council') {
        newEntries.push({
          id: nextId++,
          tick: state.tick,
          type: 'council',
          segments: ['Council has been called!'],
        })
      }
      if (prev.phase === 'council' && state.phase !== 'council') {
        // Check if someone was ejected (detected separately via status change)
        const ejected = Object.values(state.robots).find(r => {
          const pr = prev.robots[r.id]
          return pr && pr.status === 'alive' && r.status === 'ejected'
        })
        if (!ejected) {
          newEntries.push({
            id: nextId++,
            tick: state.tick,
            type: 'council',
            segments: ['Council ended — no one was ejected.'],
          })
        }
        newEntries.push({
          id: nextId++,
          tick: state.tick,
          type: 'system',
          segments: ['Council adjourned.'],
        })
      }
      if (state.phase === 'ended') {
        const killersWon = state.killersFound < state.totalKillers
        newEntries.push({
          id: nextId++,
          tick: state.tick,
          type: 'system',
          segments: [killersWon ? 'GAME OVER \u2014 Killers win!' : 'GAME OVER \u2014 Crew wins!'],
        })
      }
    }

    // Grace period ending
    if (prev.gracePeriodRemaining > 0 && state.gracePeriodRemaining === 0) {
      newEntries.push({
        id: nextId++,
        tick: state.tick,
        type: 'system',
        segments: ['Grace period ended. Killers can now strike.'],
      })
    }

    if (newEntries.length > 0) {
      setEntries(e => [...e, ...newEntries].slice(-100))
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return entries
}

const TYPE_BASE_STYLE: Record<LogEntry['type'], string> = {
  talk:    '',
  kill:    'font-bold',
  move:    'text-gray-500',
  vog:     'text-purple-300 font-bold',
  council: 'text-yellow-300',
  system:  'text-gray-400 italic',
}

function renderSegments(segments: LogSegment[], type: LogEntry['type']) {
  return segments.map((seg, i) => {
    if (typeof seg === 'string') {
      // For talk type, message part is light gray; for others use type color
      const cls = type === 'talk' ? 'text-gray-400' : ''
      return <span key={i} className={cls}>{seg}</span>
    }
    return <span key={i} style={{ color: seg.color, fontWeight: 600 }}>{seg.name}</span>
  })
}

interface EventLogProps {
  entries: LogEntry[]
}

export function EventLog({ entries }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  if (entries.length === 0) return null

  return (
    <div
      className="absolute top-12 left-0 bottom-0 w-72 pointer-events-auto overflow-hidden flex flex-col"
      style={{ zIndex: 101 }}
    >
      <div
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin"
        style={{ background: 'rgba(6,6,14,0.75)', borderRight: '1px solid rgba(80,60,140,0.2)' }}
      >
        {entries.map(entry => (
          <div key={entry.id} className={`flex gap-2 text-[11px] font-mono leading-tight ${TYPE_BASE_STYLE[entry.type]}`}>
            <span className="text-gray-600 shrink-0 tabular-nums">{entry.tick}</span>
            <span>{renderSegments(entry.segments, entry.type)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
