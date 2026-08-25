// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { updateSession } from './middleware'

const getClaims = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims, getSession: notAllowed, getUser: notAllowed } }),
}))

function notAllowed(): never {
  throw new Error('the gate must verify the token, not trust the cookie')
}

const request = (path: string) => new NextRequest(new URL(path, 'https://but-jet.test'))

beforeEach(() => getClaims.mockReset())

describe('proxy session gate', () => {
  it('sends an unauthenticated visitor to the login page', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    const res = await updateSession(request('/net-worth'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('lets an authenticated visitor through', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
    const res = await updateSession(request('/net-worth'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('sends an already-authenticated visitor away from the login page', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
    const res = await updateSession(request('/login'))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/')
  })

  it('treats a token that fails verification as unauthenticated', async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: 'bad signature' } })
    const res = await updateSession(request('/'))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('does not lock an unauthenticated visitor out of the login page', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })
    const res = await updateSession(request('/login'))
    expect(res.headers.get('location')).toBeNull()
  })
})
