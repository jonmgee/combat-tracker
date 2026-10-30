import { useEffect, useState } from 'react'

/**
 * D&D Creator of the Week: one list on appwrightsguild.com, read by all four
 * apps. This file is the same in each of them.
 *
 * The list holds the coming weeks in advance, each creator with the Sunday
 * their week starts, so nothing needs deploying when the week turns: every
 * app works out whose week it is from the date alone.
 *
 * The file is fetched through this site's own /api/guild/ address, which
 * vercel.json hands to the guild site. Same-origin, so no change to the
 * security policy, and the iPhone app passes /api/ on to the website as it
 * already does for everything else there.
 */

export interface Creator {
  /** The Sunday the week starts, as YYYY-MM-DD. */
  start: string
  name: string
  /** Handles without the @. */
  tiktok?: string
  instagram?: string
  /** A path on the guild site, e.g. 'creators/gilded-tavern-uk.jpg'. */
  photo?: string
  line?: string
}

const GUILD = '/api/guild/'
const HIDDEN_KEY = 'cotw-hidden-at'
/** Weeks turn, and the card comes back, at 8am UK time. */
const HOUR = 8
const DAY = 86_400_000

/** A photo or other file on the guild site, by its path there. */
export const guildFile = (path: string) => GUILD + path.replace(/^\//, '')

export const tiktokUrl = (handle: string) => `https://www.tiktok.com/@${handle}`
export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`
export const PAST_CREATORS_URL = 'https://www.appwrightsguild.com/creators-of-the-week.html'

/* Times here are London wall-clock times written as if they were UTC, so
   '8am on Sunday' means 8am in the UK whichever side of a clock change it
   falls. They're only ever compared with each other. */

const wallClock = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min)

const dayAt8 = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  return wallClock(y, m, d, HOUR)
}

/** ?cotw-date=2026-11-01 (optionally T09:30) pretends it's that day, to see
 *  a coming week before it arrives. Kept for the rest of the visit. */
function pretendNow(): number | null {
  let raw: string | null = null
  try {
    raw = new URLSearchParams(window.location.search).get('cotw-date')
    if (raw) sessionStorage.setItem('cotw-date', raw)
    else raw = sessionStorage.getItem('cotw-date')
  } catch {
    /* no storage: the real date it is */
  }
  const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/)
  if (!m) return null
  return wallClock(Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 12, m[5] ? Number(m[5]) : 0)
}

// Noted the moment the site loads: signing in sends you back to the home
// page without the ?cotw-date= part, so waiting for the card would lose it.
pretendNow()

function londonNow(): number {
  const pretend = pretendNow()
  if (pretend !== null) return pretend
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  const part = (type: string) => Number(parts[type])
  return wallClock(part('year'), part('month'), part('day'), part('hour'), part('minute'))
}

/** Whose week it is: from 8am on their Sunday to 8am the Sunday after. */
export function currentCreator(list: Creator[], now = londonNow()): Creator | null {
  let found: Creator | null = null
  for (const c of list) {
    const from = dayAt8(c.start)
    if (from <= now && now < from + 7 * DAY && (!found || c.start > found.start)) found = c
  }
  return found
}

/** The latest 8am on a Sunday (a new creator) or a Thursday (a second
 *  showing of the same one) that has already passed. */
function lastShowing(now: number): number {
  const today = Math.floor(now / DAY) * DAY
  for (let back = 0; back < 8; back++) {
    const t = today - back * DAY + HOUR * 3_600_000
    const weekday = new Date(t).getUTCDay()
    if ((weekday === 0 || weekday === 4) && t <= now) return t
  }
  return 0
}

/** Pretend dates keep their own note of closing, so trying out a coming
 *  week can't hide the real one. */
const hiddenKey = () => (pretendNow() === null ? HIDDEN_KEY : `${HIDDEN_KEY}-pretend`)

function closedSinceShowing(now: number): boolean {
  try {
    const at = Number(localStorage.getItem(hiddenKey()))
    return at >= lastShowing(now)
  } catch {
    return false
  }
}

/** This week's creator, or null when there isn't one, it's been closed
 *  since the last showing, or the list can't be reached (offline, say). */
export function useCreatorOfTheWeek(): [Creator | null, () => void] {
  const [creator, setCreator] = useState<Creator | null>(null)
  useEffect(() => {
    const now = londonNow()
    if (closedSinceShowing(now)) return
    let live = true
    fetch(guildFile('creators-of-the-week.json'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { creators?: Creator[] } | null) => {
        if (live && j) setCreator(currentCreator(j.creators ?? [], now))
      })
      .catch(() => {
        /* no card is the quiet failure */
      })
    return () => {
      live = false
    }
  }, [])
  const close = () => {
    try {
      localStorage.setItem(hiddenKey(), String(londonNow()))
    } catch {
      /* closed for this visit only */
    }
    setCreator(null)
  }
  return [creator, close]
}
