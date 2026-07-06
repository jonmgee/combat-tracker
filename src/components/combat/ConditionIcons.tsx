// SVG icon for every condition. Each returns a bare <svg> sized to fill its container.
// Usage: <BlindedIcon /> inside a sized wrapper div.
 
import React from 'react'
import { getConditionImageUrls } from '../../lib/conditionImageUrls'

// Helper to prefer WebP with PNG fallback — uses Vite-resolved asset URLs so it works in production.
export function ConditionImage({ folder, filename, alt }: { folder: string, filename: string, alt?: string }) {
  const { webp, png } = getConditionImageUrls(folder, filename)
  if (!png && !webp) return <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>?</span>
  return (
    <picture style={{ width: '100%', height: '100%', display: 'block' }}>
      {webp && <source srcSet={webp} type="image/webp" />}
      <img src={png ?? webp} alt={alt ?? filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </picture>
  )
}


export function BlindedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 10 Q10 3 18 10 Q10 17 2 10Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}
 
export function CharmedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 16 L4 10 Q2 6 6 5 Q8 4.5 10 8 Q12 4.5 14 5 Q18 6 16 10 Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M7.5 8.5 Q10 7 12.5 8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}
 
export function DeafenedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M8 6 Q8 4 10 4 Q13 4 13 7 Q13 10 10 11 L10 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <circle cx="10" cy="15.5" r="0.9" fill="currentColor"/>
      <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
  
export function FrightenedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 17 Q10 12 13 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M8 6 L7 4.5 M12 6 L13 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
 
export function GrappledIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M5 8 Q5 5 8 5 L12 5 Q15 5 15 8 L15 10 Q15 13 12 14 L10 14 L10 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M7 14 Q5 14 5 16 L5 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M13 14 Q15 14 15 16 L15 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}
 
export function IncapacitatedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 10 Q7 17 10 17 Q13 17 13 10" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M7 14 L13 14" stroke="currentColor" strokeWidth="1"/>
      <line x1="8" y1="3.5" x2="12" y2="8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}
 
export function InvisibleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M2 10 Q10 3 18 10 Q10 17 2 10Z" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" fill="none"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5"/>
    </svg>
  )
}
 
export function ParalysedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 9.5 L7 17 M12 9.5 L13 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 11 L13 11 M7 14 L13 14" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  )
}
 
export function PetrifiedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 2 L14 7 L18 6 L15 11 L17 16 L12 14 L10 18 L8 14 L3 16 L5 11 L2 6 L6 7 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M8 8 L9 10 L7 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
    </svg>
  )
}
 
export function PoisonedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5 L13 7.5 L18 7.5 L14 11.5 L15.5 17 L10 13.8 L4.5 17 L6 11.5 L2 7.5 L7 7.5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="10" cy="10" r="1.8" fill="currentColor"/>
    </svg>
  )
}
 
export function ProneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 18 L16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 18 L7 13 L10 10 L12 12 L16 12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
 
export function RestrainedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 10 L7 14 L5 17 M12 10 L13 14 L15 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M6 13 Q10 15 14 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M7 11 Q10 12.5 13 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="1.5 1.5" fill="none"/>
    </svg>
  )
}
 
export function StunnedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.5 7.5 L12.5 12.5 M12.5 7.5 L7.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 3 L10 1 M14 4 L15.5 2.5 M6 4 L4.5 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )
}
 
export function UnconsciousIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 10 L6 17 M13 10 L14 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M6 14 L14 14" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M4 8 Q3 8 3 9 Q3 10 4 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"/>
      <path d="M16 8 Q17 8 17 9 Q17 10 16 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"/>
    </svg>
  )
}
 
// ── Weapon Mastery ──
 
export function VexIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M10 2 L10 5 M10 15 L10 18 M2 10 L5 10 M15 10 L18 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M4.5 4.5 L6.8 6.8 M13.2 13.2 L15.5 15.5 M4.5 15.5 L6.8 13.2 M13.2 6.8 L15.5 4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}
 
export function GrazeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 16 L16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 16 L16 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M4 13 L13 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}
 
export function CleaveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M6 3 L14 3 L16 8 L10 18 L4 8 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
      <line x1="10" y1="3" x2="10" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
    </svg>
  )
}
 
export function PushIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 10 L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 6 L13 10 L9 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M15 6 L15 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}
 
export function SlowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M10 6 L10 10 L13 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M3 10 L1 10 M6 4 L4.5 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    </svg>
  )
}
 
export function ToppleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3 L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 10 L10 13 L13 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M5 16 Q10 14 15 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M7 17.5 Q10 16.5 13 17.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.5"/>
    </svg>
  )
}
 
export function SapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3 Q14 7 14 11 A4 4 0 0 1 6 11 Q6 7 10 3Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <path d="M10 3 Q6 7 6 11" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
      <path d="M8 13 Q10 15 12 13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  )
}
 
