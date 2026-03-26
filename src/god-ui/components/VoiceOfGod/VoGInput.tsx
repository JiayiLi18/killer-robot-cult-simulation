import { useEffect } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { ThreeWordInput } from '../shared/ThreeWordInput'
import { CountdownRing } from '../shared/CountdownRing'

interface VoGInputProps {
  isEligible: boolean
  mySubmission?: string
  onSubmit: (words: string) => void
}

export function VoGInput({ isEligible, mySubmission, onSubmit }: VoGInputProps) {
  const timer = useTimer(30)

  useEffect(() => { timer.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timer.remaining === 0 && !mySubmission && isEligible) {
      onSubmit('silence speaks volumes')
    }
  }, [timer.remaining, mySubmission, isEligible, onSubmit])

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
      <div className="bg-surface/95 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-accent-purple font-mono text-sm font-bold uppercase tracking-widest">
            Voice of God
          </h3>
          <CountdownRing duration={30} remaining={timer.remaining} size={40} color="#8b5cf6" />
        </div>
        {isEligible ? (
          mySubmission ? (
            <p className="text-gray-400 font-mono text-sm text-center py-2">
              Submitted: <span className="text-white">"{mySubmission}"</span>
            </p>
          ) : (
            <ThreeWordInput onSubmit={onSubmit} placeholder="Speak 3 words to the robots..." />
          )
        ) : (
          <p className="text-gray-500 font-mono text-sm text-center py-4 italic">
            The gods are deliberating...
          </p>
        )}
      </div>
    </div>
  )
}
