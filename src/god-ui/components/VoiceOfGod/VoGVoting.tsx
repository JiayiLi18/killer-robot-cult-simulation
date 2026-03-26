import { useEffect } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { CountdownRing } from '../shared/CountdownRing'
import type { VoiceOfGodEntry } from '../../types/godUI'

interface VoGVotingProps {
  submissions: VoiceOfGodEntry[]
  myVote?: string
  onVote: (godId: string) => void
}

export function VoGVoting({ submissions, myVote, onVote }: VoGVotingProps) {
  const timer = useTimer(30)

  useEffect(() => { timer.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timer.remaining === 0 && !myVote && submissions.length > 0) {
      const randomSub = submissions[Math.floor(Math.random() * submissions.length)]
      onVote(randomSub.godId)
    }
  }, [timer.remaining, myVote, submissions, onVote])

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
      <div className="bg-surface/95 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-accent-purple font-mono text-sm font-bold uppercase tracking-widest">
            Vote for the Voice
          </h3>
          <CountdownRing duration={30} remaining={timer.remaining} size={40} color="#8b5cf6" />
        </div>
        <div className="space-y-2">
          {submissions.map((sub) => (
            <button
              key={sub.godId}
              onClick={() => onVote(sub.godId)}
              disabled={!!myVote}
              className={`w-full px-4 py-3 rounded-lg font-mono text-sm text-left transition-all border ${
                myVote === sub.godId
                  ? 'bg-accent-purple/20 border-accent-purple text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                  : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
              } disabled:cursor-default`}
            >
              "{sub.words}"
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
