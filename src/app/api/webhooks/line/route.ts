/**
 * Compatibility webhook relay.
 * Primary processing lives in the Supabase Edge Function, but this route
 * forwards requests there so existing LINE webhook configurations do not break.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return Response.json({ error: 'Supabase URL not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')

  try {
    const relayHeaders = new Headers({ 'Content-Type': 'application/json' })
    if (signature) relayHeaders.set('x-line-signature', signature)

    const response = await fetch(`${supabaseUrl}/functions/v1/line-webhook`, {
      method: 'POST',
      headers: relayHeaders,
      body: rawBody,
    })

    const text = await response.text()

    return new Response(text || JSON.stringify({ status: 'ok' }), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch (error) {
    console.error('[line-webhook-relay] forward failed', error)
    return Response.json({ error: 'Webhook relay failed' }, { status: 502 })
  }
}
