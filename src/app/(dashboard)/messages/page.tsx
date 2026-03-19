'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'

interface MessageEntry {
  id: string
  job_id: string | null
  customer_id: string | null
  channel: string
  message_type: string   // 'outbound' | 'inbound' | 'automated'
  content: string
  sent_at: string
  status: string | null
  customer: { id: string; full_name: string; phone: string | null; line_id: string | null } | null
}

interface CustomerThread {
  customer: MessageEntry['customer']
  messages: MessageEntry[]
  lastAt: string
  unread: boolean
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyLang, setReplyLang] = useState<'en' | 'th'>('en')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const threadBottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/messages?limit=500')
    const json = await res.json()
    setMessages(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // Scroll to bottom of thread when thread changes or new message arrives
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedCustomerId, messages.length])

  // Group messages into customer threads
  const threads: CustomerThread[] = []
  const seen = new Set<string>()
  for (const msg of messages) {
    const cid = msg.customer_id ?? 'unknown'
    if (!seen.has(cid)) {
      seen.add(cid)
      const customerMsgs = messages.filter((m) => m.customer_id === cid)
      threads.push({
        customer: msg.customer,
        messages: customerMsgs,
        lastAt: customerMsgs[0].sent_at,
        unread: customerMsgs.some((m) => m.message_type === 'inbound'),
      })
    }
  }

  const filteredThreads = threads.filter((t) => {
    if (!search) return true
    const name = t.customer?.full_name?.toLowerCase() ?? ''
    return name.includes(search.toLowerCase())
  })

  const selectedThread = threads.find((t) => t.customer?.id === selectedCustomerId)
  const threadMessages = selectedThread
    ? [...selectedThread.messages].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
    : []

  async function handleSend() {
    if (!replyText.trim() || !selectedThread?.customer) return
    const customer = selectedThread.customer

    // Find a job linked to this customer for the send-message API
    const linkedMsg = selectedThread.messages.find((m) => m.job_id)
    if (!linkedMsg?.job_id) {
      setSendResult({ ok: false, text: 'No linked job found for this customer. Send from Job Drawer instead.' })
      return
    }

    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch(`/api/jobs/${linkedMsg.job_id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim(), sender_language: replyLang }),
      })
      const json = await res.json()
      if (!res.ok || json.skipped) {
        setSendResult({ ok: false, text: json.error?.message ?? json.reason ?? 'Failed to send' })
      } else {
        setSendResult({ ok: true, text: json.demo ? 'Demo mode — logged but not sent' : `Sent to ${customer.full_name} via LINE ✓` })
        setReplyText('')
        // Refresh messages
        await fetchMessages()
      }
    } catch {
      setSendResult({ ok: false, text: 'Network error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Messages" />

      <div className="flex flex-1 overflow-hidden">
        {/* Thread list (left panel) */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-gray-800">
            <input
              type="text"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center pt-12">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <p className="text-gray-500 text-sm text-center pt-12 px-4">No messages yet</p>
            ) : (
              filteredThreads.map((thread) => {
                const cid = thread.customer?.id ?? 'unknown'
                const isSelected = selectedCustomerId === cid
                const lastMsg = thread.messages[0]
                return (
                  <button
                    key={cid}
                    onClick={() => { setSelectedCustomerId(cid); setSendResult(null) }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-800 transition-colors ${
                      isSelected ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {thread.customer?.full_name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {lastMsg.content.slice(0, 60)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-600">{timeAgo(thread.lastAt)}</p>
                        {thread.messages.some((m) => m.message_type === 'inbound') && (
                          <span className="inline-block w-2 h-2 rounded-full bg-green-400 mt-1" title="Has inbound messages" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        lastMsg.channel === 'line' ? 'bg-green-900/40 text-green-400' : 'bg-blue-900/40 text-blue-400'
                      }`}>
                        {lastMsg.channel.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600">{thread.messages.length} msg{thread.messages.length !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Message thread (right panel) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCustomerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="font-semibold text-white">{selectedThread?.customer?.full_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {selectedThread?.customer?.phone && <span>{selectedThread.customer.phone}</span>}
                    {selectedThread?.customer?.line_id && (
                      <span className="text-green-400">LINE: {selectedThread.customer.line_id}</span>
                    )}
                  </div>
                </div>
                {selectedThread?.customer?.id && (
                  <Link
                    href={`/customers/${selectedThread.customer.id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View profile →
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {threadMessages.map((msg) => {
                  const isOutbound = msg.message_type === 'outbound' || msg.message_type === 'automated'
                  return (
                    <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-sm rounded-2xl px-4 py-2.5 ${
                        isOutbound
                          ? 'bg-indigo-700 text-white rounded-tr-sm'
                          : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                      }`}>
                        {msg.message_type === 'automated' && (
                          <p className="text-xs text-indigo-300 mb-1">Automated</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <p className="text-xs opacity-60">{fmtTime(msg.sent_at)}</p>
                          {msg.job_id && (
                            <button
                              onClick={() => {}} // could open job drawer in future
                              className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                              title="Linked to job"
                            >
                              Job
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={threadBottomRef} />
              </div>

              {/* Reply box */}
              <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0">
                {!selectedThread?.customer?.line_id && (
                  <p className="text-xs text-amber-400 mb-2">⚠️ No LINE ID on file — messages cannot be sent</p>
                )}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setReplyLang('en')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${replyLang === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    Type in English
                  </button>
                  <button
                    onClick={() => setReplyLang('th')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${replyLang === 'th' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >
                    พิมพ์ภาษาไทย
                  </button>
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => { setReplyText(e.target.value); setSendResult(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
                    placeholder={replyLang === 'th' ? 'พิมพ์ข้อความ…' : 'Type a message… (Ctrl+Enter to send)'}
                    rows={2}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors self-end"
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">Claude AI translates automatically — customer receives both languages</p>
                {sendResult && (
                  <p className={`text-xs mt-1.5 ${sendResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {sendResult.text}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
