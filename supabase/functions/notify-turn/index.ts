// notify-turn — sends a Web Push "it's your turn" to a combatant's devices.
//
// Called by the app right after the DM advances the turn (or combat begins),
// with { session_id, combatant_id }. Looks up which participant that combatant
// belongs to, loads their stored push subscriptions, and pushes to each.
//
// Runs as service_role — see migration-012 for the required table grants.
// verify_jwt is disabled: the app invokes it with the anon key and the payload
// only triggers a "your turn" ping, so a permissive endpoint is acceptable.
//
// Subscriptions with an "apns:<env>:<token>" endpoint come from the PC on Parchment
// iPhone app and go to Apple's push service instead (secrets APNS_KEY_ID and
// APNS_PRIVATE_KEY, the .p8 file's text).

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { session_id, combatant_id } = await req.json()
    if (!combatant_id) return json({ error: 'combatant_id required' }, 400)

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      webpush.setVapidDetails('mailto:hello@torchandturn.com', VAPID_PUBLIC, VAPID_PRIVATE)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Which participant is this combatant? (monsters have no participant_id)
    const { data: combatant, error: cErr } = await supabase
      .from('combatants')
      .select('participant_id, name')
      .eq('id', combatant_id)
      .maybeSingle()
    if (cErr) {
      console.error('[notify-turn] combatants lookup failed:', cErr.message)
      return json({ error: 'combatant lookup failed', detail: cErr.message }, 500)
    }
    if (!combatant?.participant_id) {
      return json({ skipped: 'no participant for combatant (monster or missing)' })
    }

    const { data: participant } = await supabase
      .from('participants')
      .select('notifications_enabled')
      .eq('id', combatant.participant_id)
      .maybeSingle()
    if (participant && participant.notifications_enabled === false) {
      return json({ skipped: 'participant has notifications disabled' })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('participant_id', combatant.participant_id)
    if (!subs || subs.length === 0) {
      return json({ skipped: 'no push subscriptions for participant' })
    }

    const title = '⚔️ Your Turn!'
    const body = `${combatant.name}, you're up in combat.`
    const payload = JSON.stringify({ title, body })

    let sent = 0
    const stale: string[] = []
    for (const row of subs) {
      const apns = (row.subscription as { apns?: { token: string; env: string } }).apns
      if (apns) {
        const outcome = await sendApns(apns.token, apns.env, title, body).catch((err) => {
          console.error('[notify-turn] APNs error:', err)
          return 'failed' as const
        })
        if (outcome === 'sent') sent++
        else if (outcome === 'stale') stale.push(row.id)
        continue
      }
      if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        console.error('[notify-turn] VAPID keys not configured')
        continue
      }
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch (err) {
        const e = err as { statusCode?: number; body?: string }
        console.error('[notify-turn] send failed:', e?.statusCode, e?.body)
        if (e?.statusCode === 404 || e?.statusCode === 410) stale.push(row.id)
      }
    }
    if (stale.length > 0) await supabase.from('push_subscriptions').delete().in('id', stale)

    return json({ sent, pruned: stale.length, session_id })
  } catch (err) {
    console.error('[notify-turn] error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// ---- Apple's push service, for the PC on Parchment iPhone app ----

const APNS_TEAM_ID = 'GR45BNB2NV'
const APNS_TOPIC = 'com.appwrightsguild.pconparchment' // the app's bundle ID

// Apple wants a fresh signed token at most hourly and no more than every 20 minutes;
// one per warm function instance, renewed after 40 minutes, sits between.
let apnsAuth: { token: string; at: number } | null = null

async function apnsToken(): Promise<string | null> {
  if (apnsAuth && Date.now() - apnsAuth.at < 40 * 60 * 1000) return apnsAuth.token
  const keyId = Deno.env.get('APNS_KEY_ID')
  const pem = Deno.env.get('APNS_PRIVATE_KEY')
  if (!keyId || !pem) return null
  const der = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
    (c) => c.charCodeAt(0),
  )
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const b64url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const part = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))
  const unsigned = `${part({ alg: 'ES256', kid: keyId })}.${part({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  apnsAuth = { token: `${unsigned}.${b64url(new Uint8Array(signature))}`, at: Date.now() }
  return apnsAuth.token
}

async function sendApns(deviceToken: string, env: string, title: string, body: string): Promise<'sent' | 'stale' | 'failed'> {
  const auth = await apnsToken()
  if (!auth) {
    console.error('[notify-turn] APNs key not configured')
    return 'failed'
  }
  const host = env === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${auth}`,
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0', // a turn alert is useless later: deliver now or not at all
    },
    // Time-sensitive: a turn alert gets through Focus modes and summaries (the app holds the entitlement).
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: 'default', 'interruption-level': 'time-sensitive' },
      tab: 'combat',
    }),
  })
  if (res.ok) return 'sent'
  const reason = await res.text()
  console.error('[notify-turn] APNs send failed:', res.status, reason)
  if (res.status === 410 || reason.includes('BadDeviceToken') || reason.includes('Unregistered')) return 'stale'
  if (res.status === 403) apnsAuth = null // expired or refused token: sign a new one next time
  return 'failed'
}
