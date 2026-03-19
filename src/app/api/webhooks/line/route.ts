import { createHmac } from 'crypto'

// ─── LINE webhook stub ────────────────────────────────────────────────────────
// Receives events from LINE Messaging API. Currently logs events to console.
// Phase F will wire up reply logic (confirm booking, status updates, etc.)

function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret)
    .update(body)
    .digest('base64')
  return expected === signature
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  // Always verify in production; in dev without secret, allow through
  if (process.env.LINE_CHANNEL_SECRET) {
    if (!verifyLineSignature(rawBody, signature)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Log events for now — Phase F will process these
  console.log('[LINE webhook]', JSON.stringify(body, null, 2))

  // LINE requires a 200 response immediately
  return Response.json({ status: 'ok' })
}
