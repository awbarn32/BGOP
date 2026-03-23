/**
 * LINE Messaging API client
 *
 * Wraps push message and Flex Message sending.
 * All methods check LINE_CHANNEL_ACCESS_TOKEN and gracefully
 * no-op (log) when NEXT_PUBLIC_DEMO_MODE=true or token is absent.
 */

import { createHmac } from 'crypto'

const LINE_API = 'https://api.line.me/v2/bot/message'

function getToken(): string | null {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? null
}

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextMessage {
  type: 'text'
  text: string
}

export interface FlexMessage {
  type: 'flex'
  altText: string
  contents: Record<string, unknown>
}

export interface ImageMessage {
  type: 'image'
  originalContentUrl: string
  previewImageUrl: string
}

export type LineMessage = TextMessage | FlexMessage | ImageMessage

export interface PushResult {
  ok: boolean
  error?: string
  demo?: boolean
}

// ── Send push message(s) to a LINE user ───────────────────────────────────────

export async function pushMessage(
  lineUserId: string,
  messages: LineMessage[]
): Promise<PushResult> {
  if (isDemoMode()) {
    console.log('[LINE demo] push to', lineUserId, JSON.stringify(messages, null, 2))
    return { ok: true, demo: true }
  }

  const token = getToken()
  if (!token) {
    console.error('[LINE] LINE_CHANNEL_ACCESS_TOKEN not set')
    return { ok: false, error: 'LINE token not configured' }
  }

  try {
    const res = await fetch(`${LINE_API}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[LINE] push failed', res.status, body)
      return { ok: false, error: `LINE API ${res.status}: ${body}` }
    }

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[LINE] push error', msg)
    return { ok: false, error: msg }
  }
}

// ── Build a Flex Message bubble for scope change approval ─────────────────────

export function buildScopeApprovalFlex(params: {
  scopeChangeId: string
  description: string   // bilingual: 'Thai / English'
  amountThb: number
  customerName: string
}): FlexMessage {
  const { scopeChangeId, description, amountThb, customerName } = params

  // Parse bilingual description
  const [descTh, descEn] = description.includes(' / ')
    ? description.split(' / ')
    : [description, description]

  return {
    type: 'flex',
    altText: `Butler Garage — ขออนุมัติงานเพิ่ม / Scope change approval: ${amountThb.toLocaleString()} THB`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1F2937',
        contents: [
          {
            type: 'text',
            text: '🔧 Butler Garage',
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: `สวัสดีคุณ ${customerName}`,
            size: 'sm',
            color: '#6B7280',
          },
          {
            type: 'text',
            text: 'พบงานเพิ่มเติมที่ต้องการการอนุมัติ / Additional work requires your approval',
            size: 'sm',
            wrap: true,
          },
          { type: 'separator' },
          {
            type: 'text',
            text: `${descTh}`,
            wrap: true,
            size: 'md',
            weight: 'bold',
          },
          {
            type: 'text',
            text: `${descEn}`,
            wrap: true,
            size: 'sm',
            color: '#6B7280',
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ยอดรวม / Total:', size: 'sm', flex: 2 },
              {
                type: 'text',
                text: `฿${amountThb.toLocaleString()}`,
                size: 'md',
                weight: 'bold',
                color: '#059669',
                flex: 1,
                align: 'end',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#059669',
            action: {
              type: 'postback',
              label: 'อนุมัติ / Approve',
              data: `scope_approve:${scopeChangeId}`,
              displayText: 'อนุมัติ / Approve',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: 'ปฏิเสธ / Decline',
              data: `scope_decline:${scopeChangeId}`,
              displayText: 'ปฏิเสธ / Decline',
            },
          },
        ],
      },
    },
  }
}

// ── Verify LINE webhook signature ─────────────────────────────────────────────

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
  return expected === signature
}
