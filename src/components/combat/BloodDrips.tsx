import type { CSSProperties } from 'react'

interface Props {
  /** Rendered width in px — height scales with it. Default suits full cards; pass ~70 for sub-cards. */
  width?: number
  style?: CSSProperties
}

/**
 * Static blood seep hanging from the card's top edge.
 * Hand-drawn shapes at fixed scale — never stretched, never animated.
 * Dark, dried-blood tones to sit inside the candlelit palette.
 */
export default function BloodDrips({ width = 120, style }: Props) {
  return (
    <svg
      width={width}
      height={width * 0.22}
      viewBox="0 0 120 26"
      style={{
        position: 'absolute',
        top: -0.5,
        left: 14,
        pointerEvents: 'none',
        zIndex: 3,
        ...style,
      }}
    >
      <defs>
        <linearGradient id="bloodSeep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7d1410" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#4d0a07" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Rim pooled along the top edge, with bulges where the drips fall */}
      <path
        fill="url(#bloodSeep)"
        d="M0,0 H120 V1.2
           C112,2.6 106,2.2 99,2
           C95,4.4 92.6,4.4 89,2.1
           C80,1.6 74,2.8 66,2.6
           C61.4,6 58.6,6 55,2.4
           C48,2 42,3 34,2.6
           C29.8,5.4 26.6,5.4 23,2.3
           C15,2 8,2.8 0,1.4 Z"
      />

      {/* Drips — teardrops tapering to rounded tips, varied lengths */}
      <path fill="url(#bloodSeep)" d="M20.6,2 Q19.6,9.5 22,15.5 Q24.4,9.5 24.4,2 Z" />
      <circle cx="22.1" cy="15.2" r="1.7" fill="#5a0c08" />

      <path fill="url(#bloodSeep)" d="M55.9,2 Q54.9,13 58,22 Q61.1,13 60.1,2 Z" />
      <circle cx="58" cy="21.6" r="2" fill="#500a07" />

      <path fill="url(#bloodSeep)" d="M90.7,2 Q90,7.5 92,11.5 Q94,7.5 93.5,2 Z" />
      <circle cx="92" cy="11.2" r="1.4" fill="#5a0c08" />
    </svg>
  )
}
