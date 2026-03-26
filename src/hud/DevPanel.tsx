import { useState } from 'react'
import { GameState, Robot } from '../types'
import { GameActions } from '../hooks/useGameState'
import { ROOM_LAYOUTS } from '../worldMap'

interface Props { state: GameState; actions: GameActions; onStartCouncil: () => void }

const PHASES: GameState['phase'][] = ['lobby', 'setup', 'playing', 'vog', 'council', 'ended']
const STATUSES: Robot['status'][] = ['alive', 'dead', 'ejected']
const LOOKS = ['🤖', '⚙️', '👁️', '🔧', '💡', '🛡️', '☠️', '🔬', '🧲', '🔩', '📡', '🎯']

function RobotRow({ robot, actions }: { robot: Robot; actions: GameActions }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Robot>>({})

  if (editing) {
    const m = { ...robot, ...draft }
    return (
      <div className="border border-gray-700 rounded-lg p-2 text-xs space-y-1.5 bg-gray-950">
        <div className="flex gap-1">
          <select value={m.look} onChange={e => setDraft(d => ({ ...d, look: e.target.value }))}
            className="bg-gray-800 text-white rounded px-1 w-12">
            {LOOKS.map(l => <option key={l}>{l}</option>)}
          </select>
          <input value={m.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            className="flex-1 bg-gray-800 text-white rounded px-2 py-0.5 min-w-0" placeholder="Name" />
        </div>
        <input value={m.identity} onChange={e => setDraft(d => ({ ...d, identity: e.target.value }))}
          className="w-full bg-gray-800 text-gray-300 rounded px-2 py-0.5" placeholder="Identity…" />
        <div className="flex gap-1">
          <select value={m.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as Robot['status'] }))}
            className="flex-1 bg-gray-800 text-white rounded px-1 py-0.5">
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={m.roomId} onChange={e => setDraft(d => ({ ...d, roomId: e.target.value }))}
            className="flex-1 bg-gray-800 text-white rounded px-1 py-0.5">
            {ROOM_LAYOUTS.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
          </select>
        </div>
        <textarea value={m.beliefs} onChange={e => setDraft(d => ({ ...d, beliefs: e.target.value }))}
          rows={2}
          className="w-full bg-gray-800 text-gray-300 rounded px-2 py-1 resize-none text-xs" placeholder="Beliefs…" />
        <input value={m.imageUrl} onChange={e => setDraft(d => ({ ...d, imageUrl: e.target.value }))}
          className="w-full bg-gray-800 text-gray-400 rounded px-2 py-0.5 text-xs" placeholder="imageUrl…" />
        <div className="flex gap-1 pt-0.5">
          <button onClick={() => {
            actions.updateRobot(robot.id, draft)
            // If roomId changed, also move in map
            if (draft.roomId && draft.roomId !== robot.roomId) actions.moveRobot(robot.id, draft.roomId)
            setEditing(false); setDraft({})
          }} className="flex-1 bg-blue-800 hover:bg-blue-700 text-white rounded py-0.5">Save</button>
          <button onClick={() => { setEditing(false); setDraft({}) }}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded py-0.5">Cancel</button>
          <button onClick={() => actions.removeRobot(robot.id)}
            className="bg-red-900 hover:bg-red-800 text-red-200 rounded px-2 py-0.5">✕</button>
        </div>
      </div>
    )
  }

  const statusColor = { alive: 'text-green-400', dead: 'text-gray-500', ejected: 'text-orange-400' }[robot.status]
  return (
    <div className="flex items-center gap-1.5 border border-gray-800 rounded-lg px-2 py-1.5 hover:border-gray-600 group cursor-default">
      {robot.imageUrl
        ? <img src={robot.imageUrl} alt={robot.name} className="w-7 h-7 rounded-full bg-gray-800 object-cover border border-gray-700 shrink-0" />
        : <span className="text-base w-7 text-center shrink-0">{robot.look}</span>
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white truncate">{robot.name}
          <span className="ml-1 text-gray-500 font-normal">{robot.identity}</span>
        </div>
        <div className={`text-xs truncate ${statusColor}`}>{robot.status} · {robot.roomId}</div>
      </div>
      {robot.beliefs && <span className="text-purple-400 text-xs shrink-0" title={robot.beliefs}>✦</span>}
      <button onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white text-xs transition-opacity shrink-0">✎</button>
    </div>
  )
}

