import { useEffect, useRef } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { CountdownRing } from '../shared/CountdownRing'
import { CouncilVote } from './CouncilVote'
import type { CouncilMessage, Nominee } from '../../types/godUI'
import type { Robot } from '../../../types'

interface CouncilChatProps {
  messages: CouncilMessage[]
  nominees: Nominee[]
  myVote?: string
  robots: Record<string, Robot>
  onVote: (robotId: string) => void
}

export function CouncilChat({ messages, nominees, myVote, robots, onVote }: CouncilChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const timer = useTimer(60)

  useEffect(() => { timer.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const getRobotName = (agentId: string) => robots[agentId]?.name ?? agentId

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-surface/90">
        <h2 className="text-accent-red font-mono font-bold uppercase tracking-widest">
          Emergency Council
        </h2>
        <CountdownRing duration={60} remaining={timer.remaining} size={48} color="#ef4444" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const robotName = getRobotName(msg.agentId)
          return (
            <div key={i} className="flex items-start gap-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-accent-purple/20 border-2 border-accent-purple/40 text-accent-purple">
                {robotName.charAt(0)}
              </div>
              <div>
                <span className="font-mono text-xs text-accent-purple">{robotName}</span>
                <p className="text-gray-200 text-sm mt-0.5">{msg.message}</p>
              </div>
            </div>
          )
        })}
        {messages.length === 0 && (
          <p className="text-gray-600 font-mono text-sm text-center py-8">The robots are gathering...</p>
        )}
      </div>

      <CouncilVote nominees={nominees} myVote={myVote} onVote={onVote} />
    </div>
  )
}
