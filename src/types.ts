export type SessionStatus = 'lobby' | 'active' | 'ended'
export type ParticipantRole = 'dm' | 'player'

export interface Session {
  id: string
  room_code: string
  status: SessionStatus
  created_at: string
}

export interface Participant {
  id: string
  session_id: string
  name: string
  role: ParticipantRole
  joined_at: string
}
