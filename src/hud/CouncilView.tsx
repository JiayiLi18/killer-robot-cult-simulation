import { GameState } from '../types'

interface Props {
  state: GameState
  onEnd: () => void
}

export function CouncilView({ state, onEnd }: Props) {
  const alive = Object.values(state.robots).filter(r => r.status === 'alive')

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(8,4,18,0.98)' }}>
      {/* Header */}
      <div className="flex items-center justify-center gap-3 py-5 border-b"
        style={{ borderColor: 'rgba(180,40,40,0.4)' }}>
        <span className="text-2xl font-bold text-red-300 tracking-widest uppercase">⚖ Council</span>
        <span className="text-xs text-red-600 border border-red-900 px-2 py-0.5 rounded-full uppercase tracking-wider">In Session</span>
      </div>

      {/* Placeholder chat area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 overflow-y-auto">
        <div className="w-full max-w-md space-y-3">
          {/* Robot list with status */}
          {alive.map(robot => (
            <div key={robot.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(30,20,50,0.7)', border: '1px solid rgba(80,60,140,0.3)' }}>
              <img src={robot.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${robot.id}`}
                alt={robot.name}
                className="w-10 h-10 rounded-full bg-gray-800 object-cover border border-gray-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{robot.look} {robot.name}</div>
                <div className="text-xs text-gray-400">{robot.identity}</div>
              </div>
              {robot.beliefs && (
                <div className="text-xs text-purple-400 max-w-[120px] truncate" title={robot.beliefs}>
                  ✦ {robot.beliefs}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Placeholder chat */}
        <div className="w-full max-w-md rounded-xl p-4 text-center"
          style={{ background: 'rgba(20,15,35,0.8)', border: '1px solid rgba(80,60,140,0.2)' }}>
          <div className="text-gray-500 text-sm mb-1">[ Group chat placeholder ]</div>
          <div className="text-gray-600 text-xs">Council discussion UI goes here</div>
        </div>
      </div>

      {/* End button */}
      <div className="flex justify-center py-5 border-t"
        style={{ borderColor: 'rgba(180,40,40,0.3)' }}>
        <button
          onClick={onEnd}
          className="px-8 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'rgba(160,30,30,0.8)', color: '#ffaaaa', border: '1px solid rgba(200,60,60,0.4)' }}
        >
          End Council
        </button>
      </div>
    </div>
  )
}
