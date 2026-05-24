import { useEffect, useRef } from 'react'
 
interface Drip {
  x: number
  startY: number
  stopY: number
  y: number
  speed: number
  width: number
  poolW: number
  phase: 'drip' | 'pool' | 'idle'
  poolProgress: number
  idleTimer: number
  idleMax: number
  delay: number
  delayTimer: number
  streak: SVGPathElement
  tip: SVGEllipseElement
}
 
interface Props {
  /** Number of drips to animate (default 5) */
  count?: number
}
 
export default function BloodDrips({ count = 5 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dripsRef = useRef<Drip[]>([])
  const rafRef = useRef<number>(0)
 
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
 
    const W = 320
    const H = 72
 
    // Build drip objects
    const drips: Drip[] = []
    for (let i = 0; i < count; i++) {
      const x = 10 + Math.random() * (W - 20)
      const width = 1.8 + Math.random() * 2.0
 
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
 
      const streak = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      streak.setAttribute('fill', 'url(#bloodGrad)')
      g.appendChild(streak)
 
      const tip = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
      tip.setAttribute('fill', '#991010')
      tip.setAttribute('rx', String(width * 0.9))
      tip.setAttribute('ry', String(width * 0.9))
      g.appendChild(tip)
 
      svg.appendChild(g)
 
      drips.push({
        x, startY: -6 - Math.random() * 8,
        stopY: 18 + Math.random() * (H - 22),
        y: -6 - Math.random() * 8,
        speed: 0.16 + Math.random() * 0.20,
        width,
        poolW: width * (2.8 + Math.random() * 1.8),
        phase: 'drip',
        poolProgress: 0,
        idleTimer: 0,
        idleMax: 90 + Math.random() * 130,
        delay: Math.random() * 220,
        delayTimer: 0,
        streak,
        tip,
      })
    }
 
    dripsRef.current = drips
 
    function step() {
      for (const d of dripsRef.current) {
        if (d.delayTimer < d.delay) { d.delayTimer++; continue }
 
        if (d.phase === 'drip') {
          d.y += d.speed
          const topY = Math.max(d.startY, d.y - 14)
          const wx = d.x + Math.sin(d.y * 0.28) * 0.9
 
          d.streak.setAttribute('d',
            `M${wx - d.width / 2} ${topY} Q${wx + d.width * 0.3} ${(topY + d.y) / 2} ${wx} ${d.y} Q${wx - d.width * 0.3} ${(topY + d.y) / 2} ${wx - d.width / 2} ${topY}Z`
          )
          d.tip.setAttribute('cx', String(wx))
          d.tip.setAttribute('cy', String(d.y))
 
          if (d.y >= d.stopY) {
            d.phase = 'pool'
            d.poolProgress = 0
          }
 
        } else if (d.phase === 'pool') {
          d.poolProgress = Math.min(1, d.poolProgress + 0.012)
          const pw = d.poolW * d.poolProgress
          const ph = Math.min(3.2, d.poolProgress * 3.8)
          d.tip.setAttribute('rx', String(pw))
          d.tip.setAttribute('ry', String(ph))
          d.tip.setAttribute('cy', String(d.stopY + ph * 0.4))
          if (d.poolProgress >= 1) d.phase = 'idle'
 
        } else {
          d.idleTimer++
          if (d.idleTimer > d.idleMax) {
            // Reset
            d.y = d.startY
            d.phase = 'drip'
            d.poolProgress = 0
            d.idleTimer = 0
            d.stopY = 18 + Math.random() * (H - 22)
            d.delay = 0
            d.delayTimer = 0
            d.tip.setAttribute('rx', String(d.width * 0.9))
            d.tip.setAttribute('ry', String(d.width * 0.9))
            d.streak.setAttribute('d', '')
          }
        }
      }
      rafRef.current = requestAnimationFrame(step)
    }
 
    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      // Remove drip nodes
      for (const d of dripsRef.current) {
        d.streak.parentElement?.remove()
      }
      dripsRef.current = []
    }
  }, [count])
 
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 320 72"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      <defs>
        <linearGradient id="bloodGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cc1a0a" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#7a0804" stopOpacity="0.5"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
 