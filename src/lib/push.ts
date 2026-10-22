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

// Sends to every device the user turned notifications on for. Devices that turned them off
// (or were uninstalled) answer 404/410 and are removed.
export async function notifyUser(supabase: SupabaseClient, userId: string, payload: PushPayload) {
  if (!configure()) return
  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)
  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 60 * 60 }
      )
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('Push failed:', status, (e as Error).message)
    }
  }))
}
