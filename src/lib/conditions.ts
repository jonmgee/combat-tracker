import type { ConditionCategory } from '../types'

export interface ConditionDef {
  name: string
  category: ConditionCategory
  icon: string
}

export const CONDITIONS: ConditionDef[] = [
  // Standard D&D
  { name: 'Blinded',       category: 'standard', icon: '🙈' },
  { name: 'Charmed',       category: 'standard', icon: '💞' },
  { name: 'Deafened',      category: 'standard', icon: '🔇' },
  { name: 'Exhaustion',    category: 'standard', icon: '😮‍💨' },
  { name: 'Frightened',    category: 'standard', icon: '😱' },
  { name: 'Grappled',      category: 'standard', icon: '🤝' },
  { name: 'Incapacitated', category: 'standard', icon: '💫' },
  { name: 'Invisible',     category: 'standard', icon: '👻' },
  { name: 'Paralysed',     category: 'standard', icon: '⚡' },
  { name: 'Petrified',     category: 'standard', icon: '🪨' },
  { name: 'Poisoned',      category: 'standard', icon: '🤢' },
  { name: 'Prone',         category: 'standard', icon: '⬇️' },
  { name: 'Restrained',    category: 'standard', icon: '⛓️' },
  { name: 'Stunned',       category: 'standard', icon: '😵' },
  { name: 'Unconscious',   category: 'standard', icon: '💤' },

  // Weapon Mastery
  { name: 'Vex',    category: 'weapon_mastery', icon: '🎯' },
  { name: 'Graze',  category: 'weapon_mastery', icon: '🩹' },
  { name: 'Cleave', category: 'weapon_mastery', icon: '🪓' },
  { name: 'Push',   category: 'weapon_mastery', icon: '💨' },
  { name: 'Slow',   category: 'weapon_mastery', icon: '🐢' },
  { name: 'Topple', category: 'weapon_mastery', icon: '🌀' },
  { name: 'Sap',    category: 'weapon_mastery', icon: '🪫' },
  { name: 'Nick',   category: 'weapon_mastery', icon: '🔪' },

  // Spell conditions
  { name: 'Silenced',              category: 'spell', icon: '🤫' },
  { name: 'Concentrating',         category: 'spell', icon: '🧠' },
  { name: 'Hexed',                 category: 'spell', icon: '🔮' },
  { name: 'Blessed',               category: 'spell', icon: '✨' },
  { name: 'Cursed',                category: 'spell', icon: '💀' },
  { name: 'Restrained (Spell)',    category: 'spell', icon: '🕸️' },
  { name: 'Banished',              category: 'spell', icon: '🌌' },
  { name: 'Polymorphed',           category: 'spell', icon: '🐸' },
]

export const CONDITION_MAP = Object.fromEntries(CONDITIONS.map(c => [c.name, c]))

export const CATEGORY_LABELS: Record<ConditionCategory, string> = {
  standard:       'Standard',
  weapon_mastery: 'Weapon Mastery',
  spell:          'Spell',
}
