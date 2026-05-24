// LanternColumn — sits in a relative-positioned wrapper alongside the combatant list.
// The lantern anchors vertically to the active card via a top offset prop.
 
interface Props {
  // vertical centre of the active card, relative to the list container
  activeMidY: number
}
 
export default function LanternColumn({ activeMidY }: Props) {
  const LANTERN_H = 60
  const top = activeMidY - LANTERN_H * 0.52
 
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 44,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* The lantern itself */}
      <div style={{ position: 'absolute', left: 3, top: Math.max(4, top), width: 38 }}>
        <svg
          width="38"
          height={LANTERN_H}
          viewBox="0 0 38 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          {/* Hanging ring */}
          <path d="M19 1 Q23 1 23 5 Q23 8 19 8 Q15 8 15 5 Q15 1 19 1Z"
            stroke="#7a6530" strokeWidth="1" fill="none"/>
          <line x1="19" y1="8" x2="19" y2="12" stroke="#7a6530" strokeWidth="1.2"/>
 
          {/* Top cap */}
          <path d="M12 12 L26 12 L28 16 L10 16 Z"
            fill="#3a2e1c" stroke="#8a7030" strokeWidth="0.8"/>
          <circle cx="14" cy="14" r="1" fill="#6a5828"/>
          <circle cx="24" cy="14" r="1" fill="#6a5828"/>
 
          {/* Side handles */}
          <path d="M10 19 Q7 19 7 23 Q7 27 10 27"
            stroke="#6a5828" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M28 19 Q31 19 31 23 Q31 27 28 27"
            stroke="#6a5828" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
 
          {/* Glass body */}
          <path d="M10 16 Q8 18 8 23 L9 40 Q9 43 11 44 L27 44 Q29 43 29 40 L30 23 Q30 18 28 16 Z"
            fill="rgba(232,120,20,0.13)" stroke="#8a7030" strokeWidth="0.8"/>
 
          {/* Glass panel lines */}
          <line x1="19" y1="16" x2="19" y2="44" stroke="rgba(201,168,76,0.18)" strokeWidth="0.6"/>
          <line x1="14" y1="16" x2="13" y2="44" stroke="rgba(201,168,76,0.1)" strokeWidth="0.5"/>
          <line x1="24" y1="16" x2="25" y2="44" stroke="rgba(201,168,76,0.1)" strokeWidth="0.5"/>
          <line x1="9" y1="30" x2="29" y2="30" stroke="rgba(138,112,48,0.4)" strokeWidth="0.7"/>
 
          {/* Candle body */}
          <rect x="16.5" y="32" width="5" height="10" rx="1" fill="#c8903a" opacity="0.7"/>
          <ellipse cx="19" cy="32" rx="2.5" ry="1" fill="#e0a840" opacity="0.8"/>
 
          {/* Wick */}
          <line x1="19" y1="32" x2="19.5" y2="28" stroke="#3a2a10" strokeWidth="0.8" strokeLinecap="round"/>
 
          {/* Flame — outer */}
          <path d="M17.2 29 Q19 21 20.8 29 Q20.2 24.5 19 23 Q17.8 24.5 17.2 29Z"
            fill="rgba(200,80,10,0.85)"/>
          {/* Flame — mid */}
          <path d="M17.8 29 Q19 22.5 20.2 29 Q19.9 25.5 19 25 Q18.1 25.5 17.8 29Z"
            fill="#f0a830"/>
          {/* Flame — bright core */}
          <path d="M18.4 29 Q19 24.5 19.6 29 Q19.5 26.5 19 26 Q18.5 26.5 18.4 29Z"
            fill="#fff0a0" opacity="0.9"/>
 
          {/* Base */}
          <path d="M9 44 L10 46 L28 46 L29 44" fill="#3a2e1c" stroke="#8a7030" strokeWidth="0.8"/>
          <ellipse cx="19" cy="46" rx="9" ry="2" fill="#2a2010" stroke="#6a5828" strokeWidth="0.7"/>
 
          {/* Glow pool at base */}
          <ellipse cx="19" cy="48" rx="11" ry="3" fill="rgba(232,148,58,0.1)"/>
 
          {/* Animated flame flicker — CSS handles this */}
          <style>{`
            @keyframes lantern-flicker {
              0%,100% { opacity: 1; }
              30%      { opacity: 0.88; }
              60%      { opacity: 0.95; }
              80%      { opacity: 0.82; }
            }
            .lantern-flame { animation: lantern-flicker 2.4s ease-in-out infinite; }
          `}</style>
          <g className="lantern-flame">
            <path d="M17.2 29 Q19 21 20.8 29 Q20.2 24.5 19 23 Q17.8 24.5 17.2 29Z"
              fill="rgba(200,80,10,0.85)"/>
            <path d="M17.8 29 Q19 22.5 20.2 29 Q19.9 25.5 19 25 Q18.1 25.5 17.8 29Z"
              fill="#f0a830"/>
            <path d="M18.4 29 Q19 24.5 19.6 29 Q19.5 26.5 19 26 Q18.5 26.5 18.4 29Z"
              fill="#fff0a0" opacity="0.9"/>
          </g>
        </svg>
      </div>
 
      {/* Vertical post / stem below lantern */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: Math.max(4, top) + LANTERN_H,
        bottom: 0,
        width: 1,
        background: 'linear-gradient(to bottom, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.08) 50%, transparent 100%)',
      }}/>
    </div>
  )
}
 