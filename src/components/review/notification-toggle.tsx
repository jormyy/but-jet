'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Status = 'loading' | 'unsupported' | 'denied' | 'off' | 'on'

// VAPID public keys are base64url; PushManager wants raw bytes
function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Turns review notifications on/off for this device
export function NotificationToggle() {
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported()) {
      Promise.resolve().then(() => setStatus('unsupported'))
      return
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setStatus(Notification.permission === 'denied' ? 'denied' : sub ? 'on' : 'off'))
      .catch(() => setStatus('unsupported'))
  }, [])

  async function turnOn() {
    setBusy(true)
    setError(null)
    try {
      // Must run straight from the tap: iOS only allows the permission prompt from a user gesture
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const res = await fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not turn on notifications')
      setStatus('on')
      // The server sends this device a test notification right away
      if (body.testError) setError(`Notifications are on, but the test notification failed: ${body.testError}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setError(null)
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('off')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return null

  return (
    <div className="space-y-1">
      {status === 'on' && (
        <Button variant="ghost" size="sm" onClick={turnOff} disabled={busy}>
          <Bell size={14} className="mr-1" /> Notifications on
        </Button>
      )}
      {status === 'off' && (
        <Button size="sm" onClick={turnOn} disabled={busy}>
          <Bell size={14} className="mr-1" /> {busy ? 'Turning on…' : 'Notify me'}
        </Button>
      )}
      {status === 'denied' && (
        <p className="flex items-center gap-1 text-xs text-zinc-400">
          <BellOff size={12} /> Notifications are blocked for this app in your device settings
        </p>
      )}
      {status === 'unsupported' && (
        <p className="text-xs text-zinc-400">
          To get notifications on iPhone, add this app to your Home Screen and open it from there
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
