import { describe, it, expect, afterEach } from 'vitest'
import { useRef, useState } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useModalBehaviour } from './use-modal-behaviour'

function Harness({ startOpen = true }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  const panel = useRef<HTMLDivElement>(null)
  useModalBehaviour({ open, onClose: () => setOpen(false), panelRef: panel })
  return (
    <div>
      <button onClick={() => setOpen(true)}>outside</button>
      {open && (
        <div ref={panel} data-testid="panel">
          <button>first</button>
          <button>second</button>
        </div>
      )}
    </div>
  )
}

afterEach(cleanup)

describe('useModalBehaviour', () => {
  it('moves focus into the dialog when it opens', async () => {
    render(<Harness />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))
  })

  it('keeps Tab inside the dialog instead of walking the page behind it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'second' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))
  })

  it('wraps backwards too', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'second' }))
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('panel')).toBeNull()
  })

  it('returns focus to whatever opened it', async () => {
    const user = userEvent.setup()
    render(<Harness startOpen={false} />)
    const opener = screen.getByRole('button', { name: 'outside' })
    await user.click(opener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'first' }))

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('panel')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('stops the page behind the dialog scrolling', () => {
    const { unmount } = render(<Harness />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