export function NickIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M5 15 L13 4 L15 6 L9 15 Q8 17 6 17 Q4 17 5 15Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M13 4 L15 3 L16 6 L15 6" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
 
// ── Bloodied (manual toggle) ──

export function BloodiedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5 Q14 7 14 10.5 A4 4 0 0 1 6 10.5 Q6 7 10 2.5Z" stroke="currentColor" strokeWidth="1.2" fill="rgba(180,40,30,0.25)"/>
      <path d="M7.5 13 Q10 15 12.5 13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="9" r="1" fill="currentColor" opacity="0.7"/>
      <path d="M7 6 L6 4.5 M13 6 L14 4.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

// ── Spell conditions ──
 
export function SilencedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M7 7 L7 13 L11 16 L11 4 L7 7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M13 8 Q15 10 13 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.3"/>
      <line x1="3" y1="4" x2="17" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
 
export function ConcentratingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <ellipse cx="10" cy="10" rx="8" ry="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth="1.1"/>
      <circle cx="10" cy="10" r="1" fill="currentColor"/>
      <line x1="10" y1="3.5" x2="10" y2="2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      <line x1="15" y1="5" x2="16.2" y2="3.8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      <line x1="5" y1="5" x2="3.8" y2="3.8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  )
}
 
export function HexedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 2 L17 6 L17 14 L10 18 L3 14 L3 6 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M10 6 L10 14 M6.5 8 L13.5 12 M13.5 8 L6.5 12" stroke="currentColor" strokeWidth="0.9" opacity="0.6"/>
      <circle cx="10" cy="10" r="1.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}
 
export function BlessedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M10 3 L11.5 8 L17 8 L12.5 11.5 L14 17 L10 13.5 L6 17 L7.5 11.5 L3 8 L8.5 8 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
 
export function CursedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M10 12 L10 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M7 15 L10 17 L13 15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M8 6.5 L8.5 8 L10 7.5 L11.5 8 L12 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
  
export function PolymorphedIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 14 Q4 10 7 9 Q6 7 8 6 Q8 4 10 4 Q13 4 14 7 Q17 8 17 11 Q17 14 14 15 L6 15 Q4 15 4 14Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M3 16 Q5 18 7 17" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
      <path d="M13 15 Q15 17 17 16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
      <circle cx="8" cy="10.5" r="0.8" fill="currentColor"/>
      <circle cx="12" cy="10.5" r="0.8" fill="currentColor"/>
    </svg>
  )
}
 
// ── Condition icon wrapper with info tooltip + x remove ──

// On touch devices tooltips should not float over neighbours. We'll hide hover tooltips on touch devices and rely on the bottom sheet UI instead.
export function ConditionIconWrapper({
  conditionName,
  children,
}: {
  conditionName: string
  children: React.ReactNode
}) {
  // Tooltip removed. Parent components should open the full Conditions sheet on icon click.
  // avoid unused variable error
  void conditionName

  return (
    <div className="condition-icon-wrapper" style={{ position: 'relative' }}>
      {children}
    </div>
  )
}

// ── Icon lookup map ──
export const CONDITION_ICON_MAP: Record<string, React.FC> = {
  'Blinded':            BlindedIcon,
  'Charmed':            CharmedIcon,
  'Deafened':           DeafenedIcon,

  'Frightened':         FrightenedIcon,
  'Grappled':           GrappledIcon,
  'Incapacitated':      IncapacitatedIcon,
  'Invisible':          InvisibleIcon,
  'Paralysed':          ParalysedIcon,
  'Petrified':          PetrifiedIcon,
  'Poisoned':           PoisonedIcon,
  'Prone':              ProneIcon,
  'Restrained':         RestrainedIcon,
  'Stunned':            StunnedIcon,
  'Unconscious':        UnconsciousIcon,
  'Vex':                VexIcon,
  'Graze':              GrazeIcon,
  'Cleave':             CleaveIcon,
  'Push':               PushIcon,
  'Slow':               SlowIcon,
  'Topple':             ToppleIcon,
  'Sap':                SapIcon,
  'Nick':               NickIcon,
  'Silenced':           SilencedIcon,
  'Concentrating':      ConcentratingIcon,
  'Hexed':              HexedIcon,
  'Blessed':            BlessedIcon,
  'Cursed':             CursedIcon,

  'Polymorphed':        PolymorphedIcon,
  'Bloodied':           BloodiedIcon,
}
 
