'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'

type Language = 'en' | 'th'

interface ThreadCustomer {
  id: string
  full_name: string
  line_id: string | null
  line_display_name: string | null
  line_picture_url: string | null
  phone: string | null
  preferred_language: Language
  consent_to_message: boolean
}

interface ThreadUserState {
  last_read_at: string | null
  is_resolved: boolean
  resolved_at?: string | null
}

interface ThreadItem {
  id: string
  channel: string
  line_user_id: string | null
  customer_id: string | null
  active_job_id: string | null
  latest_message_at: string | null
  latest_message_preview: string | null
  last_inbound_at: string | null
  last_outbound_at: string | null
  resolved_at: string | null
  customer: ThreadCustomer | null
  user_state: ThreadUserState[] | ThreadUserState | null
}

interface ConversationMessage {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  sender_role: string | null
  message_type: string
  body_text: string | null
  delivery_status: string
  sent_at: string
  sent_by_user_id: string | null
  translation_status?: 'ready' | 'source_only' | 'missing'
  localization?: {
    source_language: 'th' | 'en' | 'unknown'
    text_en: string | null
    text_th: string | null
    translated_at?: string | null
  } | null
}

interface ContextVehicle {
  id: string
  make: string
  model: string
  year: number
  license_plate: string | null
  color: string | null
  current_mileage: number | null
  ownership_status: string
}

interface ContextJob {
  id: string
  bucket: string
  status: string
  description: string
  revenue_stream: string | null
  created_at: string
}

interface ContextInvoice {
  id: string
  invoice_number: string | null
  status: string
  total_amount: number
  deposit_amount: number | null
  paid_amount: number | null
  invoice_date: string
}

interface CustomerContext {
  customer: {
    id: string
    full_name: string
    phone: string | null
    email: string | null
    line_id: string | null
    line_display_name: string | null
    line_picture_url: string | null
    preferred_language: Language
    consent_to_message: boolean
    dormant: boolean
    acquisition_source: string | null
    notes: string | null
    created_at: string
  }
  vehicles: ContextVehicle[]
  recent_jobs: ContextJob[]
  outstanding_invoices: ContextInvoice[]
  outstanding_balance: number
}

function timeAgo(iso: string | null) {
  if (!iso) return ''

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
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number) {
  return `฿${Number(amount ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

function getUserState(thread: ThreadItem): ThreadUserState | null {
  if (!thread.user_state) return null
  return Array.isArray(thread.user_state) ? thread.user_state[0] ?? null : thread.user_state
}

function getDisplayName(customer: ThreadCustomer | CustomerContext['customer'] | null) {
  if (!customer) return 'Unknown customer'
  return customer.line_display_name ?? customer.full_name
}

function getThreadName(thread: ThreadItem) {
  if (thread.customer) return getDisplayName(thread.customer)
  if (thread.line_user_id) return `LINE User ${thread.line_user_id.slice(-6)}`
  return 'Unknown customer'
}

function getAvatarInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function getAvatarColor(name: string) {
  const palette = [
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-sky-600',
    'bg-teal-600',
  ]
  const seed = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palette[seed % palette.length]
}

function getUnread(thread: ThreadItem) {
  const state = getUserState(thread)
  if (state?.is_resolved) return false
  if (!thread.last_inbound_at) return false
  if (!state?.last_read_at) return true
  return thread.last_inbound_at > state.last_read_at
}

function getLocalizedText(message: ConversationMessage, operatorLanguage: Language) {
  if (!message.localization) return message.body_text ?? ''
  return operatorLanguage === 'th'
    ? message.localization.text_th ?? message.body_text ?? ''
    : message.localization.text_en ?? message.body_text ?? ''
}

function getMessageDisplay(message: ConversationMessage, operatorLanguage: Language) {
  const rawText = message.body_text ?? ''
  const localizedText = getLocalizedText(message, operatorLanguage)
  const sourceLanguage = message.localization?.source_language ?? 'unknown'

  if (message.direction === 'inbound' && sourceLanguage === 'en' && localizedText.trim() !== rawText.trim()) {
    return {
      primary: rawText,
      secondary: localizedText,
    }
  }

  if (message.direction === 'outbound' && message.localization) {
    const sourceText =
      sourceLanguage === 'th'
        ? message.localization.text_th
        : sourceLanguage === 'en'
        ? message.localization.text_en
        : null

    if (sourceText && sourceText.trim() !== rawText.trim()) {
      return {
        primary: rawText,
        secondary: sourceText,
      }
    }
  }

  return {
    primary: rawText,
    secondary: null,
  }
}

function Avatar({
  name,
  imageUrl,
  size,
}: {
  name: string
  imageUrl?: string | null
  size: 36 | 56
}) {
  const sizeClass = size === 56 ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-sm'

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={`${sizeClass} rounded-full object-cover`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} ${getAvatarColor(name)} flex items-center justify-center rounded-full font-semibold text-white`}
    >
      {getAvatarInitial(name)}
    </div>
  )
}

function ContextSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-20 rounded-xl bg-gray-800 animate-pulse" />
      <div className="h-24 rounded-xl bg-gray-800 animate-pulse" />
      <div className="h-24 rounded-xl bg-gray-800 animate-pulse" />
    </div>
  )
}

function DraftGenerationState({ mode }: { mode: 'draft' | 'revise' }) {
  const title = mode === 'revise' ? 'Revising draft' : 'Generating first draft'
  const subtitle =
    mode === 'revise'
      ? 'Applying the PA notes and refreshing the customer preview.'
      : 'Building a Thai draft and customer-facing preview from the thread.'

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-[linear-gradient(135deg,rgba(79,70,229,0.18),rgba(15,23,42,0.9))] p-4 shadow-[0_18px_40px_rgba(55,48,163,0.18)]">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-300 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-200" />
        </span>
        <div>
          <p className="text-sm font-medium text-white">{title}...</p>
          <p className="text-xs text-indigo-100/80">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-2 rounded-full bg-white/10">
          <div className="h-2 w-2/3 animate-pulse rounded-full bg-indigo-300/70" />
        </div>
        <div className="h-2 w-5/6 rounded-full bg-white/10 animate-pulse" />
        <div className="h-2 w-3/5 rounded-full bg-white/10 animate-pulse" />
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const { toast } = useToast()
  const threadBottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const suggestInFlightRef = useRef(false)
  const operatorLanguage: Language = 'th'

  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [context, setContext] = useState<CustomerContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [assistError, setAssistError] = useState<string | null>(null)

  const [replyText, setReplyText] = useState('')
  const [revisionPrompt, setRevisionPrompt] = useState('')
  const [recipientLang, setRecipientLang] = useState<Language>('th')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [resolving, setResolving] = useState(false)
  const [hydratingAssist, setHydratingAssist] = useState(false)
  const [suggestingReply, setSuggestingReply] = useState(false)
  const [suggestionMode, setSuggestionMode] = useState<'draft' | 'revise'>('draft')
  const [replyPreview, setReplyPreview] = useState<string | null>(null)

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setThreadsLoading(true)

    try {
      const res = await fetch('/api/messages/threads?limit=50')
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Failed to load conversations')
      }

      setThreads(json.data ?? [])
    } catch (err) {
      if (!silent) {
        const message = err instanceof Error ? err.message : 'Failed to load conversations'
        toast(message, 'error')
      }
    } finally {
      if (!silent) setThreadsLoading(false)
    }
  }, [toast])

  const fetchThreadMessages = useCallback(async (threadId: string) => {
    setMessagesLoading(true)

    try {
      const res = await fetch(`/api/messages/threads/${threadId}/messages`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Failed to load messages')
      }

      setMessages(json.data ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load messages'
      toast(message, 'error')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [toast])

  const fetchCustomerContext = useCallback(async (threadId: string) => {
    setContextLoading(true)
    setContextError(null)

    try {
      const res = await fetch(`/api/messages/threads/${threadId}/customer-context`)
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 404) {
          setContext(null)
          setContextError('Customer profile not linked to this conversation.')
          return
        }
        throw new Error(json.error?.message ?? 'Failed to load customer context')
      }

      setContext(json.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load customer context'
      setContext(null)
      setContextError(message)
    } finally {
      setContextLoading(false)
    }
  }, [])

  const markThreadRead = useCallback(async (threadId: string) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread

        const nextState: ThreadUserState = {
          ...(getUserState(thread) ?? { last_read_at: null, is_resolved: false, resolved_at: null }),
          last_read_at: new Date().toISOString(),
        }

        return { ...thread, user_state: [nextState] }
      })
    )

    try {
      await fetch(`/api/messages/threads/${threadId}/read`, { method: 'POST' })
    } catch {
      // Ignore read-mark errors to keep selection fast.
    }
  }, [])

  const hydrateThreadAssist = useCallback(async (threadId: string) => {
    setHydratingAssist(true)

    try {
      const res = await fetch(`/api/messages/threads/${threadId}/assist/hydrate`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Failed to sync translations')
      }

      setAssistError(json.data?.unavailableReason ?? null)

      if ((json.data?.translatedCount ?? 0) > 0 || json.data?.summaryUpdated) {
        await fetchThreadMessages(threadId)
      }
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : 'Failed to sync translations')
      console.warn('[messages] assist hydrate failed', err)
    } finally {
      setHydratingAssist(false)
    }
  }, [fetchThreadMessages])

  useEffect(() => {
    void fetchThreads()

    pollRef.current = setInterval(() => {
      void fetchThreads(true)
    }, 15000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchThreads])

  useEffect(() => {
    if (selectedThreadId && !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(null)
      setMessages([])
      setContext(null)
    }
  }, [threads, selectedThreadId])

  useEffect(() => {
    const selectedThread = threads.find((thread) => thread.id === selectedThreadId)
    if (selectedThread?.customer?.preferred_language) {
      setRecipientLang(selectedThread.customer.preferred_language)
    }
  }, [threads, selectedThreadId])

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([])
      setContext(null)
      setContextError(null)
      setAssistError(null)
      setReplyText('')
      setRevisionPrompt('')
      setReplyPreview(null)
      return
    }

    setSendResult(null)
    setAssistError(null)
    setReplyText('')
    setRevisionPrompt('')
    setReplyPreview(null)
    void markThreadRead(selectedThreadId)
    void fetchThreadMessages(selectedThreadId)
    void fetchCustomerContext(selectedThreadId)
    void hydrateThreadAssist(selectedThreadId)
  }, [selectedThreadId, fetchThreadMessages, fetchCustomerContext, hydrateThreadAssist, markThreadRead])

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedThreadId])

  useEffect(() => {
    if (!selectedThreadId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages-thread-${selectedThreadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_messages',
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => {
          void markThreadRead(selectedThreadId)
          void fetchThreadMessages(selectedThreadId)
          void fetchThreads(true)
          void hydrateThreadAssist(selectedThreadId)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedThreadId, fetchThreadMessages, fetchThreads, hydrateThreadAssist, markThreadRead])

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null

  const filteredThreads = threads.filter((thread) => {
    if (!search) return true

    const haystack = [
      getDisplayName(thread.customer),
      thread.customer?.full_name ?? '',
      thread.latest_message_preview ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(search.toLowerCase())
  })

  async function handleSend() {
    if (!replyText.trim() || !selectedThread?.customer?.id) return

    setSending(true)
    setSendResult(null)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedThread.customer.id,
          text: replyText.trim(),
          sender_language: operatorLanguage,
          recipient_language: recipientLang,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.skipped) {
        setSendResult({
          ok: false,
          text: json.error?.message ?? json.reason ?? 'Failed to send',
        })
        return
      }

      setSendResult({
        ok: true,
        text: json.demo ? 'Demo mode - logged but not sent via LINE' : 'Sent via LINE',
      })
      setReplyText('')
      setReplyPreview(null)

      await Promise.all([
        fetchThreads(true),
        fetchThreadMessages(selectedThread.id),
      ])
    } catch {
      setSendResult({ ok: false, text: 'Network error' })
    } finally {
      setSending(false)
    }
  }

  const requestSuggestedReply = useCallback(async (args?: {
    silent?: boolean
    revisionRequest?: string
  }) => {
    if (!selectedThreadId || suggestInFlightRef.current) return false

    const silent = args?.silent ?? false
    const revisionRequest = args?.revisionRequest?.trim() ?? ''
    const currentDraft = replyText.trim()
    const mode: 'draft' | 'revise' = currentDraft ? 'revise' : 'draft'

    suggestInFlightRef.current = true
    setSuggestionMode(mode)
    setSuggestingReply(true)
    if (!silent) setSendResult(null)

    try {
      const res = await fetch(`/api/messages/threads/${selectedThreadId}/assist/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_language: recipientLang,
          current_draft_th: currentDraft || undefined,
          revision_request: revisionRequest || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Failed to suggest reply')
      }

      setReplyText(json.data?.draft_th ?? '')
      setReplyPreview(json.data?.preview_for_customer ?? null)
      return true
    } catch (err) {
      if (!silent) {
        toast(err instanceof Error ? err.message : 'Failed to suggest reply', 'error')
      } else {
        console.warn('[messages] reply suggestion failed', err)
      }
      return false
    } finally {
      suggestInFlightRef.current = false
      setSuggestingReply(false)
    }
  }, [recipientLang, replyText, selectedThreadId, toast])

  async function handleResolve() {
    if (!selectedThreadId) return

    setResolving(true)
    try {
      const res = await fetch(`/api/messages/threads/${selectedThreadId}/resolve`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Failed to resolve conversation')
      }

      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== selectedThreadId) return thread

          const nextState: ThreadUserState = {
            ...(getUserState(thread) ?? { last_read_at: null, is_resolved: false, resolved_at: null }),
            is_resolved: true,
            resolved_at: new Date().toISOString(),
          }

          return { ...thread, user_state: [nextState] }
        })
      )

      await fetchThreads(true)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to resolve conversation', 'error')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header title="Messages" />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 border-r border-gray-800 flex flex-col">
          <div className="border-b border-gray-800 p-3">
            <input
              type="search"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {threadsLoading ? (
              <div className="flex justify-center pt-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="px-4 pt-12 text-center">
                <p className="text-sm text-gray-500">No conversations yet</p>
                <p className="mt-2 text-xs text-gray-600">Inbound LINE messages will appear here.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const displayName = getThreadName(thread)
                const state = getUserState(thread)
                const isSelected = selectedThreadId === thread.id
                const unread = getUnread(thread)
                const preview = (thread.latest_message_preview ?? '').slice(0, 50)

                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full border-b border-gray-800 border-l-2 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-gray-800/80'
                        : 'border-transparent hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <Avatar
                          name={displayName}
                          imageUrl={thread.customer?.line_picture_url}
                          size={36}
                        />
                        {unread ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-400" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-white">{displayName}</p>
                          <span className="flex-shrink-0 text-xs text-gray-600">
                            {timeAgo(thread.latest_message_at)}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-xs text-gray-500">{preview || 'No preview'}</p>

                        {state?.is_resolved ? (
                          <p className="mt-1 text-[11px] text-gray-600">✓ resolved</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {!selectedThread ? (
            <div className="flex flex-1 items-center justify-center text-center text-gray-600">
              <div>
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="mt-2 text-xs text-gray-700">Choose a thread to view the transcript and customer context.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={getDisplayName(selectedThread.customer)}
                    imageUrl={selectedThread.customer?.line_picture_url}
                    size={36}
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{getDisplayName(selectedThread.customer)}</p>
                      {selectedThread.customer?.line_id ? (
                        <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-[11px] font-medium text-green-400">
                          LINE connected
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {selectedThread.last_inbound_at
                          ? `Last inbound ${timeAgo(selectedThread.last_inbound_at)}`
                          : 'No inbound messages yet'}
                      </span>
                      {selectedThread.customer?.id ? (
                        <Link
                          href={`/customers/${selectedThread.customer.id}`}
                          className="text-indigo-400 transition-colors hover:text-indigo-300"
                        >
                          View profile →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hydratingAssist ? (
                    <span className="text-xs text-gray-500">Syncing transcript…</span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleResolve}
                    disabled={resolving || getUserState(selectedThread)?.is_resolved}
                  >
                    {getUserState(selectedThread)?.is_resolved ? 'Resolved' : resolving ? 'Saving...' : 'Mark resolved'}
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {assistError ? (
                  <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
                    {assistError}
                  </div>
                ) : null}
                {messagesLoading ? (
                  <div className="flex justify-center pt-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="pt-10 text-center text-sm text-gray-600">No messages in this thread yet.</div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      if (message.direction === 'system') {
                        return (
                          <div key={message.id} className="flex justify-center">
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-500">
                              {message.body_text ?? message.message_type}
                            </span>
                          </div>
                        )
                      }

                      const isOutbound = message.direction === 'outbound'
                      const display = getMessageDisplay(message, operatorLanguage)

                      return (
                        <div key={message.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-sm rounded-2xl px-4 py-2.5 shadow-sm ${
                              isOutbound
                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-sm shadow-indigo-900/20'
                                : 'bg-gray-800 border border-gray-700/50 text-gray-200 rounded-tl-sm shadow-black/20'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm">{display.primary}</p>
                            {display.secondary ? (
                              <p className="mt-2 whitespace-pre-wrap text-xs opacity-75">{display.secondary}</p>
                            ) : null}
                            <div className="mt-1.5 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <p className="text-xs opacity-50">{fmtTime(message.sent_at)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {message.delivery_status === 'failed' ? (
                                  <span className="text-xs text-red-300">Failed</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={threadBottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-gray-800 bg-gray-950/70 px-5 py-4">
                <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Send final reply</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Build the draft in the workshop on the right, then send the final message from here.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Send as:</span>
                    <button
                      onClick={() => setRecipientLang('en')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        recipientLang === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setRecipientLang('th')}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        recipientLang === 'th' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      Thai
                    </button>
                  </div>

                  {suggestingReply ? (
                    <div className="mt-4">
                      <DraftGenerationState mode={suggestionMode} />
                    </div>
                  ) : null}

                  <textarea
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value)
                      setReplyPreview(null)
                      setSendResult(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        void handleSend()
                      }
                    }}
                    placeholder="Final Thai message ready to send"
                    rows={4}
                    className="mt-4 min-h-[120px] w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 shadow-inner transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    disabled={sending}
                  />

                  {replyPreview ? (
                    <div className="mt-3 rounded-xl border border-gray-800 bg-black/20 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Preview</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">{replyPreview}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReplyText('')
                        setReplyPreview(null)
                        setSendResult(null)
                      }}
                      disabled={sending || (!replyText && !replyPreview)}
                    >
                      Clear
                    </Button>
                    <Button
                      className="flex-1 justify-center"
                      onClick={() => void handleSend()}
                      disabled={!replyText.trim() || sending}
                    >
                      {sending ? 'Sending…' : recipientLang === 'en' ? 'Send English Reply' : 'Send Thai Reply'}
                    </Button>
                  </div>

                  {sendResult ? (
                    <p className={`mt-3 text-xs ${sendResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {sendResult.text}
                    </p>
                  ) : null}
                </div>
              </div>

            </>
          )}
        </div>

        <div className="w-[360px] flex-shrink-0 border-l border-gray-800 flex flex-col bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.12),_transparent_45%)]">
          {!selectedThreadId ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-600">
              Select a conversation to open the assistant.
            </div>
          ) : contextLoading ? (
            <ContextSkeleton />
          ) : context ? (
            <>
              <div className="basis-[26%] border-b border-gray-800 p-4">
                <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={getDisplayName(context.customer)}
                      imageUrl={context.customer.line_picture_url}
                      size={56}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-white">
                        {getDisplayName(context.customer)}
                      </p>
                      {context.customer.line_display_name &&
                      context.customer.line_display_name !== context.customer.full_name ? (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{context.customer.full_name}</p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-300">
                          {context.customer.preferred_language === 'th' ? '🇹🇭 TH' : '🇬🇧 EN'}
                        </span>
                        {context.customer.line_id ? (
                          <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                            LINE connected
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                            No LINE ID
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-400">
                    <div className="rounded-xl bg-gray-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-600">Phone</p>
                      <p className="mt-1 truncate text-sm text-gray-200">{context.customer.phone ?? 'Not set'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-600">Outstanding</p>
                      <p className="mt-1 text-sm text-gray-200">{formatCurrency(context.outstanding_balance)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-600">Vehicles</p>
                      <p className="mt-1 text-sm text-gray-200">{context.vehicles.length}</p>
                    </div>
                    <div className="rounded-xl bg-gray-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-600">Open jobs</p>
                      <p className="mt-1 text-sm text-gray-200">{context.recent_jobs.length}</p>
                    </div>
                  </div>

                  {context.vehicles[0] ? (
                    <div className="mt-3 rounded-xl bg-gray-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-600">Current bike</p>
                      <p className="mt-1 text-sm text-gray-200">
                        {context.vehicles[0].year} {context.vehicles[0].make} {context.vehicles[0].model}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {context.vehicles[0].license_plate ?? 'No plate on file'}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between">
                    <Link
                      href={`/customers/${context.customer.id}`}
                      className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                    >
                      View full profile →
                    </Link>
                    {hydratingAssist ? (
                      <span className="text-xs text-gray-500">Syncing…</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Draft Workshop</p>
                  <p className="mt-1 text-sm text-gray-300">
                    Prepare the Thai draft here, note any changes you want, and let AI revise it before sending.
                  </p>
                </div>

                {!context.customer.line_id ? (
                  <p className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
                    No LINE ID on file. Add one on the customer profile before sending.
                  </p>
                ) : null}

                <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
                  {suggestingReply ? <DraftGenerationState mode={suggestionMode} /> : null}

                  <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">Thai draft</p>
                      <span className="text-xs text-gray-500">Shared with send panel</span>
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value)
                        setReplyPreview(null)
                        setSendResult(null)
                      }}
                      placeholder="Generate a first draft, or type your own Thai draft here."
                      rows={8}
                      className="mt-3 min-h-[220px] w-full resize-none rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 shadow-inner transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={sending}
                    />
                  </div>

                  <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">Revision notes for AI</p>
                      <span className="text-xs text-gray-500">Optional</span>
                    </div>
                    <textarea
                      value={revisionPrompt}
                      onChange={(e) => setRevisionPrompt(e.target.value)}
                      placeholder="Example: make this shorter, sound warmer, mention the white Forza only, and avoid sounding pushy."
                      rows={4}
                      className="mt-3 min-h-[120px] w-full resize-none rounded-xl border border-gray-700 bg-black/20 px-4 py-3 text-sm text-white placeholder-gray-500 shadow-inner transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={suggestingReply}
                    />

                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setReplyText('')
                          setRevisionPrompt('')
                          setReplyPreview(null)
                          setSendResult(null)
                        }}
                        disabled={sending || suggestingReply || (!replyText && !replyPreview && !revisionPrompt)}
                      >
                        Clear
                      </Button>
                      <Button
                        className="flex-1 justify-center"
                        onClick={() => void requestSuggestedReply({ revisionRequest: revisionPrompt })}
                        disabled={!selectedThreadId || suggestingReply || hydratingAssist}
                      >
                        {suggestingReply
                          ? suggestionMode === 'revise'
                            ? 'Revising…'
                            : 'Generating…'
                          : replyText.trim()
                          ? 'Revise Draft'
                          : 'Generate First Draft'}
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-[140px] rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">Customer preview</p>
                      <span className="text-xs text-gray-500">{recipientLang === 'en' ? 'English' : 'Thai'}</span>
                    </div>
                    {replyPreview ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-200">{replyPreview}</p>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">
                        {suggestingReply
                          ? 'Refreshing preview…'
                          : 'Preview will appear here after the AI drafts or revises the message.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-600">
              {contextError ?? 'Customer details unavailable.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
