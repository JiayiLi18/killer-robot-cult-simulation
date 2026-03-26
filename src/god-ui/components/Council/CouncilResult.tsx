import { Overlay } from '../shared/Overlay'
import type { CouncilResult as CouncilResultType } from '../../types/godUI'
import type { Robot } from '../../../types'

interface CouncilResultProps {
  result: CouncilResultType
  robots: Record<string, Robot>
  onContinue: () => void
}

export function CouncilResult({ result, robots, onContinue }: CouncilResultProps) {
  const ejectedRobot = result.ejected ? robots[result.ejected] : null

  return (
    <Overlay visible={true}>
      <div className="bg-surface border border-gray-700 rounded-xl p-8 text-center">
        {ejectedRobot ? (
          <>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-accent-purple/20 border-3 border-accent-purple/50 flex items-center justify-center text-2xl">
              {ejectedRobot.look}
            </div>
            <h2 className="text-2xl font-mono font-bold text-white mb-2">
              {ejectedRobot.name} was ejected
            </h2>
            <p className={`text-lg font-mono ${result.wasKiller ? 'text-emerald-400' : 'text-accent-red'}`}>
              {result.wasKiller ? 'They were the KILLER!' : 'They were innocent...'}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-mono font-bold text-white mb-2">No Consensus</h2>
            <p className="text-gray-400 font-mono">The council could not agree. No one was ejected.</p>
          </>
        )}
        <button
          onClick={onContinue}
          className="mt-6 px-6 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg font-mono hover:bg-accent-cyan/30 transition-colors"
        >
          Continue
        </button>
      </div>
    </Overlay>
  )
}
