import {
  guildFile,
  instagramUrl,
  PAST_CREATORS_URL,
  tiktokUrl,
  useCreatorOfTheWeek,
} from '../lib/creatorOfTheWeek'

/** A small gilt medal: marks the card as the guild's pick at a glance. */
function Medal() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" className="flex-none">
      <defs>
        <linearGradient id="cotw-gilt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e6a6" />
          <stop offset="0.5" stopColor="#c69a3e" />
          <stop offset="1" stopColor="#9c7120" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#cotw-gilt)" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="#5a3d0c" strokeOpacity="0.45" />
      <path d="M16 8.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#1a1410" />
    </svg>
  )
}

/** "Opens elsewhere", drawn rather than typed: iPhones and iPads swap the
 *  ↗ character for a blue emoji. */
function OutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  )
}

/**
 * The guild's D&D Creator of the Week, on the home screen only — never in a
 * lobby or mid-combat. Sits under the Create/Join panel so it never pushes
 * the buttons players came for off a phone screen. Closing it holds until
 * the next showing (8am Sunday, a new creator; 8am Thursday, the same one).
 */
export default function CreatorOfTheWeek() {
  const [creator, close] = useCreatorOfTheWeek()
  if (!creator) return null
  const handle = creator.tiktok ?? creator.instagram
  const cinzel = "'Cinzel', serif"

  return (
    <section
      aria-label="D&D Creator of the Week"
      className="w-full max-w-sm rounded-xl mt-5 flex flex-col overflow-hidden fade-in"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animationDelay: '0.2s',
      }}
    >
      <div
        className="flex items-center gap-2.5 py-1 pl-3 pr-1"
        style={{ background: 'rgba(201,168,76,0.14)', borderBottom: '1px solid var(--gold-dark)' }}
      >
        <Medal />
        <h2
          className="flex-1 font-bold leading-tight"
          style={{ fontFamily: cinzel, color: 'var(--gold)', fontSize: '0.86rem', letterSpacing: '0.01em', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 0 12px rgba(201,168,76,0.35)' }}
        >
          D&amp;D Creator of the Week
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Hide until the next showing"
          className="flex items-center justify-center hover:opacity-80"
          style={{
            width: 44,
            height: 44,
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: '1.1rem',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {creator.photo && (
            <img
              src={guildFile(creator.photo)}
              alt=""
              className="rounded-lg flex-none"
              style={{ width: 64, height: 64, objectFit: 'cover', border: '1px solid var(--gold-dark)' }}
            />
          )}
          <div className="min-w-0">
            <p className="font-bold" style={{ fontFamily: cinzel, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
              {creator.name}
            </p>
            {handle && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>@{handle}</p>}
            {creator.line && (
              <p className="mt-1 italic" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.35 }}>
                {creator.line}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {creator.tiktok && (
            <a
              href={tiktokUrl(creator.tiktok)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg font-semibold text-sm active:scale-95 transition-all duration-150"
              style={{
                minHeight: 44,
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
                color: '#1a1410',
                fontFamily: cinzel,
                letterSpacing: '0.04em',
                textDecoration: 'none',
              }}
            >
              Watch on TikTok <OutIcon />
            </a>
          )}
          {creator.instagram && (
            <a
              href={instagramUrl(creator.instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg font-semibold text-sm active:scale-95 transition-all duration-150"
              style={{
                minHeight: 44,
                color: 'var(--gold)',
                border: '1px solid var(--gold-dark)',
                fontFamily: cinzel,
                letterSpacing: '0.04em',
                textDecoration: 'none',
              }}
            >
              Instagram <OutIcon />
            </a>
          )}
        </div>

        <p className="flex justify-between" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
          <span>Picked by the Appwrights Guild</span>
          <a
            href={PAST_CREATORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Past creators
          </a>
        </p>
      </div>
    </section>
  )
}
