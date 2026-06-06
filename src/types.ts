export type SessionStatus = 'lobby' | 'active' | 'ended'
export type ParticipantRole = 'dm' | 'player'
export type CombatPhase = 'initiative' | 'order_review' | 'active'
export type CombatantKind = 'player' | 'monster'
export type ConditionCategory = 'standard' | 'weapon_mastery' | 'spell'

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
  hp_opt_in: boolean
  notifications_enabled: boolean
  alert_feat: boolean
  alert_used: boolean
  starting_hp: number | null
  max_hp_participant: number | null
  joined_at: string
}

export interface Combatant {
  id: string
  session_id: string
  participant_id: string | null
  name: string
  kind: CombatantKind
  initiative: number | null
  initiative_order: number | null
  is_hidden: boolean
  has_taken_turn: boolean
  dead: boolean
  count: number
  hp_enabled: boolean
  max_hp: number | null
  current_hp: number | null
  temp_hp: number
  created_at: string
}

export interface CombatState {
  session_id: string
  current_combatant_id: string | null
  round_number: number
  phase: CombatPhase
  updated_at: string
}

export interface Condition {
  id: string
  combatant_id: string
  condition: string
  category: ConditionCategory
  applied_at: string
}
