import { supabase } from './supabase'

// VAPID public key — safe to ship in the client (it's public by design; the
// matching private key lives only in the notify-turn edge function).
// If it ever rotates, update this and the edge function's VAPID_PUBLIC_KEY together.
const VAPID_PUBLIC_KEY = 'BMtYrZNStp04pBpdbYwXkVKqMn5TPgvYDvkshQcKsIDvHCIAWKq5CiTCal5-cvykjrowkDvYFOjZWD-XiumAqYc'

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

/** True when the browser can actually deliver background push (SW + Push API + Notification). */
export function pushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** iOS/iPadOS only allows web push when the site is installed to the Home Screen. */
export function isIOS(): boolean {
  const ua = navigator.userAgent
  const iOSDevice = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ reports as Mac; detect via touch points
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOS
}

/** Is the app running as an installed PWA (Home Screen / standalone)? */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * Show the "Add to Home Screen to enable alerts" hint only where it's both
 * relevant and actionable: an iPhone/iPad, in Safari, not already installed.
 */
export function shouldShowIosInstallHint(): boolean {
  return isIOS() && !isStandalone()
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/**
 * Subscribe this device to push and store the subscription against the
 * participant. Requests notification permission as part of the flow.
 * Returns 'ok' | 'denied' | 'unsupported' | 'error' so the UI can guide the user.
 */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  // Ensure the SW is registered, then wait for it to become active
  await registerServiceWorker()
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

async function subscribeAndStore(
  reg: ServiceWorkerRegistration,
  participantId: string,
  sessionId: string,
): Promise<boolean> {
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      participant_id: participantId,
      session_id: sessionId,
      endpoint: json.endpoint,
      subscription: json,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.warn('storing push subscription failed:', error)
    return false
  }
  return true
}

/**
 * Interactive enable — call from a user gesture (the toggle). Prompts for
 * permission, subscribes, and stores the subscription.
 */
export async function enablePushForParticipant(
  participantId: string,
  sessionId: string,
): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported'
  try {
    const reg = await getRegistration()
    if (!reg) return 'unsupported'

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    return (await subscribeAndStore(reg, participantId, sessionId)) ? 'ok' : 'error'
  } catch (e) {
    console.warn('enablePush failed:', e)
    return 'error'
  }
}

/**
 * Silent reconciliation — call on load when notifications are already enabled.
 * Only subscribes if permission is *already* granted (no prompt), so it can run
 * without a user gesture. Heals the "flag on but no subscription on this device"
 * state (e.g. flag was set in Safari, then the app was installed to the Home Screen).
 * Returns true if a subscription is now in place.
 */
export async function ensurePushSubscription(
  participantId: string,
  sessionId: string,
): Promise<boolean> {
  if (!pushSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    const reg = await getRegistration()
    if (!reg) return false
    return await subscribeAndStore(reg, participantId, sessionId)
  } catch (e) {
    console.warn('ensurePush failed:', e)
    return false
  }
}

/** Does this device currently hold a push subscription? (independent of the DB flag) */
export async function hasLocalSubscription(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

/** Remove this device's subscription (best-effort) and forget it server-side. */
export async function disablePushForParticipant(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.toJSON().endpoint
    await sub.unsubscribe().catch(() => {})
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
  } catch (e) {
    console.warn('disablePush failed:', e)
  }
}

/**
 * Ask the server to push a "your turn" notification to whoever owns this
 * combatant. Fire-and-forget — never block turn advancement on it.
 */
export function pingTurn(sessionId: string, combatantId: string): void {
  try {
    supabase.functions
      .invoke('notify-turn', { body: { session_id: sessionId, combatant_id: combatantId } })
      .catch(() => {})
  } catch {
    /* noop */
  }
}

/** Legacy in-app foreground notification (works on desktop when the tab is open;
 *  no-op on iOS). Kept as a complement to server push, not a replacement. */
export function fireLocalNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'combat-turn', renotify: true } as NotificationOptions)
  } catch {
    /* iOS throws on the constructor — ignore */
  }
}
