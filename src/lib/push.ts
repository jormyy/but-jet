import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

// Server-only: holds the VAPID private key. Never import from client components.
let configured = false
function configure() {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  // Push services use the subject to contact the sender about problems
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://but-jet.vercel.app', publicKey, privateKey)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  // Opened when the notification is tapped
  url: string
  // Notifications with the same tag replace each other instead of piling up
  tag?: string
}

interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

// Sends to one device. Devices that turned notifications off (or were uninstalled) answer 404/410
// and are removed. Returns an error message if sending failed.
export async function sendToDevice(supabase: SupabaseClient, sub: StoredSubscription, payload: PushPayload): Promise<string | null> {
  if (!configure()) return 'Notifications are not configured on the server'
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 24 * 60 * 60 }
    )
    return null
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    // Network errors (e.g. ECONNREFUSED) can have an empty message but carry a code
    const reason = (e as Error).message || (e as { code?: string }).code || String(e)
    console.error('Push failed:', status, reason)
    return `Push service error${status ? ` (${status})` : ''}: ${reason}`
  }
}

// Sends to every device the user turned notifications on for
export async function notifyUser(supabase: SupabaseClient, userId: string, payload: PushPayload) {
  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)
  await Promise.all((subs ?? []).map(s => sendToDevice(supabase, s, payload)))
}