function AddRobotForm({ actions }: { actions: GameActions }) {
  const [open, setOpen] = useState(false)
  const [look, setLook] = useState('🤖')
  const [name, setName] = useState('')
  const [identity, setIdentity] = useState('')
  const [roomId, setRoomId] = useState(ROOM_LAYOUTS[0].id)
  const [imageUrl, setImageUrl] = useState('')

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full text-xs text-green-400 border border-green-900 hover:border-green-600 rounded-lg py-1.5 transition-colors">
      + Add Robot
    </button>
  )

  const submit = () => {
    if (!name.trim()) return
    actions.addRobot({
      name: name.trim(), look, identity: identity || 'Unknown',
      beliefs: '', status: 'alive', roomId,
      imageUrl: imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
    })
    setName(''); setIdentity(''); setImageUrl(''); setOpen(false)
  }

  return (
    <div className="border border-green-900 rounded-lg p-2 text-xs space-y-1.5 bg-gray-950">
      <div className="text-xs font-bold text-green-400">New Robot</div>
      <div className="flex gap-1">
        <select value={look} onChange={e => setLook(e.target.value)}
          className="bg-gray-800 text-white rounded px-1 w-12">
          {LOOKS.map(l => <option key={l}>{l}</option>)}
        </select>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
          className="flex-1 bg-gray-800 text-white rounded px-2 py-0.5 min-w-0" />
      </div>
      <input value={identity} onChange={e => setIdentity(e.target.value)} placeholder="Identity (e.g. Chief Engineer)"
        className="w-full bg-gray-800 text-gray-300 rounded px-2 py-0.5" />
      <div className="flex gap-1">
        <select value={roomId} onChange={e => setRoomId(e.target.value)}
          className="flex-1 bg-gray-800 text-white rounded px-1 py-0.5">
          {ROOM_LAYOUTS.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
        </select>
      </div>
      <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="imageUrl (optional)"
        className="w-full bg-gray-800 text-gray-400 rounded px-2 py-0.5 text-xs" />
      <div className="flex gap-1">
        <button onClick={submit} className="flex-1 bg-green-900 hover:bg-green-800 text-green-200 rounded py-0.5">Add</button>
        <button onClick={() => setOpen(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded py-0.5">Cancel</button>
      </div>
    </div>
  )
}

function VogForm({ actions }: { actions: GameActions }) {
  const [msg, setMsg] = useState('')
  const send = () => {
    if (!msg.trim()) return
    actions.triggerVog(msg.trim())
    setMsg('')
  }
  return (
    <div className="flex gap-1">
      <input value={msg} onChange={e => setMsg(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && send()}
        placeholder="VoG message → all beliefs"
        className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 min-w-0 focus:border-purple-600 outline-none" />
      <button onClick={send}
        className="bg-purple-900 hover:bg-purple-800 text-purple-200 text-xs rounded px-2 py-1 shrink-0">
        ✦ Send
      </button>
    </div>
  )
}

export function DevPanel({ state, actions, onStartCouncil }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full text-base shadow-lg transition-all"
        style={{
          background: open ? 'rgba(80,40,160,0.95)' : 'rgba(20,20,40,0.9)',
          border: '1px solid rgba(120,70,220,0.5)',
          color: '#bb99ff',
        }}
        title="Dev Panel"
      >⚙</button>

      {open && (
        <div className="fixed right-0 top-0 bottom-0 w-72 overflow-y-auto z-40 flex flex-col"
          style={{ background: 'rgba(6,6,14,0.98)', borderLeft: '1px solid rgba(80,50,150,0.4)' }}>
          <div className="sticky top-0 px-3 py-2.5 flex items-center justify-between shrink-0"
            style={{ background: 'rgba(10,8,24,0.99)', borderBottom: '1px solid rgba(80,50,150,0.3)' }}>
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Dev Panel</span>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">✕</button>
          </div>

          <div className="p-3 space-y-5 flex-1">
            {/* Game State */}
            <section className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Game State</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16 shrink-0">Phase</label>
                <select value={state.phase} onChange={e => actions.setPhase(e.target.value as GameState['phase'])}
                  className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1">
                  {PHASES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16 shrink-0">Countdown</label>
                <input type="number" value={state.countdown} min={0} max={999}
                  onChange={e => actions.setCountdown(Number(e.target.value))}
                  className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1" />
              </div>
            </section>

            {/* Voice of God */}
            <section className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Voice of God</div>
              <VogForm actions={actions} />
              <p className="text-xs text-gray-600">Triggers 10s overlay + appends message to all alive robots' beliefs</p>
            </section>

            {/* Quick phase actions */}
            <section className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quick Actions</div>
              <div className="grid grid-cols-2 gap-1">
                <button onClick={() => actions.setPhase('playing')}
                  className="text-xs py-1.5 rounded-lg bg-green-900 hover:bg-green-800 text-green-200">▶ Playing</button>
                <button
                  onClick={onStartCouncil}
                  disabled={state.councilCooldown > 0}
                  className="text-xs py-1.5 rounded-lg transition-colors"
                  style={{
                    background: state.councilCooldown > 0 ? 'rgba(60,20,20,0.5)' : 'rgba(140,30,30,0.8)',
                    color: state.councilCooldown > 0 ? '#804040' : '#ffaaaa',
                    cursor: state.councilCooldown > 0 ? 'not-allowed' : 'pointer',
                  }}>
                  {state.councilCooldown > 0 ? `⚖ CD ${state.councilCooldown}s` : '⚖ Council'}
                </button>
                <button onClick={() => actions.setPhase('ended')}
                  className="text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">■ End</button>
                <button onClick={() => actions.setPhase('lobby')}
                  className="text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">⏎ Lobby</button>
              </div>
            </section>

            {/* Robots */}
            <section className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Robots ({Object.keys(state.robots).length})
              </div>
              <div className="space-y-1.5">
                {Object.values(state.robots).map(r => (
                  <RobotRow key={r.id} robot={r} actions={actions} />
                ))}
                <AddRobotForm actions={actions} />
              </div>
            </section>

            {/* Map */}
            <section className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rooms</div>
              {state.map.map(room => (
                <div key={room.id} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-20 truncate">{room.name}</span>
                  <span className="text-gray-600">{room.robots.length} robots</span>
                  <span className="text-gray-700 text-xs truncate flex-1">{room.connections.join(', ')}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </>
  )
}
