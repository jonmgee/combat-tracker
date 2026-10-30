import {
  guildFile,
  instagramUrl,
  PAST_CREATORS_URL,
  tiktokUrl,
  useCreatorOfTheWeek,
  weekLabel,
} from '../lib/creatorOfTheWeek'

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
      className="w-full max-w-sm rounded-xl mt-5 p-4 flex flex-col gap-3 fade-in"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animationDelay: '0.2s',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex-1 text-xs font-semibold"
          style={{ fontFamily: cinzel, color: 'var(--gold)', letterSpacing: '0.1em' }}
        >
          D&amp;D CREATOR OF THE WEEK
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{weekLabel(creator.start)}</span>
        <button
          type="button"
          onClick={close}
          aria-label="Hide until the next showing"
          className="flex items-center justify-center hover:opacity-80"
          style={{
            width: 44,
            height: 44,
            margin: '-12px -12px -12px 0',
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
            className="flex-1 flex items-center justify-center rounded-lg font-semibold text-sm active:scale-95 transition-all duration-150"
            style={{
              minHeight: 44,
              background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
              color: '#1a1410',
              fontFamily: cinzel,
              letterSpacing: '0.04em',
              textDecoration: 'none',
            }}
          >
            Watch on TikTok ↗
          </a>
        )}
        {creator.instagram && (
          <a
            href={instagramUrl(creator.instagram)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center rounded-lg font-semibold text-sm active:scale-95 transition-all duration-150"
            style={{
              minHeight: 44,
              color: 'var(--gold)',
              border: '1px solid var(--gold-dark)',
              fontFamily: cinzel,
              letterSpacing: '0.04em',
              textDecoration: 'none',
            }}
          >
            Instagram ↗
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
    </section>
  )
}
