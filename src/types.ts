export type RoomData = {
  id: string
  name: string
  connections: string[]   // IDs of connected rooms
  robots: string[]        // robot IDs currently in this room
}

export type Robot = {
  id: string
  name: string
  look: string            // god prompt — appearance description / emoji
  identity: string        // god prompt — who this robot is
  beliefs: string         // concatenated whispers + voice of god messages
  status: 'alive' | 'dead' | 'ejected'
  roomId: string
  imageUrl: string
  lastMessage?: string | null   // shown as speech bubble (transient, display-only)
}

export type RoomMessage = {
  from: string
  fromName: string
  message: string
  tick: number
}

export type RobotSetup = {
  robotName: string
  robotIdentity: string
  robotLook: string
}

export type Player = {
  id: string
  name: string
  isHost: boolean
  isConnected: boolean
  isReady: boolean
  /** Live lobby: clicked ready before host starts */
  lobbyReady?: boolean
  robotSetup?: RobotSetup
}

export type LLMStats = {
  requests: number
  tokens: number
  errors: number
  estimatedCost: number
}

export type GameSummary = {
  winner: 'crew' | 'killers'
  duration: number
  kills: { victimName: string; killerName: string; tick: number }[]
  ejections: { name: string; wasKiller: boolean; tick: number }[]
  survivors: { name: string; role: string }[]
  killers: string[]
  narrative?: string
  llmCost: number
}

export type GameState = {
  phase: 'lobby' | 'setup' | 'playing' | 'vog' | 'council' | 'ended'
  tick: number
  map: RoomData[]
  robots: Record<string, Robot>
  countdown: number
  killersFound: number
  totalKillers: number
  councilCooldown: number
  gracePeriodRemaining: number
  llmStats?: LLMStats
  ejections?: { name: string; wasKiller: boolean; tick: number }[]
  summary?: GameSummary
  nextVogIn: number
  roomMessages?: Record<string, RoomMessage[]>
  // Backend-provided VoG round state
  voiceOfGod?: {
    selectedGods: string[]
    submissions: { godId: string; words: string; tick: number }[]
    phase: 'submission' | 'voting' | 'done'
    winnerWords?: string
  }
  // Backend-provided council state
  council?: {
    messages: { agentId: string; message: string; tick: number }[]
    votes: Record<string, string>
  }
  // God UI lobby state (client-only, managed by god-ui layer)
  lobby?: LobbyState
}

export type LobbyState = {
  roomId: string
  roomCode: string
  qrUrl: string
  players: Player[]
  isHost: boolean
}
