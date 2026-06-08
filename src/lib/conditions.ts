import type { ConditionCategory } from '../types'

export interface ConditionDef {
  name: string
  category: ConditionCategory
  icon: string
  desc: string
}

export const CONDITIONS: ConditionDef[] = [
  // Standard D&D
  { name: 'Blinded',       category: 'standard', icon: '🙈', desc: 'Attack rolls against you have Advantage. Your attack rolls have Disadvantage.' },
  { name: 'Charmed',       category: 'standard', icon: '💞', desc: "You can't attack the charmer or target them with harmful abilities. The charmer has Advantage on social checks against you." },
  { name: 'Deafened',      category: 'standard', icon: '🔇', desc: 'You can\'t hear anything. You automatically fail any checks that rely on hearing.' },
  { name: 'Exhaustion',    category: 'standard', icon: '😮‍💨', desc: 'Each level imposes a -2 penalty to all d20 tests. Spell save DCs also suffer. Max 6 levels.' },
  { name: 'Frightened',    category: 'standard', icon: '😱', desc: "You have Disadvantage on ability checks and attack rolls while the source is visible. You can't willingly move closer to the source." },
  { name: 'Grappled',      category: 'standard', icon: '🤝', desc: "Your speed becomes 0. You can't benefit from speed bonuses. Ends if the grappler is incapacitated or you escape." },
  { name: 'Incapacitated', category: 'standard', icon: '💫', desc: 'You can\'t take any Actions, Bonus Actions, or Reactions. You still have Movement.' },
  { name: 'Invisible',     category: 'standard', icon: '👻', desc: 'You\'re impossible to see without magical aid or special senses. Attacks against you have Disadvantage. Your attacks have Advantage.' },
  { name: 'Paralysed',     category: 'standard', icon: '⚡', desc: "You're Incapacitated and can't move or speak. Attacks from within 5 ft. automatically crit. Str/Dex saves auto-fail." },
  { name: 'Petrified',     category: 'standard', icon: '🪨', desc: "You're turned to stone (Incapacitated/paralysed essentially). Damage Resistance to all. Immune to poison/age." },
  { name: 'Poisoned',      category: 'standard', icon: '🤢', desc: 'You have Disadvantage on attack rolls and ability checks.' },
  { name: 'Prone',         category: 'standard', icon: '⬇️', desc: "Your only Movement is crawling or teleporting. Attacks against you have Advantage. Your melee attacks have Disadvantage." },
  { name: 'Restrained',    category: 'standard', icon: '⛓️', desc: "Your speed becomes 0. Attacks against you have Advantage. Your attacks have Disadvantage. Dex saves have Disadvantage." },
  { name: 'Stunned',       category: 'standard', icon: '😵', desc: "You're Incapacitated and can't move. Attacks against you have Advantage. Str/Dex saves auto-fail." },
  { name: 'Unconscious',   category: 'standard', icon: '💤', desc: "Incapacitated, can't move, unaware. Attacks from 5 ft. auto-crit. Str/Dex saves auto-fail." },

  // Weapon Mastery
  { name: 'Vex',    category: 'weapon_mastery', icon: '🎯', desc: 'On hit, your next attack roll against that target has Advantage.' },
  { name: 'Graze',  category: 'weapon_mastery', icon: '🩹', desc: 'On a miss, you deal damage equal to your ability modifier (minimum 1).' },
  { name: 'Cleave', category: 'weapon_mastery', icon: '🪓', desc: 'On hit, you can deal the same damage to another creature adjacent to the target.' },
  { name: 'Push',   category: 'weapon_mastery', icon: '💨', desc: 'On hit, you can push the target up to 10 ft. away.' },
  { name: 'Slow',   category: 'weapon_mastery', icon: '🐢', desc: 'On hit, the target\'s speed is reduced by 10 ft. for 1 round.' },
  { name: 'Topple', category: 'weapon_mastery', icon: '🌀', desc: 'On hit, you can force the target to make a Con save or fall Prone.' },
  { name: 'Sap',    category: 'weapon_mastery', icon: '🪫', desc: 'On hit, the target has Disadvantage on its next attack roll.' },
  { name: 'Nick',   category: 'weapon_mastery', icon: '🔪', desc: 'When you make the attack as part of the Attack action, you can make an additional Light weapon attack as part of the same action.' },

  // Spell conditions
  { name: 'Silenced',              category: 'spell', icon: '🤫', desc: 'You can\'t make any sound, including verbal spell components.' },
  { name: 'Concentrating',         category: 'spell', icon: '🧠', desc: 'Maintaining a spell. Taking damage triggers a Con save to maintain.' },
  { name: 'Hexed',                 category: 'spell', icon: '🔮', desc: 'You take extra necrotic damage from the caster and have Disadvantage on checks of a chosen ability.' },
  { name: 'Blessed',               category: 'spell', icon: '✨', desc: 'Add 1d4 to attack rolls and saving throws.' },
  { name: 'Cursed',                category: 'spell', icon: '💀', desc: 'A curse is upon you. Effects depend on the source.' },
  { name: 'Banished',              category: 'spell', icon: '🌌', desc: 'Sent to a harmless demiplane for the duration. Incapacitated and unaware.' },
  { name: 'Polymorphed',           category: 'spell', icon: '🐸', desc: 'Your stats (including mental ability scores) are replaced by the new form. Alignment/personality retained.' },

  // Special (card-level toggles, not in picker)
  { name: 'Bloodied',              category: 'spell', icon: '🩸', desc: 'HP is at or below 50% of maximum. Auto-detected or manually set.' },
]

export const CONDITION_MAP = Object.fromEntries(CONDITIONS.map(c => [c.name, c]))

export const CATEGORY_LABELS: Record<ConditionCategory, string> = {
  standard:       'Standard',
  weapon_mastery: 'Weapon Mastery',
  spell:          'Spell',
}
