import { describe, it, expect } from 'vitest'
import { readUserIdFromCookie } from './session-cookie'

const USER = '11111111-1111-1111-1111-111111111111'
const encode = (session: unknown) =>
  'base64-' + Buffer.from(JSON.stringify(session)).toString('base64')

describe('readUserIdFromCookie', () => {
  it('reads the user id the Supabase browser client stored', () => {
    const cookie = `sb-abcd-auth-token=${encode({ user: { id: USER } })}`
    expect(readUserIdFromCookie(cookie)).toBe(USER)
  })

  it('reassembles a session split across numbered chunks', () => {
    const full = encode({ user: { id: USER }, access_token: 'x'.repeat(40) })
    const half = Math.ceil(full.length / 2)
    const cookie = [
      `sb-abcd-auth-token.1=${full.slice(half)}`,
      `sb-abcd-auth-token.0=${full.slice(0, half)}`,
    ].join('; ')
    expect(readUserIdFromCookie(cookie)).toBe(USER)
  })

  it('ignores unrelated cookies on the same origin', () => {
    const cookie = `theme=dark; sb-abcd-auth-token=${encode({ user: { id: USER } })}; other=1`
    expect(readUserIdFromCookie(cookie)).toBe(USER)
  })

  it('returns null when no session cookie is present', () => {
    expect(readUserIdFromCookie('theme=dark')).toBeNull()
    expect(readUserIdFromCookie('')).toBeNull()
  })

  it('returns null rather than throwing on a cookie it cannot decode', () => {
    expect(readUserIdFromCookie('sb-abcd-auth-token=base64-@@@not-base64@@@')).toBeNull()
    expect(readUserIdFromCookie('sb-abcd-auth-token=' + encode({ no: 'user' }))).toBeNull()
  })
})
