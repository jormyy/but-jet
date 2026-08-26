// The signed-in user's id, read straight from the cookie the Supabase browser
// client keeps the session in. `auth.getSession()` returns the same thing, but
// only after constructing the auth client and awaiting it — long enough that a
// warm launch would paint an empty dashboard before its cached figures.

const CHUNK = /^sb-.+-auth-token(?:\.(\d+))?$/

export function readUserIdFromCookie(cookieHeader: string): string | null {
  const chunks: { index: number; value: string }[] = []

  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const match = CHUNK.exec(part.slice(0, eq).trim())
    if (match) chunks.push({ index: Number(match[1] ?? 0), value: part.slice(eq + 1).trim() })
  }
  if (chunks.length === 0) return null

  const raw = chunks.sort((a, b) => a.index - b.index).map(c => c.value).join('')
  const encoded = raw.startsWith('base64-') ? raw.slice('base64-'.length) : decodeURIComponent(raw)

  try {
    const json = raw.startsWith('base64-') ? atob(encoded) : encoded
    return JSON.parse(json)?.user?.id ?? null
  } catch {
    return null
  }
}
