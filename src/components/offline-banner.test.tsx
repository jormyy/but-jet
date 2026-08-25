import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineBanner } from './offline-banner'

vi.mock('@/hooks/use-online', () => ({ useOnline: () => mockOnline }))
vi.mock('@/lib/swr-provider', () => ({ useLastSyncedAt: () => mockSyncedAt }))

let mockOnline = true
let mockSyncedAt: number | null = null

afterEach(() => { mockOnline = true; mockSyncedAt = null })

describe('OfflineBanner', () => {
  it('stays out of the way while the connection is up', () => {
    mockOnline = true
    const { container } = render(<OfflineBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dates the figures it is warning about, so cached money is not read as current', () => {
    mockOnline = false
    mockSyncedAt = new Date('2026-08-25T15:42:00').getTime()
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/Offline/)
    expect(screen.getByRole('status')).toHaveTextContent(/3:42/)
  })

  it('still warns when there is no recorded sync time', () => {
    mockOnline = false
    mockSyncedAt = null
    expect(screen.queryByRole('status')).toBeNull()
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/Offline/)
  })
})
