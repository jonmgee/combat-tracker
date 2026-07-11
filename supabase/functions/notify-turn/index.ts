// notify-turn — sends a Web Push "it's your turn" to a combatant's devices.
//
// Called by the app right after the DM advances the turn (or combat begins),
// with { session_id, combatant_id }. Looks up which participant that combatant
// belongs to, loads their stored push subscriptions, and pushes to each.
//
// Secrets (set as Edge Function env vars, NEVER committed):
//   VAPID_PUBLIC_KEY   — the same public key shipped in the client
//   VAPID_PRIVATE_KEY  — private key, server-only
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injected automatically
//
// verify_jwt is disabled: the app invokes this with the anon key, and the
// payload only triggers a "your turn" ping (no data returned, no sensitive
// action), so a permissive endpoint is acceptable for this app.

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
    if (!combatant_id) {
      return json({ error: 'combatant_id required' }, 400)
    }

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return json({ error: 'VAPID keys not configured' }, 500)
    }
    webpush.setVapidDetails('mailto:hello@torchandturn.com', VAPID_PUBLIC, VAPID_PRIVATE)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Which participant is this combatant? (monsters have no participant_id)
    const { data: combatant } = await supabase
      .from('combatants')
      .select('participant_id, name')
      .eq('id', combatant_id)
      .maybeSingle()

    if (!combatant?.participant_id) {
      return json({ skipped: 'no participant for combatant (monster or missing)' })
    }

    // Don't notify the DM about their own DM-PC turns? We still do — a DM-PC is a
    // real player slot. But skip if the participant has notifications disabled.
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

    const payload = JSON.stringify({
      title: '⚔️ Your Turn!',
      body: `${combatant.name}, you're up in combat.`,
    })

    let sent = 0
    const stale: string[] = []
    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch (err) {
        // 404/410 mean the subscription is dead — prune it
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) stale.push(row.id)
      }
    }

    if (stale.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', stale)
    }

    return json({ sent, pruned: stale.length, session_id })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
