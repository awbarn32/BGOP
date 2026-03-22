/**
 * LINE Profile API
 * Fetches display name and picture URL for a LINE userId.
 * Returns null if the request fails or the token is not configured.
 */

export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl: string | null
  statusMessage?: string
}

export async function fetchLineProfile(lineUserId: string): Promise<LineProfile | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.warn('[line/profile] LINE_CHANNEL_ACCESS_TOKEN not set')
    return null
  }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      console.warn('[line/profile] profile fetch failed', res.status, lineUserId)
      return null
    }

    return (await res.json()) as LineProfile
  } catch (err) {
    console.error('[line/profile] error', err)
    return null
  }
}
