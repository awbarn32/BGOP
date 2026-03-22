/**
 * Conversation recording service.
 *
 * Single write path for all inbound and outbound messages into the
 * conversation_threads + conversation_messages model.
 *
 * Also writes a fallback row to message_log for audit trail continuity.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface RecordMessageOptions {
  lineUserId: string
  customerId: string | null
  direction: 'inbound' | 'outbound' | 'system'
  senderRole: 'customer' | 'owner' | 'pa' | 'bot'
  messageType: string
  bodyText: string | null
  deliveryStatus?: string
  sentByUserId?: string
  rawPayload?: Record<string, unknown>
  activeJobId?: string | null
  skipAuditLog?: boolean
}

export interface RecordedConversationMessage {
  threadId: string
  messageId: string
}

export async function recordConversationMessage(
  opts: RecordMessageOptions
): Promise<RecordedConversationMessage | null> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const threadUpsertData: Record<string, unknown> = {
    channel: 'line',
    line_user_id: opts.lineUserId,
    customer_id: opts.customerId,
    active_job_id: opts.activeJobId ?? null,
    latest_message_at: now,
    latest_message_preview: (opts.bodyText ?? '').slice(0, 100),
  }

  if (opts.direction === 'inbound') {
    threadUpsertData.last_inbound_at = now
  } else {
    threadUpsertData.last_outbound_at = now
  }

  const { data: thread, error: threadErr } = await supabase
    .from('conversation_threads')
    .upsert(threadUpsertData, { onConflict: 'channel,line_user_id' })
    .select('id')
    .single()

  if (threadErr || !thread) {
    console.error('[conversations] thread upsert failed', threadErr)
    return null
  }

  const { data: message, error: msgErr } = await supabase
    .from('conversation_messages')
    .insert({
      thread_id: thread.id,
      direction: opts.direction,
      sender_role: opts.senderRole,
      message_type: opts.messageType,
      body_text: opts.bodyText,
      delivery_status: opts.deliveryStatus ?? 'sent',
      sent_by_user_id: opts.sentByUserId ?? null,
      raw_payload: opts.rawPayload ?? null,
    })
    .select('id')
    .single()

  if (msgErr || !message) {
    console.error('[conversations] message insert failed', msgErr)
    return null
  }

  const { data: staffUsers, error: staffErr } = await supabase
    .from('users')
    .select('id')
    .in('role', ['owner', 'pa'])

  if (staffErr) {
    console.warn('[conversations] staff lookup failed', staffErr)
  } else if (staffUsers && staffUsers.length > 0) {
    const stateRows = staffUsers.map((staffUser) => ({
      thread_id: thread.id,
      user_id: staffUser.id,
      last_read_message_id: null,
      last_read_at: null,
      is_resolved: opts.direction === 'inbound' ? false : false,
      resolved_at: null,
    }))

    const { error: stateErr } = await supabase
      .from('conversation_thread_user_state')
      .upsert(stateRows, {
        onConflict: 'thread_id,user_id',
        ignoreDuplicates: opts.direction !== 'inbound',
      })

    if (stateErr) {
      console.warn('[conversations] state upsert failed', stateErr)
    }
  }

  if (!opts.skipAuditLog) {
    const { error: logErr } = await supabase
      .from('message_log')
      .insert({
        customer_id: opts.customerId,
        job_id: opts.activeJobId ?? null,
        channel: 'line',
        message_type: opts.direction === 'inbound' ? 'inbound' : opts.messageType,
        content: opts.bodyText,
        status: opts.deliveryStatus ?? 'sent',
      })

    if (logErr) {
      console.warn('[conversations] message_log fallback write failed', logErr)
    }
  }

  return {
    threadId: thread.id,
    messageId: message.id,
  }
}
