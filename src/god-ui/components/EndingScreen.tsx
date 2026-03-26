import { Overlay } from './shared/Overlay'

interface EndingScreenProps {
  killersFound: number
  totalKillers: number
  onPlayAgain: () => void
}

export function EndingScreen({ killersFound, totalKillers, onPlayAgain }: EndingScreenProps) {
  const isGodsWin = killersFound >= totalKillers

  return (
    <Overlay visible={true}>
      <div className="bg-surface border border-gray-700 rounded-xl p-8 text-center">
        <h1
          className={`text-3xl md:text-4xl font-mono font-bold mb-4 ${
            isGodsWin ? 'text-accent-cyan' : 'text-accent-red'
          }`}
          style={{
            textShadow: isGodsWin
              ? '0 0 20px rgba(6,182,212,0.4)'
              : '0 0 20px rgba(239,68,68,0.4)',
          }}
        >
          {isGodsWin ? 'The Gods Prevailed' : 'The Killer Escapes'}
        </h1>
        <p className="text-gray-400 font-mono text-sm mb-6">
          {isGodsWin
            ? 'All killer robots have been identified and ejected.'
            : 'The killer robot accomplished its dark mission.'}
        </p>
        <div className="flex justify-center gap-4 mb-6">
          <div className="px-3 py-2 bg-gray-900/60 rounded-lg border border-gray-800">
            <p className="text-gray-500 text-xs font-mono">Killers Found</p>
            <p className="text-white text-lg font-mono font-bold">{killersFound}/{totalKillers}</p>
          </div>
        </div>
        <button
          onClick={onPlayAgain}
          className="px-6 py-3 bg-accent-purple/20 text-accent-purple border border-accent-purple/40 rounded-lg font-mono font-bold hover:bg-accent-purple/30 transition-colors"
        >
          Play Again
        </button>
      </div>
    </Overlay>
  )
}