// Colour theme per condition (background, border, icon colour)
export const CONDITION_COLOURS: Record<string, { bg: string; border: string; color: string }> = {
  'Blinded':            { bg: 'rgba(80,60,100,0.25)',  border: 'rgba(130,100,180,0.45)', color: '#a080d0' },
  'Charmed':            { bg: 'rgba(120,40,80,0.25)',  border: 'rgba(200,80,140,0.45)',  color: '#e060a0' },
  'Deafened':           { bg: 'rgba(60,60,80,0.25)',   border: 'rgba(120,120,160,0.45)', color: '#9090c0' },

  'Frightened':         { bg: 'rgba(100,30,20,0.25)',  border: 'rgba(180,60,40,0.45)',   color: '#d05030' },
  'Grappled':           { bg: 'rgba(80,50,20,0.25)',   border: 'rgba(160,100,40,0.45)',  color: '#c08040' },
  'Incapacitated':      { bg: 'rgba(100,20,20,0.25)',  border: 'rgba(180,60,60,0.45)',   color: '#d05050' },
  'Invisible':          { bg: 'rgba(40,60,80,0.25)',   border: 'rgba(80,140,180,0.45)',  color: '#60a0d0' },
  'Paralysed':          { bg: 'rgba(20,60,60,0.25)',   border: 'rgba(40,160,160,0.45)',  color: '#40b0b0' },
  'Petrified':          { bg: 'rgba(70,60,50,0.25)',   border: 'rgba(140,120,100,0.45)', color: '#a09070' },
  'Poisoned':           { bg: 'rgba(30,80,30,0.25)',   border: 'rgba(60,160,60,0.45)',   color: '#50c050' },
  'Prone':              { bg: 'rgba(80,60,40,0.25)',   border: 'rgba(150,120,80,0.45)',  color: '#b09060' },
  'Restrained':         { bg: 'rgba(90,60,20,0.25)',   border: 'rgba(170,110,40,0.45)',  color: '#c08030' },
  'Stunned':            { bg: 'rgba(40,80,120,0.25)',  border: 'rgba(80,160,220,0.45)',  color: '#60b0e0' },
  'Unconscious':        { bg: 'rgba(30,30,60,0.25)',   border: 'rgba(80,80,160,0.45)',   color: '#7070c0' },
  'Vex':                { bg: 'rgba(100,60,20,0.25)',  border: 'rgba(200,130,40,0.45)',  color: '#e09030' },
  'Graze':              { bg: 'rgba(80,30,30,0.25)',   border: 'rgba(160,70,60,0.45)',   color: '#c06050' },
  'Cleave':             { bg: 'rgba(80,40,20,0.25)',   border: 'rgba(160,90,40,0.45)',   color: '#c07030' },
  'Push':               { bg: 'rgba(40,60,80,0.25)',   border: 'rgba(80,130,180,0.45)',  color: '#6090c0' },
  'Slow':               { bg: 'rgba(50,70,50,0.25)',   border: 'rgba(100,140,100,0.45)', color: '#70a070' },
  'Topple':             { bg: 'rgba(70,50,80,0.25)',   border: 'rgba(140,100,160,0.45)', color: '#a070c0' },
  'Sap':                { bg: 'rgba(60,80,40,0.25)',   border: 'rgba(120,160,80,0.45)',  color: '#90c060' },
  'Nick':               { bg: 'rgba(80,30,30,0.25)',   border: 'rgba(160,70,60,0.45)',   color: '#c06050' },
  'Silenced':           { bg: 'rgba(60,40,80,0.25)',   border: 'rgba(120,80,160,0.45)',  color: '#9060c0' },
  'Concentrating':      { bg: 'rgba(60,30,120,0.3)',   border: 'rgba(140,80,240,0.6)',   color: '#b090f0' },
  'Hexed':              { bg: 'rgba(80,20,80,0.25)',   border: 'rgba(160,40,160,0.45)',  color: '#c040c0' },
  'Blessed':            { bg: 'rgba(100,80,20,0.25)',  border: 'rgba(200,170,40,0.45)',  color: '#d0c030' },
  'Cursed':             { bg: 'rgba(60,10,10,0.3)',    border: 'rgba(140,30,30,0.5)',    color: '#b02020' },

  'Polymorphed':        { bg: 'rgba(20,70,40,0.25)',   border: 'rgba(40,140,80,0.45)',   color: '#40a060' },
  'Bloodied':           { bg: 'rgba(140,20,15,0.35)',  border: 'rgba(180,50,40,0.55)',   color: '#c07070' },
}
 
export const DEFAULT_CONDITION_COLOUR = { bg: 'rgba(60,50,40,0.25)', border: 'rgba(120,100,80,0.45)', color: '#907060' }
 

// CSS variable default for condition icon size
// Consumers should set --condition-icon-size when needed; provide a sensible default here via exported constant
export const CONDITION_ICON_SIZE_CSS = "--condition-icon-size: clamp(40px, 3.2vw, 48px);"
