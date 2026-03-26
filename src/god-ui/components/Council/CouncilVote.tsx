import type { Nominee } from '../../types/godUI'

interface CouncilVoteProps {
  nominees: Nominee[]
  myVote?: string
  onVote: (robotId: string) => void
}

export function CouncilVote({ nominees, myVote, onVote }: CouncilVoteProps) {
  return (
    <div className="border-t border-gray-800 bg-surface/90 p-3">
      <p className="text-gray-400 font-mono text-xs mb-2 uppercase tracking-widest">
        Vote to eject
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {nominees.map((nominee) => {
          const isSelected = myVote === nominee.robotId
          return (
            <button
              key={nominee.robotId}
              onClick={() => onVote(nominee.robotId)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg font-mono text-xs transition-all border ${
                isSelected
                  ? 'border-accent-red bg-accent-red/20 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="w-6 h-6 rounded-full mx-auto mb-1 bg-accent-purple/30 border-2 border-accent-purple/50" />
              {nominee.robotName}
            </button>
          )
        })}
      </div>
    </div>
  )
}
