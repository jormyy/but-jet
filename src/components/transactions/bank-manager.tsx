'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { formatCurrency } from '@/lib/utils'
import { fetchJson as api, fetchPlaidItems } from '@/lib/data'
import type { PlaidItemSummary } from '@/types'
import { RefreshCw, Trash2 } from 'lucide-react'

interface BankManagerProps {
  // Called after anything that may have changed transactions or balances
  onSynced: () => void
}

export function BankManager({ onSynced }: BankManagerProps) {
  const { data: items, mutate } = useSWR('plaid-items', fetchPlaidItems)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const linkKind = useRef<'bank' | 'investments'>('bank')
  const [busy, setBusy] = useState<'bank' | 'investments' | 'sync' | 'unlink' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<PlaidItemSummary | null>(null)

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setLinkToken(null)
      setBusy(linkKind.current)
      try {
        await api('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token, institution_name: metadata.institution?.name, kind: linkKind.current }),
        })
        setMessage(linkKind.current === 'investments'
          ? 'Linked. Its accounts now show up under Investments.'
          : 'Linked. Transactions can take a few minutes to show up at first, and will sync automatically when ready.')
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

  async function startLink(kind: 'bank' | 'investments') {
    linkKind.current = kind
    setMessage(null)
    setBusy(kind)
    try {
      const { link_token } = await api<{ link_token: string }>('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
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
                  aria-label="Unlink account"
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
                      {a.label}
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
          {items ? 'No accounts linked yet' : 'Loading…'}
        </p>
      )}

      {message && <p className="text-xs text-zinc-500 whitespace-pre-line">{message}</p>}

      <div className="flex gap-2">
        <Button onClick={() => startLink('bank')} disabled={!!busy} className="flex-1">
          {busy === 'bank' ? 'Linking…' : 'Link bank'}
        </Button>
        <Button onClick={() => startLink('investments')} disabled={!!busy} className="flex-1">
          {busy === 'investments' ? 'Linking…' : 'Link investments'}
        </Button>
      </div>
      {!!items?.length && (
        <Button variant="ghost" onClick={syncNow} disabled={!!busy}>
          <RefreshCw size={14} className={busy === 'sync' ? 'mr-1 animate-spin' : 'mr-1'} />
          {busy === 'sync' ? 'Syncing…' : 'Sync now'}
        </Button>
      )}

      <ConfirmDeleteDialog
        open={!!confirmTarget}
        title="Unlink account?"
        description={`${confirmTarget?.institution_name ?? 'This connection'} will stop syncing. Imported transactions are kept; synced investment holdings are removed.`}
        loading={busy === 'unlink'}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmUnlink}
      />
    </div>
  )
}
