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
  robotSetup?: RobotSetup
}

export type GameState = {
  phase: 'lobby' | 'setup' | 'playing' | 'vog' | 'council' | 'ended'
  map: RoomData[]
  robots: Record<string, Robot>
  countdown: number
  killersFound: number
  totalKillers: number
  councilCooldown: number
  roomMessages?: Record<string, RoomMessage[]>
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
