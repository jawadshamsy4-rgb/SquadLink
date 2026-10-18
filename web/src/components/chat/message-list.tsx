'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'

interface Reaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
}

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
  channel_id: string
  user: {
    username: string
    avatar_url: string | null
  } | null
}

interface MessageListProps {
  channelId: string
  onReply?: (message: { id: string; username: string; content: string }) => void
}

const COMMON_EMOJIS = ['🔥', '😂', '💀', '❤️', '👍', '🎯', '🚀', '💩', '🎉', '⚡']

function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function MessageList({ channelId, onReply }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null)
  const [openEmojiPickerMsgId, setOpenEmojiPickerMsgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const supabase = createClient()
  const currentUserId = user?.id || '00000000-0000-0000-0000-000000000001'

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.message-action-menu') && !target.closest('.message-action-btn')) {
        setOpenMenuMsgId(null)
        setOpenEmojiPickerMsgId(null)
      }
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  // 1. Fetch messages and reactions
  const fetchMessagesAndReactions = async () => {
    const { data: msgData } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        user_id,
        channel_id,
        users (
          username,
          avatar_url
        )
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (msgData) {
      const formatted = msgData.map((item: any) => ({
        id: item.id,
        content: item.content,
        created_at: item.created_at,
        user_id: item.user_id,
        channel_id: item.channel_id,
        user: item.users || { username: 'SquadLeader', avatar_url: null },
      }))
      setMessages(formatted)

      const msgIds = formatted.map((m) => m.id)
      if (msgIds.length > 0) {
        const { data: reactData } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', msgIds)

        if (reactData) {
          setReactions(reactData)
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    setMessages([])
    setReactions([])
    setLoading(true)
    fetchMessagesAndReactions()

    // Realtime messages
    const msgChannel = supabase
      .channel(`messages-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload: any) => {
          let userData = null
          if (payload.new.user_id) {
            const { data } = await supabase
              .from('users')
              .select('username, avatar_url')
              .eq('id', payload.new.user_id)
              .maybeSingle()
            userData = data
          }

          const newMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
            channel_id: payload.new.channel_id,
            user: userData || { username: 'SquadLeader', avatar_url: null },
          }

          setMessages((prev) => [...prev, newMessage])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload: any) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
          setReactions((prev) => prev.filter((r) => r.message_id !== payload.old.id))
        }
      )
      .subscribe()

    // Realtime reactions
    const reactChannel = supabase
      .channel(`reactions-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setReactions((prev) => [...prev, payload.new as Reaction])
          } else if (payload.eventType === 'DELETE') {
            setReactions((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(reactChannel)
    }
  }, [channelId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    setOpenMenuMsgId(null)
    const confirmDelete = confirm('Delete this message?')
    if (!confirmDelete) return

    setMessages((prev) => prev.filter((m) => m.id !== messageId))

    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) {
      console.error('Delete error:', error)
      fetchMessagesAndReactions()
    }
  }

  // Toggle reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setOpenMenuMsgId(null)
    setOpenEmojiPickerMsgId(null)

    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji
    )

    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id))
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      const newReaction = {
        id: Math.random().toString(),
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      }
      setReactions((prev) => [...prev, newReaction])

      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          Loading messages...
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 text-3xl">
          🎮
        </div>
        <p className="text-sm text-gray-400">No messages yet. Send a message to get started!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 scrollbar-hide">
      {messages.map((msg, index) => {
        const prevMsg = index > 0 ? messages[index - 1] : null
        const isSameUser = prevMsg?.user_id === msg.user_id
        const timeDiff = prevMsg
          ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
          : Infinity
        const isGrouped = isSameUser && timeDiff < 5 * 60 * 1000

        const msgReactions = reactions.filter((r) => r.message_id === msg.id)
        const groupedReactions = msgReactions.reduce<Record<string, Reaction[]>>((acc, r) => {
          if (!acc[r.emoji]) acc[r.emoji] = []
          acc[r.emoji].push(r)
          return acc
        }, {})

        const isReplyingQuote = msg.content.startsWith('> @')
        const isMenuOpen = openMenuMsgId === msg.id
        const isEmojiPickerOpen = openEmojiPickerMsgId === msg.id

        return (
          <div
            key={msg.id}
            className={`group relative flex items-start gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.04] ${
              !isGrouped ? 'mt-4' : 'mt-0.5'
            }`}
          >
            {/* Avatar */}
            <div className="w-10 shrink-0">
              {!isGrouped && (
                <>
                  {msg.user?.avatar_url ? (
                    <img
                      src={msg.user.avatar_url}
                      alt={msg.user.username}
                      className="h-10 w-10 rounded-full object-cover shadow-md"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-sm font-bold text-white shadow-md">
                      {msg.user?.username?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Message Body */}
            <div className="min-w-0 flex-1 pr-12">
              {!isGrouped && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {msg.user?.username ?? 'SquadLeader'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-gray-500">
                    {getRelativeTime(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message text with quoted replies formatting */}
              <div className="text-sm leading-relaxed text-slate-800 dark:text-gray-200 break-words mt-0.5">
                {isReplyingQuote ? (
                  <div>
                    <div className="mb-1 rounded-lg border-l-2 border-purple-500 bg-purple-50 dark:bg-purple-500/10 px-2 py-1 text-xs text-purple-700 dark:text-purple-300">
                      {msg.content.split('\n')[0].replace('> ', '')}
                    </div>
                    <div>{msg.content.split('\n').slice(1).join('\n')}</div>
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* Reactions Bar Under Text */}
              {Object.keys(groupedReactions).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(groupedReactions).map(([emoji, rList]) => {
                    const hasReacted = rList.some((r) => r.user_id === currentUserId)
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-0.5 text-xs font-semibold transition-all border cursor-pointer ${
                          hasReacted
                            ? 'bg-purple-100 dark:bg-purple-600/30 border-purple-300 dark:border-purple-500/50 text-purple-700 dark:text-purple-200'
                            : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}
                        title={`${rList.length} squad reaction(s)`}
                      >
                        <span>{emoji}</span>
                        <span>{rList.length}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 3-Dot Options Button at Right Side of Message */}
            <div className="absolute right-3 top-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuMsgId(isMenuOpen ? null : msg.id)
                  setOpenEmojiPickerMsgId(null)
                }}
                className={`message-action-btn flex h-7 w-7 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isMenuOpen
                    ? 'bg-slate-300 dark:bg-white/20 text-slate-900 dark:text-white'
                    : 'text-slate-400 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Message actions"
              >
                <span className="text-base font-bold leading-none tracking-widest">•••</span>
              </button>

              {/* 3-Dot Dropdown Menu (Reply, Emoji, Delete) */}
              {isMenuOpen && (
                <div className="message-action-menu absolute right-0 top-8 z-30 w-44 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  {/* 1. Reply option */}
                  <button
                    onClick={() => {
                      setOpenMenuMsgId(null)
                      if (onReply) {
                        onReply({
                          id: msg.id,
                          username: msg.user?.username || 'SquadLeader',
                          content: msg.content.replace(/^> @.*\n/, ''),
                        })
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <span>💬</span>
                    <span>Reply</span>
                  </button>

                  {/* 2. Add Reaction Option */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenEmojiPickerMsgId(isEmojiPickerOpen ? null : msg.id)
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span>😊</span>
                      <span>Add Reaction</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-gray-400">▶</span>
                  </button>

                  {/* Quick Inline Reaction Bar */}
                  {isEmojiPickerOpen && (
                    <div className="my-1.5 flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1.5 border border-slate-200 dark:border-white/5">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          className="rounded-lg p-1 text-sm hover:scale-125 hover:bg-slate-200 dark:hover:bg-white/10 transition-transform cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="my-1 h-[1px] bg-slate-200 dark:bg-white/10" />

                  {/* 3. Delete Option */}
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <span>🗑️</span>
                    <span>Delete Message</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
