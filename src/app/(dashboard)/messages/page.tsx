'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'

interface MessageEntry {
  id: string
  job_id: string | null
  customer_id: string | null
  channel: string
  message_type: string
  content: string
  sent_at: string
  status: string | null
  customer: { id: string; full_name: string; phone: string | null; line_id: string | null } | null
}

interface CustomerThread {
  customer: MessageEntry['customer']
  messages: MessageEntry[]
  lastAt: string
  hasInbound: boolean
}

interface CustomerOption {
  id: string
  full_name: string
  line_id: string | null
  phone: string | null
}

const OUTBOUND_TYPES = new Set(['outbound', 'automated', 'direct_message'])

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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

  // New conversation modal
  const [showNewConvo, setShowNewConvo] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [newCustomerId, setNewCustomerId] = useState('')
  const [newText, setNewText] = useState('')
  const [newLang, setNewLang] = useState<'en' | 'th'>('en')
  const [newSending, setNewSending] = useState(false)
  const [newResult, setNewResult] = useState<{ ok: boolean; text: string } | null>(null)

  const threadBottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/messages?limit=500')
    const json = await res.json()
    setMessages(json.data ?? [])
    setLoading(false)
  }, [])

  // Initial load + 15-second poll for new inbound messages
  useEffect(() => {
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchMessages])

  // Scroll to bottom when thread changes or new message arrives
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedCustomerId, messages.length])

  // Load customers for new conversation modal
  useEffect(() => {
    if (!showNewConvo) return
    fetch('/api/customers?pageSize=200')
      .then((r) => r.json())
      .then((j) => setCustomers(j.data ?? []))
  }, [showNewConvo])

  // Group messages into customer threads (sorted: most recent first)
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
        hasInbound: customerMsgs.some((m) => m.message_type === 'inbound'),
      })
    }
  }

  const filteredThreads = threads.filter((t) => {
    if (!search) return true
    return (t.customer?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  })

  const selectedThread = threads.find((t) => t.customer?.id === selectedCustomerId)
  const threadMessages = selectedThread
    ? [...selectedThread.messages].sort((a, b) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      )
    : []

  async function handleSend() {
    if (!replyText.trim() || !selectedThread?.customer) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedThread.customer.id,
          text: replyText.trim(),
          sender_language: replyLang,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.skipped) {
        setSendResult({ ok: false, text: json.error?.message ?? json.reason ?? 'Failed to send' })
      } else {
        setSendResult({
          ok: true,
          text: json.demo
            ? 'Demo mode — logged but not sent via LINE'
            : `Sent to ${selectedThread.customer.full_name} via LINE ✓`,
        })
        setReplyText('')
        await fetchMessages()
      }
    } catch {
      setSendResult({ ok: false, text: 'Network error' })
    } finally {
      setSending(false)
    }
  }

  async function handleNewConvoSend() {
    if (!newCustomerId || !newText.trim()) return
    setNewSending(true)
    setNewResult(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: newCustomerId,
          text: newText.trim(),
          sender_language: newLang,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.skipped) {
        setNewResult({ ok: false, text: json.error?.message ?? json.reason ?? 'Failed to send' })
      } else {
        setNewResult({ ok: true, text: json.demo ? 'Demo mode — logged but not sent' : 'Sent ✓' })
        setNewText('')
        await fetchMessages()
        setSelectedCustomerId(newCustomerId)
        setTimeout(() => {
          setShowNewConvo(false)
          setNewCustomerId('')
          setNewResult(null)
        }, 1500)
      }
    } catch {
      setNewResult({ ok: false, text: 'Network error' })
    } finally {
      setNewSending(false)
    }
  }

  const filteredCustomers = customers.filter((c) =>
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Messages" />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Thread list (left) ─────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800 flex gap-2">
            <input
              type="text"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => { setShowNewConvo(true); setCustomerSearch(''); setNewText(''); setNewResult(null) }}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              title="New conversation"
            >
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center pt-12">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="text-center pt-12 px-4">
                <p className="text-gray-500 text-sm">No messages yet</p>
                <p className="text-gray-600 text-xs mt-2">Messages sent or received via LINE will appear here</p>
              </div>
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
                        <div className="flex items-center gap-1.5">
                          {thread.hasInbound && (
                            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="Has inbound messages" />
                          )}
                          <p className="text-sm font-medium text-white truncate">
                            {thread.customer?.full_name ?? 'Unknown'}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5 pl-3.5">
                          {lastMsg.content.slice(0, 55)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-600">{timeAgo(thread.lastAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-3.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        lastMsg.channel === 'line' ? 'bg-green-900/40 text-green-400' : 'bg-blue-900/40 text-blue-400'
                      }`}>
                        {lastMsg.channel.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600">
                        {thread.messages.length} msg{thread.messages.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Message thread (right) ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCustomerId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-sm">Select a conversation</p>
              <button
                onClick={() => { setShowNewConvo(true); setCustomerSearch(''); setNewText(''); setNewResult(null) }}
                className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Start new conversation
              </button>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="font-semibold text-white">{selectedThread?.customer?.full_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {selectedThread?.customer?.phone && <span>{selectedThread.customer.phone}</span>}
                    {selectedThread?.customer?.line_id ? (
                      <span className="text-green-400">LINE connected</span>
                    ) : (
                      <span className="text-amber-400">No LINE ID</span>
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
                  const isOutbound = OUTBOUND_TYPES.has(msg.message_type)
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
                        <div className="flex items-center justify-between gap-3 mt-1.5">
                          <p className="text-xs opacity-50">{fmtTime(msg.sent_at)}</p>
                          <div className="flex items-center gap-2">
                            {msg.status === 'failed' && (
                              <span className="text-xs text-red-400">Failed</span>
                            )}
                            {msg.job_id && (
                              <span className="text-xs opacity-40">Job</span>
                            )}
                          </div>
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
                  <p className="text-xs text-amber-400 mb-2">
                    ⚠️ No LINE ID on file — add one to the customer profile before sending
                  </p>
                )}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setReplyLang('en')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      replyLang === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    Type in English
                  </button>
                  <button
                    onClick={() => setReplyLang('th')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      replyLang === 'th' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
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
                <p className="text-xs text-gray-600 mt-1">
                  AI translates automatically — customer receives both Thai and English
                </p>
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

      {/* ── New Conversation Modal ────────────────────────────────────────────── */}
      {showNewConvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowNewConvo(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">New Conversation</h2>
              <button onClick={() => setShowNewConvo(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Customer picker */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Customer</label>
              <input
                type="text"
                placeholder="Search by name…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
                {filteredCustomers.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No customers found</p>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setNewCustomerId(c.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                        newCustomerId === c.id ? 'bg-indigo-700 text-white' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-medium">{c.full_name}</span>
                      {c.line_id ? (
                        <span className="ml-2 text-xs text-green-400">LINE ✓</span>
                      ) : (
                        <span className="ml-2 text-xs text-amber-400">No LINE</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Language */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNewLang('en')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  newLang === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Type in English
              </button>
              <button
                onClick={() => setNewLang('th')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  newLang === 'th' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                พิมพ์ภาษาไทย
              </button>
            </div>

            <textarea
              value={newText}
              onChange={(e) => { setNewText(e.target.value); setNewResult(null) }}
              placeholder={newLang === 'th' ? 'พิมพ์ข้อความ…' : 'Type your message…'}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none mb-3"
            />

            {newResult && (
              <p className={`text-xs mb-3 ${newResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {newResult.text}
              </p>
            )}

            <button
              onClick={handleNewConvoSend}
              disabled={!newCustomerId || !newText.trim() || newSending}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {newSending ? 'Sending…' : 'Send via LINE'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
