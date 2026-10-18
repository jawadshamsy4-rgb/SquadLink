'use client'

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'

interface MessageInputProps {
  channelId: string
  replyingTo?: {
    id: string
    username: string
    content: string
  } | null
  onCancelReply?: () => void
}

export default function MessageInput({
  channelId,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus()
    }
  }, [replyingTo])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()

    const trimmed = content.trim()
    if (!trimmed || sending) return

    setSending(true)
    setContent('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    if (!user) {
      alert('You must be logged in to send messages.')
      setSending(false)
      return
    }

    const userId = user.id

    // Format content with reply reference if replying
    let finalContent = trimmed
    if (replyingTo) {
      finalContent = `> @${replyingTo.username}: "${replyingTo.content.slice(0, 60)}${replyingTo.content.length > 60 ? '...' : ''}"\n${trimmed}`
      if (onCancelReply) onCancelReply()
    }

    const { error } = await supabase.from('messages').insert({
      content: finalContent,
      channel_id: channelId,
      user_id: userId,
    })

    if (error) {
      console.error('Failed to send message:', error)
      alert(`Could not send message: ${error.message}`)
      setContent(trimmed)
    }

    setSending(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }

  return (
    <div className="border-t border-slate-200 dark:border-white/5 px-4 py-3 bg-white dark:bg-slate-950 transition-colors duration-200">
      {/* Reply Banner */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/20 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-purple-600 dark:text-purple-400 font-bold">Replying to @{replyingTo.username}:</span>
            <span className="text-slate-700 dark:text-gray-300 truncate max-w-md">"{replyingTo.content}"</span>
          </div>
          <button
            onClick={onCancelReply}
            className="rounded-full p-1 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
            title="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end gap-2 rounded-2xl bg-slate-100 dark:bg-gray-800/60 px-4 py-2 ring-1 ring-slate-300 dark:ring-white/5 transition-all focus-within:ring-2 focus-within:ring-purple-500/50">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={replyingTo ? `Replying to @${replyingTo.username}...` : "Send a message... (Press Enter to send)"}
            rows={1}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-slate-900 placeholder-slate-400 dark:text-white dark:placeholder-gray-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
          >
            <span className="text-xs">🚀</span>
          </button>
        </div>
      </form>
    </div>
  )
}
