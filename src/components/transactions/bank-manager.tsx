'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { formatCurrency } from '@/lib/utils'
import { RefreshCw, Trash2 } from 'lucide-react'

interface LinkedItem {
  id: string
  institution_name: string | null
  last_synced_at: string | null
  error: string | null
  accounts: { id: string; name: string; mask: string | null; type: string; current_balance: number | null }[]
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body
}

interface BankManagerProps {
  // Called after anything that may have changed transactions or balances
  onSynced: () => void
}

export function BankManager({ onSynced }: BankManagerProps) {
  const { data: items, mutate } = useSWR('plaid-items', () => api<LinkedItem[]>('/api/plaid/items'))
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [busy, setBusy] = useState<'link' | 'sync' | 'unlink' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<LinkedItem | null>(null)

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setLinkToken(null)
      setBusy('link')
      try {
        await api('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token, institution_name: metadata.institution?.name }),
        })
        setMessage('Linked. Transactions can take a few minutes to show up at first. Hit sync again shortly.')
      } catch (e) {
        setMessage((e as Error).message)
      }
      setBusy(null)
      mutate()
      onSynced()
    },
    onExit: () => {
      setLinkToken(null)
      setBusy(null)
    },
  })

  // Opens Link as soon as a fresh token is ready
  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function startLink() {
    setMessage(null)
    setBusy('link')
    try {
      const { link_token } = await api<{ link_token: string }>('/api/plaid/link-token', { method: 'POST' })
      setLinkToken(link_token)
    } catch (e) {
      setMessage((e as Error).message)
      setBusy(null)
    }
  }

  async function syncNow() {
    setMessage(null)
    setBusy('sync')
    try {
      const { errors } = await api<{ errors: string[] }>('/api/plaid/sync', { method: 'POST' })
      if (errors.length) setMessage(errors.join('\n'))
    } catch (e) {
      setMessage((e as Error).message)
    }
    setBusy(null)
    mutate()
    onSynced()
  }

  async function handleConfirmUnlink() {
    if (!confirmTarget) return
    setBusy('unlink')
    try {
      await api(`/api/plaid/items/${confirmTarget.id}`, { method: 'DELETE' })
    } catch (e) {
      setMessage((e as Error).message)
    }
    setBusy(null)
    setConfirmTarget(null)
    mutate()
    onSynced()
  }

  return (
    <div className="flex flex-col gap-4">
      {items?.length ? (
        <div className="flex flex-col gap-3">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {item.institution_name ?? 'Bank'}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {item.last_synced_at ? `Synced ${new Date(item.last_synced_at).toLocaleString()}` : 'Not synced yet'}
                  </span>
                </div>
                <button
                  onClick={() => setConfirmTarget(item)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Unlink bank"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {item.error && (
                <p className="px-4 py-2 text-xs text-red-500 break-words">{item.error}</p>
              )}
              <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                {item.accounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                      {a.name}{a.mask ? ` ••${a.mask}` : ''}
                    </span>
                    {a.current_balance != null && (
                      <span className="text-sm tabular-nums text-zinc-500 ml-3 shrink-0">
                        {formatCurrency(a.current_balance)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 text-center py-4">
          {items ? 'No banks linked yet' : 'Loading…'}
        </p>
      )}

      {message && <p className="text-xs text-zinc-500 whitespace-pre-line">{message}</p>}

      <div className="flex gap-2">
        {!!items?.length && (
          <Button variant="ghost" onClick={syncNow} disabled={!!busy} className="flex-1">
            <RefreshCw size={14} className={busy === 'sync' ? 'mr-1 animate-spin' : 'mr-1'} />
            {busy === 'sync' ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
        <Button onClick={startLink} disabled={!!busy} className="flex-1">
          {busy === 'link' ? 'Linking…' : 'Link a bank'}
        </Button>
      </div>

      <ConfirmDeleteDialog
        open={!!confirmTarget}
        title="Unlink bank?"
        description={`${confirmTarget?.institution_name ?? 'This bank'} will stop syncing. Imported transactions are kept.`}
        loading={busy === 'unlink'}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmUnlink}
      />
    </div>
  )
}
