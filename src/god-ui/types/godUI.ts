// Client-only UI state types for the God interface layer.
// Server types live in ../../types.ts

export type VoGUIPhase = 'idle' | 'submission' | 'voting' | 'done'

export type VoiceOfGodEntry = {
  godId: string
  words: string
  tick: number
}

export type VoGState = {
  phase: VoGUIPhase
  roundId: string
  isEligible: boolean
  timer: number
  submissions: VoiceOfGodEntry[]
  mySubmission?: string
  myVote?: string
  announcement?: string
}

export type CouncilMessage = {
  agentId: string
  message: string
  timestamp: number
}

export type Nominee = {
  robotId: string
  robotName: string
  votes: number
}

export type CouncilResult = {
  ejected: string | null
  wasKiller: boolean
}

export type CouncilState = {
  isActive: boolean
  timer: number
  messages: CouncilMessage[]
  nominees: Nominee[]
  myVote?: string
  result?: CouncilResult
  cooldown: number
}

export type GodWhisper = {
  godId: string
  targetRobotId: string
  words: string
}

export type WhisperState = {
  targetRobotId: string | null
  recentWhispers: GodWhisper[]
}
