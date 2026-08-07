"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter, useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  FolderClosed,
  Globe,
  Image,
  ImageIcon,
  Mail,
  Mic,
  MoreVertical,
  MessageSquare,
  Paperclip,
  Pencil,
  RefreshCw,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react"

import {
  deleteTenantAgentConversationUser,
  ensureTenantChatSession,
  fetchAssignedAgents,
  fetchTenantAgentChatHistory,
  fetchUserChatSessions,
  renameTenantAgentConversationUser,
  sendTenantAgentChat,
} from "../../../../../actions/auth"
import { extractApiMessage } from "../../../../../service/api"
import type { AppDispatch } from "../../../../../redux/store"
import { Badge } from "@/components/ui/badge"
import { AutoResizeTextarea } from "../../../../components"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RiChat3Line } from "react-icons/ri";

type TenantAgentCard = {
  id: string
  name: string
  description: string
  type?: string
  workflowType?: string
  status?: string
  isActive: 0 | 1
  oauthReady?: boolean
  requiresGoogleLogin?: boolean
  canRun?: boolean
  authMode: "tenant_shared_connection" | "user_personal_connection"
  executionMode: "manual" | "scheduled"
  executionTime?: string | null
  timezone?: string
  aiProvider: "openai" | "openrouter"
  aiModel: string
  lookbackHours: number
  maxEmails: number
  managerCanRun: boolean
  memberCanRun: boolean
  assignedUserIds: string[]
}

type ChatMessage = {
  id: string
  role: "assistant" | "user" | "system"
  text: string
  time: string
  meta?: string
  source?: "ai" | "server"
  persistedId?: string
  attachments?: ChatAttachment[]
}

type UserChatSession = {
  id: string
  message_id?: string | null
  created_at: string
  title: string
}

type ChatAttachment = {
  id: string
  file: File
  kind: "image" | "media" | "document"
  mimeType?: string
  previewUrl?: string
  sizeLabel?: string
}

type ChatAttachmentView = ChatAttachment & {
  isPreviewImage: boolean
}

let assignedAgentsCache: TenantAgentCard[] | null = null
let assignedAgentsLastFetchAt = 0
let assignedAgentsRequestPromise: Promise<Record<string, unknown>[]> | null = null

const GENERIC_QUICK_PROMPTS = [
  "Summarize the latest activity in 3 bullets.",
  "What should I prioritize next?",
  "Draft a concise response for the top priority.",
  "List blockers and suggested next actions.",
]

const GMAIL_QUICK_PROMPTS = [
  "Summarize the latest Gmail activity in 3 bullets.",
  "Find the most important unanswered emails and suggest next actions.",
  "Draft a short reply to the newest thread.",
  "List any urgent emails from VIP senders.",
]

const isGmailAnalysisType = (value?: string): boolean => String(value || "").toLowerCase() === "gmail_analysis"

const DEFAULT_CHAT_TIMEZONE = "Asia/Kolkata"

const resolveChatTimeZone = (value?: string): string => {
  const normalized = String(value || "").trim()
  const lowered = normalized.toLowerCase()
  const isUtcLike =
    !normalized ||
    lowered === "utc" ||
    lowered === "gmt" ||
    lowered === "etc/utc" ||
    lowered === "z" ||
    lowered === "utc+0" ||
    lowered === "utc+00:00" ||
    lowered === "utc-0" ||
    lowered === "utc-00:00"

  if (isUtcLike) {
    return DEFAULT_CHAT_TIMEZONE
  }
  return normalized
}

const formatTimeByTimeZone = (date: Date, timezone?: string): string => {
  const targetTimeZone = resolveChatTimeZone(timezone)
  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: targetTimeZone,
    }).format(date)
  } catch {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: DEFAULT_CHAT_TIMEZONE,
      }).format(date)
    } catch {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    }
  }
}


const normalizeOAuthErrorMessage = (value: string): string => {
  const text = String(value || "").trim()
  const lower = text.toLowerCase()
  if (!lower) return ""

  if (
    lower.includes("no refresh token") ||
    lower.includes("missing_refresh_token") ||
    lower.includes("no access token") ||
    lower.includes("refresh token is set")
  ) {
    return "Google OAuth refresh token is missing or expired. Reconnect Google from the Assigned Agents page and then refresh this page."
  }

  if (
    lower.includes("insufficient permission") ||
    lower.includes("insufficient_permissions") ||
    lower.includes("insufficient scope") ||
    lower.includes("insufficient_scopes")
  ) {
    return "Google OAuth permissions are insufficient. Reconnect Google and grant the requested Gmail permissions (read/send) so the agent can access email content and send messages."
  }

  if (lower.includes("consent_required") || lower.includes("consent required") || lower.includes("access_denied")) {
    return "Access to the Google account was denied or consent is required. Reconnect Google and approve the requested permissions to continue."
  }

  if (lower.includes("invalid_grant") || lower.includes("invalid_token") || lower.includes("token_revoked") || lower.includes("revoked")) {
    return "Google OAuth token is invalid or has been revoked. Reconnect Google from the Assigned Agents page to restore access."
  }

  if (lower.includes("rate limit") || lower.includes("quotaexceeded") || lower.includes("quota") || lower.includes("429")) {
    return "Google API quota or rate limit reached. Try again shortly; if it persists, check your Google API quota and usage in the Google Cloud Console."
  }

  if (lower.includes("network") || lower.includes("timeout") || lower.includes("failed to fetch") || lower.includes("econnrefused")) {
    return "Network error contacting Google API. Check your network connection and try again."
  }

  const short = text.length > 300 ? `${text.slice(0, 300).trim()}…` : text
  return `Google API error: ${short}`
}

const normalizeNumberedListDetailBullets = (value: string): string => {
  const lines = String(value || "").split("\n")
  const normalized: string[] = []
  let insideNumberedItem = false
  let seenNumberedItem = false

  const getLastNonEmptyLine = (): string => {
    for (let idx = normalized.length - 1; idx >= 0; idx -= 1) {
      const candidate = String(normalized[idx] || "")
      if (candidate.trim()) return candidate
    }
    return ""
  }

  for (const rawLine of lines) {
    const line = String(rawLine || "")
    const trimmed = line.trim()

    if (!trimmed) {
      normalized.push("")
      continue
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (seenNumberedItem) {
        const lastNonEmpty = getLastNonEmptyLine()
        if (lastNonEmpty) {
          normalized.push("")
        }
      }
      insideNumberedItem = true
      seenNumberedItem = true
      normalized.push(trimmed)
      continue
    }

    if (insideNumberedItem && /^[-*+]\s+/.test(trimmed)) {
      // Keep detail bullets nested under the active numbered item.
      normalized.push(`    ${trimmed}`)
      continue
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      insideNumberedItem = false
      normalized.push(trimmed)
      continue
    }

    if (!/^\s+/.test(line) && !/^[-*+]\s+/.test(trimmed)) {
      insideNumberedItem = false
    }

    normalized.push(line)
  }

  return normalized.join("\n")
}

// Sanitize assistant text to remove conversation dumps, prefatory lines, repeated paragraphs, and internal tokens
const sanitizeAssistantText = (value: string): string => {
  let text = String(value || "")
  // normalize newlines
  text = text.replace(/\r\n/g, "\n")

  // normalize split list markers: "1." on one line and content on next line -> "1. content"
  text = text.replace(/(^|\n)(\d+)[.)]\s*\n([^\n]+)/g, "$1$2. $3")

  // remove explicit conversation dumps like "USER:" or "ASSISTANT:" or section headers
  text = text
    .split("\n")
    .filter((ln) => !/^\s*(user:|assistant:|recent conversation context:)/i.test(ln))
    .join("\n")

  // remove leading phrases like "I understand your message:" or "Current user request:"
  text = text.replace(/^\s*(i understand your message[:\-\s]*|current user request[:\-\s]*).*/i, "")

  // drop trailing Sources/score lists which are often verbose and not user-facing
  text = text.replace(/\n\s*Sources:[\s\S]*/i, "")

  // remove internal tokens that might leak file or symbol refs
  text = text.replace(/`?#?(sym|file):[A-Za-z0-9_.\/:\\-]+`?/g, "")

  // generic markdown whitespace normalization (no field-specific/static shaping)
  const normalizedLines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))

  const compactLines: string[] = []
  let previousWasBlank = false
  for (const line of normalizedLines) {
    const blank = line.trim().length === 0
    if (blank) {
      if (!previousWasBlank) {
        compactLines.push("")
      }
      previousWasBlank = true
      continue
    }

    compactLines.push(line)
    previousWasBlank = false
  }

  text = compactLines.join("\n").trim()

  // Generic reflow for compressed AI output: restore readable markdown-like line breaks
  // without relying on message-type specific templates.
  text = text
    // Ensure headings start on their own line.
    .replace(/\s+(?=#{1,6}\s+)/g, "\n")
    // Ensure numbered list markers start on their own line.
    .replace(/\s+(?=\d+[.)]\s+)/g, "\n")
    // Break before generic key-value fields like "From:", "Date:", "Snippet:".
    .replace(/\s+(?=(?:\*\*)?[A-Z][A-Za-z ]{1,24}(?:\*\*)?:\s+)/g, "\n")
    // Re-collapse excessive blank lines after reflow.
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  text = normalizeNumberedListDetailBullets(text)

  // Repair malformed markdown tokens coming from model output without using static templates.
  text = text
    // Bullet marker separated from content: "-\n**Text**" -> "- **Text**"
    .replace(/(^|\n)\s*[-*+]\s*\n\s*(?=\S)/g, "$1- ")
    // Numbered marker separated from content: "1.\n**Text**" -> "1. **Text**"
    .replace(/(^|\n)\s*(\d+[.)])\s*\n\s*(?=\S)/g, "$1$2 ")

  // Collapse line breaks inside bold spans so markdown emphasis renders correctly.
  text = text.replace(/\*\*([\s\S]*?)\*\*/g, (full, inner) => {
    const normalizedInner = String(inner || "")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
    return `**${normalizedInner}**`
  })

  return text
}

const assistantTextForCopy = (value: string): string => {
  const text = sanitizeAssistantText(value)

  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const renderInlineMarkdown = (value: string): ReactNode[] => {
  const source = String(value || "")
  const nodes: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null = pattern.exec(source)

  while (match) {
    const start = match.index
    const end = pattern.lastIndex
    if (start > lastIndex) {
      nodes.push(source.slice(lastIndex, start))
    }
    nodes.push(
      <strong key={`md-strong-${start}-${end}`} className="font-semibold text-slate-900">
        {match[1]}
      </strong>,
    )
    lastIndex = end
    match = pattern.exec(source)
  }

  if (lastIndex < source.length) {
    nodes.push(source.slice(lastIndex))
  }

  return nodes
}

const shouldRenderAsPlainNumberedRecords = (value: string): boolean => {
  const text = String(value || "")
  if (!text) return false

  const numberedLineMatches = text.match(/(^|\n)\s*\d+[.)]\s+/g)
  const hasMultipleNumberedRows = Array.isArray(numberedLineMatches) && numberedLineMatches.length >= 2
  if (!hasMultipleNumberedRows) return false

  // Match both bullet and non-bullet label formats, with or without markdown bold.
  const fromCount = (text.match(/(?:\*\*)?from(?:\*\*)?\s*:/gi) || []).length
  const toCount = (text.match(/(?:\*\*)?to(?:\*\*)?\s*:/gi) || []).length
  const dateCount = (text.match(/(?:\*\*)?date(?:\*\*)?\s*:/gi) || []).length
  const snippetCount = (text.match(/(?:\*\*)?snippet(?:\*\*)?\s*:/gi) || []).length
  const labelsCount = (text.match(/(?:\*\*)?labels(?:\*\*)?\s*:/gi) || []).length
  const likelyEmailRecordBlock = (fromCount + toCount + dateCount + snippetCount + labelsCount) >= 4

  return likelyEmailRecordBlock
}

const toDisplayTextKeepBold = (value: string): string => {
  return String(value || "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/__(.*?)__/g, "**$1**")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const renderAssistantRichText = (value: string): ReactNode => {
  const text = sanitizeAssistantText(value)
  if (!text) return null

  if (shouldRenderAsPlainNumberedRecords(text)) {
    const displayText = toDisplayTextKeepBold(text)
    const displayLines = displayText.split("\n")
    return (
      <div className="text-sm leading-6 text-slate-700 font-sans">
        {displayLines.map((line, index) => (
          <p key={`fallback-line-${index}`} className="whitespace-pre-wrap wrap-break-word my-0">
            {line ? renderInlineMarkdown(line) : "\u00A0"}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="chat-markdown text-sm leading-6 text-slate-700 wrap-break-word [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_thead]:bg-slate-100 [&_th]:border [&_th]:border-slate-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-700 [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_tbody_tr:nth-child(even)]:bg-slate-50/60 [&_hr]:my-3 [&_hr]:border-slate-200 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_em]:italic [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:text-slate-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-1 mb-1 text-lg font-semibold text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-1 mb-1 text-base font-semibold text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1 mb-1 text-sm font-semibold text-slate-900">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-1 mb-1 text-sm font-semibold text-slate-900">{children}</h4>,
          p: ({ children }) => <p className="my-1 whitespace-pre-line wrap-break-word">{children}</p>,
          ul: ({ children }) => <ul className="my-1 list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal pl-5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="my-0 whitespace-pre-line marker:text-slate-500">{children}</li>,
          table: ({ children }) => <div className="my-2 overflow-x-auto"><table>{children}</table></div>,
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th>{children}</th>,
          td: ({ children }) => <td>{children}</td>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-3 border-slate-200" />,
          code: ({ className, children }) =>
            className?.includes("language-") ? (
              <code className="text-[12px] text-slate-100">{children}</code>
            ) : (
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-slate-800">{children}</code>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

const nowTime = (timezone?: string): string => {
  return formatTimeByTimeZone(new Date(), timezone)
}

const parseDateAssumeUtcIfMissing = (value: string): Date | null => {
  const raw = String(value || "").trim()
  if (!raw) return null

  const normalized = raw.replace(" ", "T")
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  const preferred = hasExplicitZone ? normalized : `${normalized}Z`
  const parsedPreferred = new Date(preferred)
  if (!Number.isNaN(parsedPreferred.getTime())) {
    return parsedPreferred
  }

  const parsedRaw = new Date(raw)
  if (!Number.isNaN(parsedRaw.getTime())) {
    return parsedRaw
  }

  return null
}

const formatTimeFromIso = (value?: string, timezone?: string): string => {
  if (!value) return nowTime(timezone)
  const date = parseDateAssumeUtcIfMissing(value)
  if (!date) return nowTime(timezone)
  return formatTimeByTimeZone(date, timezone)
}

const mapHistoryRowsToMessages = (rows: Record<string, unknown>[], timezone?: string): ChatMessage[] =>
  rows.map((row, index) => ({
    id: String(row.id || `history-${Date.now()}-${index}`),
    role: String(row.role || "assistant") === "user" ? "user" : "assistant",
    text: String(row.content || ""),
    time: formatTimeFromIso(String(row.created_at || ""), timezone),
  }))

const cloneAttachmentsForMessage = (items: ChatAttachment[]): ChatAttachmentView[] =>
  items.map((item) => ({
    ...item,
    isPreviewImage: Boolean(item.previewUrl && isImageAttachment(item)),
  }))

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const inferAttachmentKind = (file: File): ChatAttachment["kind"] => {
  const type = String(file.type || "").toLowerCase()
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("audio/") || type.startsWith("video/")) return "media"
  return "document"
}

const isImageAttachment = (attachment: ChatAttachment): boolean => {
  const name = attachment.file.name.toLowerCase()
  return Boolean(
    attachment.previewUrl &&
      (attachment.mimeType?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|bmp|avif|svg)$/.test(name)),
  )
}

const isMediaAttachment = (attachment: ChatAttachment): boolean => {
  return Boolean(attachment.mimeType?.startsWith("audio/") || attachment.mimeType?.startsWith("video/") || attachment.kind === "media")
}

const getAttachmentExtension = (attachment: ChatAttachment): string => {
  const fileName = String(attachment.file.name || "")
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex < 0 || dotIndex === fileName.length - 1) return "FILE"
  return fileName.slice(dotIndex + 1).toUpperCase()
}

const getFileToneByExtension = (extension: string): { iconClass: string; badgeClass: string } => {
  switch (extension) {
    case "PDF":
      return {
        iconClass: "bg-rose-100 text-rose-700",
        badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
      }
    case "DOC":
    case "DOCX":
      return {
        iconClass: "bg-blue-100 text-blue-700",
        badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",
      }
    case "XLS":
    case "XLSX":
    case "CSV":
      return {
        iconClass: "bg-emerald-100 text-emerald-700",
        badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      }
    case "PPT":
    case "PPTX":
      return {
        iconClass: "bg-amber-100 text-amber-700",
        badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      }
    case "TXT":
    case "MD":
    case "JSON":
    case "XML":
      return {
        iconClass: "bg-violet-100 text-violet-700",
        badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
      }
    default:
      return {
        iconClass: "bg-slate-100 text-slate-700",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      }
  }
}

const createChatId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `chat-${Date.now()}`
}

const buildOptimisticSessionTitle = (message: string, hasAttachments: boolean): string => {
  const trimmed = String(message || "").trim()
  if (trimmed) {
    return trimmed.length > 72 ? `${trimmed.slice(0, 72).trimEnd()}...` : trimmed
  }
  if (hasAttachments) {
    return "Shared attachments"
  }
  return "New chat"
}

const buildChatUrl = (agentId: string, chatId?: string): string => {
  const params = new URLSearchParams()
  if (agentId) params.set("agentId", agentId)
  if (chatId) params.set("chatId", chatId)
  const query = params.toString()
  return query ? `/users/agents/chat?${query}` : "/users/agents/chat"
}

const buildMessageBucketKey = (agentId: string, chatId: string): string => `${agentId}:${chatId}`

const getInitialMessages = (): ChatMessage[] => []

const createAttachmentView = (attachment: ChatAttachment): ChatAttachmentView => ({
  ...attachment,
  isPreviewImage: Boolean(attachment.previewUrl && isImageAttachment(attachment)),
})

function AttachmentImageTile({ attachment, isUser }: { attachment: ChatAttachmentView; isUser: boolean }) {
  if (!attachment.previewUrl) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-white/55 bg-white/90 shadow-sm">
      <img
        src={attachment.previewUrl}
        alt={attachment.file.name}
        className="h-44 w-full object-cover sm:h-52"
      />
      <div className={`flex items-center justify-between gap-3 px-3 py-2 ${isUser ? "bg-linear-to-r from-primary to-primary-light text-white" : "bg-white text-slate-700"}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{attachment.file.name}</p>
          <p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500"}`}>{attachment.sizeLabel ?? "Image"}</p>
        </div>
        <Image className="h-4 w-4 shrink-0" />
      </div>
    </div>
  )
}

function AttachmentCard({ attachment, isUser }: { attachment: ChatAttachmentView; isUser: boolean }) {
  const isMedia = isMediaAttachment(attachment)
  const MediaIcon = isMedia ? Globe : FileText
  const extension = getAttachmentExtension(attachment)
  const tone = getFileToneByExtension(extension)

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3 shadow-sm ${isUser ? "border-white/20 bg-white/10 text-white" : "border-white/60 bg-white/90 text-slate-700"}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isUser ? "bg-white/15" : tone.iconClass}`}>
        <MediaIcon className={`h-5 w-5 ${isUser ? "text-white" : "text-primary"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.file.name}</p>
        <div className="mt-1 flex items-center gap-2">
          {!isMedia ? (
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isUser ? "border border-white/30 bg-white/20 text-white" : tone.badgeClass}`}>
              {extension}
            </span>
          ) : null}
          <p className={`text-[11px] ${isUser ? "text-white/75" : "text-slate-500"}`}>
            {attachment.sizeLabel ?? (isMedia ? "Media" : "File")}
          </p>
        </div>
      </div>
    </div>
  )
}

function AttachmentGallery({ attachments, isUser }: { attachments: ChatAttachmentView[]; isUser: boolean }) {
  const images = attachments.filter((attachment) => attachment.isPreviewImage)
  const media = attachments.filter((attachment) => !attachment.isPreviewImage && isMediaAttachment(attachment))
  const files = attachments.filter((attachment) => !attachment.isPreviewImage && !isMediaAttachment(attachment))

  const imageGridClass = images.length === 1 ? "grid-cols-1" : "grid-cols-2"
  const mediaGridClass = media.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
  const fileGridClass = files.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"

  return (
    <div className="mb-2 grid gap-2">
      {images.length ? (
        <div className={`grid gap-2 ${imageGridClass}`}>
          {images.map((attachment, index) => (
            <div key={attachment.id} className={images.length > 1 && images.length % 2 === 1 && index === 0 ? "sm:col-span-2" : ""}>
              <AttachmentImageTile attachment={attachment} isUser={isUser} />
            </div>
          ))}
        </div>
      ) : null}

      {media.length ? (
        <div className={`grid gap-2 ${mediaGridClass}`}>
          {media.map((attachment, index) => (
            <div key={attachment.id} className={media.length > 1 && media.length % 2 === 1 && index === media.length - 1 ? "sm:col-span-2" : ""}>
              <AttachmentCard attachment={attachment} isUser={isUser} />
            </div>
          ))}
        </div>
      ) : null}

      {files.length ? (
        <div className={`grid gap-2 ${fileGridClass}`}>
          {files.map((attachment, index) => (
            <div key={attachment.id} className={files.length > 1 && files.length % 2 === 1 && index === files.length - 1 ? "sm:col-span-2" : ""}>
              <AttachmentCard attachment={attachment} isUser={isUser} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
// const buildInitialMessages = (agentName?: string, connected?: boolean): ChatMessage[] => [
//   {
//     id: "welcome",
//     role: "assistant",
//     text: connected
//       ? `${agentName || "This agent"} is ready. Ask me to summarize, analyze, and suggest next actions.`
//       : "Complete required integrations, then use this workspace to chat with the agent.",
//     time: "Now",
//   },
// ]

export default function ChatPage() {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter() as { push: (href: string) => void; replace: (href: string) => void }
  const searchParams = useSearchParams()
  const initialAgentId = searchParams.get("agentId")?.trim() || ""
  const initialChatId = searchParams.get("chatId")?.trim() || ""

  const [agents, setAgents] = useState<TenantAgentCard[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId)
  const [chatIdByAgent, setChatIdByAgent] = useState<Record<string, string>>({})
  const [messagesByBucket, setMessagesByBucket] = useState<Record<string, ChatMessage[]>>({})
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionPersisted, setSessionPersisted] = useState(false)
  const [userSessions, setUserSessions] = useState<UserChatSession[]>([])
  const [loadingUserSessions, setLoadingUserSessions] = useState(false)
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionTitle, setEditingSessionTitle] = useState("")
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<UserChatSession | null>(null)
  const [deletingSession, setDeletingSession] = useState(false)
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const loadedHistoryRef = useRef<Set<string>>(new Set())
  const activeChatIdRef = useRef("")
  const loadingHistoryFlagRef = useRef(false)
  const filesInputRef = useRef<HTMLInputElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const activeDisplayTimeZoneRef = useRef(DEFAULT_CHAT_TIMEZONE)
  const lastAgentsFetchAtRef = useRef(0)
  const lastSessionsFetchAtRef = useRef(0)
  const agentsRequestInFlightRef = useRef(false)
  const sessionsRequestInFlightRef = useRef(false)
  const pendingSessionsForceRefreshRef = useRef(false)
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const AGENTS_REFRESH_COOLDOWN_MS = 60000
  const SESSIONS_REFRESH_COOLDOWN_MS = 30000

  const loadUserSessions = useCallback(async (force = false, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    const normalizedAgentId = String(selectedAgentId || "").trim()
    if (!normalizedAgentId) {
      setUserSessions([])
      return
    }
    const now = Date.now()
    if (!force && now - lastSessionsFetchAtRef.current < SESSIONS_REFRESH_COOLDOWN_MS) return
    if (sessionsRequestInFlightRef.current) {
      // If a refresh is requested while one is in progress, queue one follow-up refresh.
      if (force) {
        pendingSessionsForceRefreshRef.current = true
      }
      return
    }

    sessionsRequestInFlightRef.current = true
    lastSessionsFetchAtRef.current = now
    if (!silent) {
      setLoadingUserSessions(true)
    }
    try {
      const rows = (await dispatch(fetchUserChatSessions({ agentId: normalizedAgentId }) as any)) as UserChatSession[]
      const mapped = Array.isArray(rows) ? rows : []
      setUserSessions(mapped)
    } catch {
      if (!silent) {
        setUserSessions([])
      }
    } finally {
      sessionsRequestInFlightRef.current = false
      if (!silent) {
        setLoadingUserSessions(false)
      }

      if (pendingSessionsForceRefreshRef.current) {
        pendingSessionsForceRefreshRef.current = false
        void loadUserSessions(true, { silent: true })
      }
    }
  }, [dispatch, selectedAgentId])

  const loadAgents = useCallback(async (force = false) => {
    const now = Date.now()

    const mapAgents = (rows: Record<string, unknown>[]): TenantAgentCard[] =>
      rows
        .filter((row) => Boolean(row && row.id))
        .map((row) => ({
          id: String(row.id || ""),
          name: String(row.name || "AI Agent"),
          description: String(row.description || ""),
          type: String(row.type || row.workflowType || "direct"),
          workflowType: String(row.workflowType || row.type || "direct"),
          status: String(row.status || "active"),
          isActive: Number(row.isActive ?? 1) === 0 ? 0 : 1,
          oauthReady: Boolean(row.oauthReady ?? false),
          requiresGoogleLogin: Boolean(row.requiresGoogleLogin ?? false),
          canRun: Boolean(row.canRun ?? true),
          authMode:
            row.authMode === "user_personal_connection"
              ? "user_personal_connection"
              : "tenant_shared_connection",
          executionMode: String(row.executionMode || "manual") === "scheduled" ? "scheduled" : "manual",
          executionTime: row.executionTime ? String(row.executionTime) : null,
          timezone: String(row.timezone || "UTC"),
          aiProvider: row.aiProvider === "openrouter" ? "openrouter" : "openai",
          aiModel: String(row.aiModel || "gpt-4.1-mini"),
          lookbackHours: Number(row.lookbackHours || 24),
          maxEmails: Number(row.maxEmails || 75),
          managerCanRun: Boolean(row.managerCanRun ?? true),
          memberCanRun: Boolean(row.memberCanRun ?? false),
          assignedUserIds: Array.isArray(row.assignedUserIds) ? row.assignedUserIds.map((value: unknown) => String(value)) : [],
        })) as TenantAgentCard[]

    if (!force && assignedAgentsCache && now - assignedAgentsLastFetchAt < AGENTS_REFRESH_COOLDOWN_MS) {
      setAgents(assignedAgentsCache)
      return
    }

    if (!force && now - lastAgentsFetchAtRef.current < AGENTS_REFRESH_COOLDOWN_MS) return
    if (agentsRequestInFlightRef.current) return

    if (assignedAgentsRequestPromise) {
      const rows = await assignedAgentsRequestPromise
      const nextAgents = mapAgents(rows)
      assignedAgentsCache = nextAgents
      setAgents(nextAgents)
      return
    }

    agentsRequestInFlightRef.current = true
    lastAgentsFetchAtRef.current = now
    setLoadingAgents(true)
    try {
      assignedAgentsRequestPromise = Promise.resolve(dispatch(fetchAssignedAgents() as any) as any)
      const rows = (await assignedAgentsRequestPromise) as Record<string, unknown>[]
      const nextAgents = mapAgents(rows)
      assignedAgentsCache = nextAgents
      assignedAgentsLastFetchAt = Date.now()
      setAgents(nextAgents)
    } catch (loadError: unknown) {
      const apiMsg = extractApiMessage(loadError as any)
      const messageText = apiMsg || (typeof loadError === "object" && loadError !== null && "message" in loadError
        ? String((loadError as { message?: string }).message || "Failed to load assigned agents.")
        : "Failed to load assigned agents.")
      setError(messageText)
      setAgents([])
    } finally {
      assignedAgentsRequestPromise = null
      agentsRequestInFlightRef.current = false
      setLoadingAgents(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  useEffect(() => {
    void loadUserSessions()
  }, [loadUserSessions])

  useEffect(() => {
    if (initialAgentId && initialAgentId !== selectedAgentId) {
      setSelectedAgentId(initialAgentId)
    }
  }, [initialAgentId, selectedAgentId])

  useEffect(() => {
    if (selectedAgentId || agents.length === 0) {
      return
    }

    setSelectedAgentId(agents[0].id)
    router.replace(buildChatUrl(agents[0].id, chatIdByAgent[agents[0].id]))
  }, [agents, router, selectedAgentId])

  const firstUserSessionId = String(userSessions[0]?.id || "").trim()

  useEffect(() => {
    if (!selectedAgentId) return

    setChatIdByAgent((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, selectedAgentId)) {
        return prev
      }

      const nextChatId =
        initialAgentId === selectedAgentId && initialChatId
          ? initialChatId
          : firstUserSessionId
      return {
        ...prev,
        [selectedAgentId]: nextChatId,
      }
    })
  }, [firstUserSessionId, initialAgentId, initialChatId, selectedAgentId])

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )
  const selectedAgentIsGmail = isGmailAnalysisType(selectedAgent?.type || selectedAgent?.workflowType)
  const selectedWorkflowType = String(selectedAgent?.workflowType || selectedAgent?.type || "direct")
  const activeDisplayTimeZone = resolveChatTimeZone(selectedAgent?.timezone)
  const selectedQuickPrompts = selectedAgentIsGmail ? GMAIL_QUICK_PROMPTS : GENERIC_QUICK_PROMPTS
  const activeChatId = selectedAgentId ? chatIdByAgent[selectedAgentId] || "" : ""
  const activeMessageBucketKey = selectedAgentId && activeChatId ? buildMessageBucketKey(selectedAgentId, activeChatId) : ""

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  useEffect(() => {
    loadingHistoryFlagRef.current = loadingHistory
  }, [loadingHistory])

  useEffect(() => {
    activeDisplayTimeZoneRef.current = activeDisplayTimeZone
  }, [activeDisplayTimeZone])

  useEffect(() => {
    if (!selectedAgentId || !activeChatId) {
      return
    }

    const cacheKey = `${selectedAgentId}:${activeChatId}`
    if (loadedHistoryRef.current.has(cacheKey)) {
      return
    }

    loadedHistoryRef.current.add(cacheKey)
    setLoadingHistory(true)

    void (async () => {
      try {
        const bucketKey = buildMessageBucketKey(selectedAgentId, activeChatId)
        // Ensure a server-side conversation exists for this chatId (best-effort)
        try {
          // import thunk dynamically to avoid top-level import cycles
          const ensured = await dispatch((ensureTenantChatSession as any)({ agentId: selectedAgentId, chatId: activeChatId }))
          const serverChatId = String(ensured?.chatId || "").trim()
          if (serverChatId && serverChatId !== activeChatId) {
            setChatIdByAgent((prev) => ({
              ...prev,
              [selectedAgentId]: serverChatId,
            }))
            router.replace(buildChatUrl(selectedAgentId, serverChatId))
          }
        } catch {
          // ignore ensure errors and continue to fetch history
        }

        const payload = await dispatch(
          fetchTenantAgentChatHistory({
            agentId: selectedAgentId,
            chatId: activeChatId,
          }) as any,
        )

        const historyRows = Array.isArray(payload?.history) ? payload.history : []
        const normalizedChatId = String(payload?.chatId || activeChatId || "").trim()

        if (normalizedChatId && normalizedChatId !== activeChatId) {
          setChatIdByAgent((prev) => ({
            ...prev,
            [selectedAgentId]: normalizedChatId,
          }))
          router.replace(buildChatUrl(selectedAgentId, normalizedChatId))
        }

        if (historyRows.length) {
          const mapped = mapHistoryRowsToMessages(historyRows, activeDisplayTimeZoneRef.current)

          setMessagesByBucket((prev) => ({
            ...prev,
            [bucketKey]: mapped,
          }))
          return
        }

        setMessagesByBucket((prev) => {
          if (prev[bucketKey]) return prev
          return {
            ...prev,
            [bucketKey]: getInitialMessages(),
          }
        })
      } catch {
        const bucketKey = buildMessageBucketKey(selectedAgentId, activeChatId)
        setMessagesByBucket((prev) => ({
          ...prev,
          [bucketKey]: prev[bucketKey] || getInitialMessages(),
        }))
      } finally {
        setLoadingHistory(false)
      }
    })()
  }, [activeChatId, dispatch, router, selectedAgent?.name, selectedAgent?.oauthReady, selectedAgentId])

  // Resolve title for active chat from user sessions.
  useEffect(() => {
    if (!activeChatId) {
      setConversationTitle(null)
      return
    }

    const matched = userSessions.find((session) => session.id === activeChatId)
    setConversationTitle(matched ? String(matched.title || "") : null)
  }, [activeChatId, userSessions])

  const activeMessages = useMemo(
    () => (activeMessageBucketKey ? messagesByBucket[activeMessageBucketKey] ?? getInitialMessages() : []),
    [activeMessageBucketKey, messagesByBucket],
  )

  useEffect(() => {
    if (!messageListRef.current) return

    const id = window.requestAnimationFrame(() => {
      if (!messageListRef.current) return
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    })

    return () => window.cancelAnimationFrame(id)
  }, [activeChatId, activeMessages.length, sending, loadingHistory])

  const openAssignedAgents = () => {
    router.push("/users/agents")
  }

  const onAttachmentInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setAttachments((prev) => {
      const existingKeys = new Set(prev.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`))
      const nextItems = files
        .filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`))
        .map((file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          kind: inferAttachmentKind(file),
          mimeType: file.type || undefined,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          sizeLabel: formatFileSize(file.size),
        }))

      return [...prev, ...nextItems]
    })

    event.target.value = ""
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === attachmentId)
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((item) => item.id !== attachmentId)
    })
  }

  useEffect(() => {
    return () => {
      for (const attachment of attachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      }
    }
  }, [])

  const openAttachmentSource = () => {
    filesInputRef.current?.click()
    setAttachmentMenuOpen(false)
  }

  const toggleMic = () => {
    setIsMicActive((prev) => !prev)
  }

  const handleCopyMessage = useCallback(async (message: ChatMessage) => {
    const valueToCopy = message.role === "assistant" ? assistantTextForCopy(message.text) : String(message.text || "")
    if (!valueToCopy.trim()) return

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(valueToCopy)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = valueToCopy
        textarea.setAttribute("readonly", "true")
        textarea.style.position = "absolute"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setCopiedMessageId(message.id)
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current)
      }
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        setCopiedMessageId((prev) => (prev === message.id ? null : prev))
      }, 1800)
    } catch {
      setError("Unable to copy message. Please try again.")
    }
  }, [])

  useEffect(() => {
    if (!attachmentMenuOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (attachmentMenuRef.current?.contains(target)) return
      setAttachmentMenuOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
    }
  }, [attachmentMenuOpen])

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editingSessionId) return

    const id = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(id)
  }, [editingSessionId])

  const renameSession = async (session: UserChatSession, nextTitle: string): Promise<boolean> => {
    if (!selectedAgentId) {
      setError("Select an agent first.")
      setOpenSessionMenuId(null)
      return false
    }

    const title = String(nextTitle).trim()
    if (!title) {
      return false
    }

    try {
      setRenamingSessionId(session.id)
      await dispatch(
        renameTenantAgentConversationUser({
          agentId: String(selectedAgentId),
          conversationId: String(session.id),
          title,
        }) as any,
      )

      if (activeChatId === session.id) {
        setConversationTitle(title)
      }
      setUserSessions((prev) =>
        prev.map((item) =>
          item.id === session.id
            ? {
                ...item,
                title,
              }
            : item,
        ),
      )
      void loadUserSessions(true, { silent: true })
      setError(null)
      return true
    } catch (err) {
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "Failed to rename conversation")
          : "Failed to rename conversation",
      )
      return false
    } finally {
      setRenamingSessionId(null)
      setOpenSessionMenuId(null)
    }
  }

  const startInlineRename = (session: UserChatSession) => {
    setOpenSessionMenuId(null)
    setEditingSessionId(session.id)
    setEditingSessionTitle(String(session.title || "New chat"))
    setError(null)
  }

  const cancelInlineRename = () => {
    if (renamingSessionId) return
    setEditingSessionId(null)
    setEditingSessionTitle("")
  }

  const submitInlineRename = async (session: UserChatSession) => {
    const currentTitle = String(session.title || "New chat").trim()
    const nextTitle = String(editingSessionTitle || "").trim()

    // If title was not changed (or cleared), close edit mode and keep current value.
    if (!nextTitle || nextTitle === currentTitle) {
      cancelInlineRename()
      return
    }

    const ok = await renameSession(session, nextTitle)
    if (ok) {
      setEditingSessionId(null)
      setEditingSessionTitle("")
    }
  }

  const deleteSession = async (session: UserChatSession) => {
    if (!selectedAgentId) {
      setError("Select an agent first.")
      setOpenSessionMenuId(null)
      return
    }

    try {
      await dispatch(
        deleteTenantAgentConversationUser({
          agentId: String(selectedAgentId),
          conversationId: String(session.id),
        }) as any,
      )

      const remainingSessions = userSessions.filter((item) => item.id !== session.id)

      if (activeChatId === session.id) {
        const nextChatId = String(remainingSessions[0]?.id || "").trim()
        setChatIdByAgent((prev) => ({
          ...prev,
          [selectedAgentId]: nextChatId,
        }))
        router.replace(buildChatUrl(selectedAgentId, nextChatId || undefined))
        setConversationTitle(null)
      }

      setUserSessions(remainingSessions)
      void loadUserSessions(true, { silent: true })
      setError(null)
    } catch (err) {
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "Failed to delete conversation")
          : "Failed to delete conversation",
      )
    } finally {
      setOpenSessionMenuId(null)
    }
  }

  const requestDeleteSession = (session: UserChatSession) => {
    setOpenSessionMenuId(null)
    setEditingSessionId(null)
    setEditingSessionTitle("")
    setSessionToDelete(session)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return
    setDeletingSession(true)
    await deleteSession(sessionToDelete)
    setDeletingSession(false)
    setDeleteConfirmOpen(false)
    setSessionToDelete(null)
  }

  const openSession = useCallback((sessionId: string) => {
    if (!selectedAgentId) return
    setChatIdByAgent((prev) => ({
      ...prev,
      [selectedAgentId]: sessionId,
    }))
    router.replace(buildChatUrl(selectedAgentId, sessionId))
    setOpenSessionMenuId(null)
  }, [router, selectedAgentId])

  const sendMessage = async () => {
    const message = input.trim()
    if (!selectedAgentId || (!message && attachments.length === 0)) return

    if (selectedAgent && selectedAgentIsGmail && !selectedAgent.oauthReady) {
      setError("Google OAuth refresh token missing or expired. Please reconnect Google from the Assigned Agents page and refresh this page.")
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message || "Please review the attached files.",
      time: nowTime(activeDisplayTimeZone),
      attachments: attachments.length ? cloneAttachmentsForMessage(attachments) : undefined,
    }

    setError(null)
    setSending(true)
    setInput("")

    const resolvedChatId = String(activeChatId || createChatId()).trim()
    if (!resolvedChatId) {
      setSending(false)
      return
    }

    if (!activeChatId) {
      setChatIdByAgent((prev) => ({
        ...prev,
        [selectedAgentId]: resolvedChatId,
      }))
      router.replace(buildChatUrl(selectedAgentId, resolvedChatId))
    }

    // Optimistic recent chats update: reflect the active conversation immediately without waiting for API.
    setUserSessions((prev) => {
      const optimisticNow = new Date().toISOString()
      const existing = prev.find((session) => String(session.id) === resolvedChatId)
      const fallbackTitle = buildOptimisticSessionTitle(message, attachments.length > 0)
      const nextSession: UserChatSession = existing
        ? {
            ...existing,
            created_at: optimisticNow,
            title: String(existing.title || fallbackTitle),
          }
        : {
            id: resolvedChatId,
            message_id: null,
            created_at: optimisticNow,
            title: fallbackTitle,
          }

      return [nextSession, ...prev.filter((session) => String(session.id) !== resolvedChatId)]
    })

    const targetBucketKey = buildMessageBucketKey(selectedAgentId, resolvedChatId)

    setMessagesByBucket((prev) => ({
      ...prev,
      [targetBucketKey]: [...(prev[targetBucketKey] ?? activeMessages), userMessage],
    }))

    try {
      const composedMessage = (() => {
        if (attachments.length === 0) return message
        const attachmentLines = attachments.map((item) => `- ${item.file.name} (${item.kind}, ${formatFileSize(item.file.size)})`)
        const body = message || "Please review the attached files and respond accordingly."
        return `${body}\n\nAttachments:\n${attachmentLines.join("\n")}`
      })()

      const payload = (await dispatch(
        sendTenantAgentChat({
          agentId: selectedAgentId,
          message: composedMessage,
          chatId: resolvedChatId,
          workflowType: selectedWorkflowType,
        }) as any,
      )) as Record<string, unknown>

      const returnedChatId = String(payload.chatId || "").trim()
      if (returnedChatId && returnedChatId !== resolvedChatId) {
        setChatIdByAgent((prev) => ({
          ...prev,
          [selectedAgentId]: returnedChatId,
        }))
        router.replace(buildChatUrl(selectedAgentId, returnedChatId))

        // Keep optimistic recent chats coherent if backend normalizes chatId.
        setUserSessions((prev) => {
          const normalized = prev.find((session) => String(session.id) === returnedChatId)
          const fallback = prev.find((session) => String(session.id) === resolvedChatId)
          if (normalized) {
            return [
              {
                ...normalized,
                created_at: new Date().toISOString(),
              },
              ...prev.filter((session) => String(session.id) !== returnedChatId && String(session.id) !== resolvedChatId),
            ]
          }
          if (fallback) {
            const remapped: UserChatSession = {
              ...fallback,
              id: returnedChatId,
              created_at: new Date().toISOString(),
            }
            return [remapped, ...prev.filter((session) => String(session.id) !== resolvedChatId)]
          }
          return prev
        })
      }

      const replyText = sanitizeAssistantText(
        String(payload.markdown_summary || payload.answer || payload.response || payload.reply || "I analyzed your request and prepared a response."),
      )
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: replyText,
        time: nowTime(activeDisplayTimeZone),
        source: "server",
        meta:
          payload.runStatus || payload.runId
            ? [payload.runStatus ? `run: ${String(payload.runStatus)}` : null, payload.runId ? `id: ${String(payload.runId)}` : null]
                .filter(Boolean)
                .join(" | ")
            : undefined,
      }

      const responseChatId = returnedChatId || resolvedChatId
      const responseBucketKey = buildMessageBucketKey(selectedAgentId, responseChatId)
      setMessagesByBucket((prev) => ({
        ...prev,
        [responseBucketKey]: [...(prev[responseBucketKey] ?? []), assistantMessage],
      }))
      for (const attachment of attachments) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      }
      setAttachments([])
      setAttachmentMenuOpen(false)
      setIsMicActive(false)
    } catch (chatError: unknown) {
      const extracted = extractApiMessage(chatError as any)
      const rawMessage =
        typeof chatError === "object" && chatError !== null && "message" in chatError
          ? String((chatError as { message?: string }).message || "Failed to send message.")
          : "Failed to send message."
      const messageText = extracted || rawMessage
      const friendlyError = normalizeOAuthErrorMessage(messageText)

      setError(friendlyError)
      setMessagesByBucket((prev) => ({
        ...prev,
        [targetBucketKey]: [
          ...(prev[targetBucketKey] ?? activeMessages),
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            text: friendlyError || "I could not reach the agent chat endpoint. Please try again.",
            time: nowTime(activeDisplayTimeZone),
          },
        ],
      }))
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-primary/10 via-white to-slate-50 p-4 text-slate-900 sm:p-4 lg:p-4 rounded-2xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Agent Workspace</p>
              <h1 className="text-xl font-semibold sm:text-2xl">
                {selectedAgent?.name || "Select an agent"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Use one shared chat page for different agent workflows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="cursor-pointer" onClick={openAssignedAgents}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-700">{sanitizeAssistantText(error)}</p> : null}

        <div className="grid gap-0 lg:items-stretch lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="relative z-20 flex h-[75vh] min-h-140 max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border-slate-200 bg-white/90 shadow-sm lg:sticky lg:top-4 lg:rounded-r-none lg:border-r-0">
            <CardHeader className="border-b border-slate-200 bg-white px-4 py-4">
              <CardTitle className="flex items-center justify-start gap-2 text-base font-semibold tracking-wide text-slate-700">
                <RiChat3Line className="h-5 w-5" />
                <span>Recent Chats</span>
                {/* <Badge variant="secondary" className="h-6 shrink-0 px-2 text-[11px]">{userSessions.length}</Badge> */}
              </CardTitle>
              {/* <CardDescription className="mt-2">
                Pick a conversation or open the current one from the list.
              </CardDescription> */}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2">
              {/* {loadingAgents ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}
              {!loadingAgents && agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No configured agents found.</p>
              ) : null} */}

              {/* <div className="space-y-2">
                {agents.map((agent) => {
                  const active = agent.id === selectedAgentId
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(agent.id)
                        router.replace(buildChatUrl(agent.id, chatIdByAgent[agent.id]))
                      }}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-primary/30 bg-primary/5 shadow-sm"
                          : "border-slate-200 bg-white hover:border-primary/20 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{agent.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{agent.description || "AI agent"}</p>
                        </div>
                        <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                          {agent.isActive === 1 ? "active" : "inactive"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span>{agent.aiProvider}</span>
                        <span>•</span>
                        <span>{agent.aiModel}</span>
                        <span>•</span>
                        <span>{agent.authMode === "user_personal_connection" ? "personal auth" : "tenant auth"}</span>
                      </div>
                    </button>
                  )
                })}
              </div> */}

              {/* <div className="rounded-2xl border bg-muted/30 p-3 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Workflow
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Configure required integrations from the assigned agents page, then return here to chat with the live endpoint.
                </p>
              </div> */}

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">

                {loadingUserSessions ? <p className="px-3 py-2 text-xs text-muted-foreground">Loading sessions...</p> : null}

                {!loadingUserSessions && userSessions.length === 0 ? (
                  <div className="flex min-h-45 items-center justify-center px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No conversation history found yet.</p>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
                  {userSessions.map((session) => {
                    const isActiveSession = activeChatId === session.id
                    const canOpenSession = Boolean(selectedAgentId)
                    const isEditingSession = editingSessionId === session.id
                    const sessionTime = formatTimeFromIso(session.created_at, activeDisplayTimeZone)
                    return (
                      <div
                        key={session.id}
                        className={`group relative flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 transition ${
                          isActiveSession
                            ? "bg-slate-100 text-slate-900"
                            : "bg-transparent text-slate-700 hover:bg-slate-100"
                        } ${canOpenSession ? "" : "opacity-70"}`}
                      >
                        {isEditingSession ? (
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <input
                              ref={renameInputRef}
                              value={editingSessionTitle}
                              onChange={(event) => setEditingSessionTitle(event.target.value)}
                              onBlur={() => {
                                void submitInlineRename(session)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  void submitInlineRename(session)
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault()
                                  cancelInlineRename()
                                }
                              }}
                              className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-primary"
                              disabled={renamingSessionId === session.id}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`min-w-0 flex-1 text-left ${canOpenSession ? "cursor-pointer" : "cursor-not-allowed"}`}
                            onClick={() => {
                              if (!canOpenSession) return
                              openSession(session.id)
                            }}
                          >
                            <p className="truncate text-sm font-medium leading-5">{session.title || "New chat"}</p>
                            {/* <p className="mt-0.5 text-[11px] text-slate-500">{sessionTime}</p> */}
                          </button>
                        )}

                        <Popover
                          open={!isEditingSession && openSessionMenuId === session.id}
                          onOpenChange={(open) => {
                            if (!canOpenSession) return
                            if (isEditingSession) return
                            setOpenSessionMenuId(open ? session.id : null)
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label="Conversation actions"
                              disabled={!canOpenSession || isEditingSession}
                              className="cursor-pointer rounded-md p-1.5 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-800 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="right"
                            align="start"
                            sideOffset={8}
                            avoidCollisions={false}
                            className="z-120 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                          >
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                              onClick={() => startInlineRename(session)}
                            >
                              <Pencil className="h-4 w-4" />
                              Rename
                            </button>
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                              onClick={() => requestDeleteSession(session)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-[75vh] min-h-140 max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border-slate-200 bg-white/90 shadow-sm lg:rounded-l-none lg:border-l-0">
            <CardHeader className="border-b border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {/* <Bot className="h-5 w-5 text-primary" /> */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-3">
                      {/* <span>{selectedAgent?.name || "No agent selected"}</span> */}
                      {conversationTitle ? (
                        <span className="">{conversationTitle}</span>
                      ) : null}
                    </div>
                  </CardTitle>
                  {/* <CardDescription>
                    {selectedAgent
                      ? `${selectedWorkflowType} workflow, ${selectedAgent.executionMode} execution, model ${selectedAgent.aiModel}.`
                      : "Select an agent to start chat."}
                  </CardDescription> */}
                </div>

                {/* <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {selectedAgent?.authMode === "user_personal_connection" ? "personal connection" : "tenant shared"}
                  </Badge>
                  <Badge variant="outline">{selectedAgent?.aiModel || "gpt-4.1-mini"}</Badge>
                  <Badge variant="outline">{selectedAgent?.executionMode || "manual"}</Badge>
                </div> */}
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 bg-gray-200/20 p-2 sm:p-2">
              {/* <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-primary" />
                    Gmail status
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedAgent?.oauthReady ? "Connected and ready for analysis." : "Connect Gmail to unlock email analysis."}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Execution window
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedAgent ? `${selectedAgent.lookbackHours} hour lookback, ${selectedAgent.maxEmails} max emails.` : "Waiting for an agent selection."}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4 text-primary" />
                    Provider
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedAgent?.aiProvider || "openai"} with {selectedAgent?.aiModel || "default model"}.
                  </p>
                </div>
              </div> */}

              {/* <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm"> */}
                {/* <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Conversation</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      if (!selectedAgentId) return
                      const nextChatId = createChatId()
                      const nextBucketKey = buildMessageBucketKey(selectedAgentId, nextChatId)
                      setChatIdByAgent((prev) => ({
                        ...prev,
                        [selectedAgentId]: nextChatId,
                      }))
                      router.replace(buildChatUrl(selectedAgentId, nextChatId))
                      setMessagesByBucket((prev) => ({
                        ...prev,
                        [nextBucketKey]: getInitialMessages(),
                      }))
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset Chat
                  </Button>
                </div> */}

                <div ref={messageListRef} className="min-h-0 flex-1 flex flex-col space-y-4 overflow-y-auto pr-1">
                  {activeMessages.map((message) => {
                    const isUser = message.role === "user"
                    const isSystem = message.role === "system"
                    const isCopied = copiedMessageId === message.id

                    return (
                      <div key={message.id} className={`group/message w-full flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                        {!isUser ? (
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSystem ? "bg-slate-200 text-slate-600" : "bg-primary text-white"}`}>
                            {isSystem ? <Wand2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                        ) : null}

                        <div className={`flex min-w-0 flex-1 flex-col ${isUser ? "items-end" : "items-start"}`}>
                          <div
                            className={`inline-block rounded-[24px] px-4 py-3 ${
                              isUser
                                ? "w-fit max-w-[96%] md:max-w-[90%] lg:max-w-[84%] rounded-br-md bg-primary text-white shadow-sm"
                                : isSystem
                                  ? "w-[92%] md:w-[84%] lg:w-[78%] rounded-tl-md border border-dashed border-slate-300 bg-white text-slate-600"
                                  : "w-[92%] md:w-[84%] lg:w-[78%] rounded-tl-md border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {message.attachments?.length ? <AttachmentGallery attachments={message.attachments.map(createAttachmentView)} isUser={isUser} /> : null}
                            {!isUser ? (
                              <div className="text-sm leading-6 wrap-break-word">{renderAssistantRichText(message.text)}</div>
                            ) : (
                              <p className="text-sm leading-6 whitespace-pre-wrap wrap-break-word">{message.text}</p>
                            )}
                            {message.meta ? <p className={`mt-1 text-[11px] ${isUser ? "text-white/80" : "text-slate-400"}`}>{message.meta}</p> : null}
                            {/* Source badge: demo vs AI */}
                            {/* {!isUser && message.source ? (
                              <div className="mt-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${message.source === "server" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                                  {message.source === "server" ? "Backend AI" : "AI"}
                                </span>
                              </div>
                            ) : null} */}
                          </div>

                          <div className={`mt-1 flex items-center gap-1.5 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
                            <p className={`${isUser ? "text-slate-400" : "text-slate-400"} text-[11px]`} aria-label={`message-time-${message.id}`}>
                              {message.time}
                            </p>
                            <button
                              type="button"
                              className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition hover:cursor-pointer ${
                                !isUser || isCopied
                                  ? "opacity-100"
                                  : "pointer-events-none opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100"
                              } ${
                                isUser
                                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                              onClick={() => void handleCopyMessage(message)}
                              aria-label={`Copy message ${message.id}`}
                            >
                              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              {/* {isCopied ? "Copied" : "Copy"} */}
                            </button>
                          </div>
                        </div>

                        {isUser ? (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        ) : null}
                      </div>
                    )
                  })}

                  {sending ? (
                    <div className="w-full flex items-end gap-3 pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-[24px] rounded-tl-md border border-white/80 bg-white px-4 py-3 shadow-sm inline-block max-w-[86%] md:max-w-[70%] lg:max-w-[60%]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* <div className="mt-4 flex flex-wrap gap-2">
                  {selectedQuickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-full border cursor-pointer border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
                    >
                      {prompt}
                    </button>
                  ))}
                </div> */}

                {selectedAgentIsGmail && !selectedAgent?.oauthReady ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Required Google integration is not connected yet. Use the assigned agents page to complete login, then return here and refresh.
                  </div>
                ) : null}

                <div className="rounded-[26px] border border-slate-200 p-3 bg-white shadow-sm">
                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    onChange={onAttachmentInputChange}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.md"
                    className="hidden"
                  />

                  {attachments.length > 0 ? (
                    <div className="mb-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-2 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Attached files</p>
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
                          onClick={() => {
                            for (const attachment of attachments) {
                              if (attachment.previewUrl) {
                                URL.revokeObjectURL(attachment.previewUrl)
                              }
                            }
                            setAttachments([])
                          }}
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {attachments.map((attachment) => (
                          <div key={attachment.id} className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm">
                            {isImageAttachment(attachment) && attachment.previewUrl ? (
                              <img src={attachment.previewUrl} alt={attachment.file.name} className="h-36 w-full object-cover" />
                            ) : (
                              <div className="flex items-center gap-3 px-3 py-3">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${getFileToneByExtension(getAttachmentExtension(attachment)).iconClass}`}>
                                  {isMediaAttachment(attachment) ? <Globe className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-800">{attachment.file.name}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getFileToneByExtension(getAttachmentExtension(attachment)).badgeClass}`}>
                                      {getAttachmentExtension(attachment)}
                                    </span>
                                    <p className="text-xs text-slate-500">{attachment.sizeLabel ?? formatFileSize(attachment.file.size)}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment.id)}
                              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-90 transition hover:bg-slate-900"
                              aria-label={`Remove ${attachment.file.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2 py-2">
                    <div ref={attachmentMenuRef} className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-12 cursor-pointer rounded-2xl disabled:cursor-not-allowed"
                        disabled={!selectedAgentId || sending}
                        onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>

                      {attachmentMenuOpen ? (
                        <div className="absolute bottom-full left-2 mb-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                          <div>
                            {[
                              {
                                label: "Add photos and files",
                                icon: FileText,
                                onClick: () => openAttachmentSource(),
                              },
                            ].map((item) => (
                              <button
                                key={item.label}
                                onClick={item.onClick}
                                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-primary/5 hover:text-primary"
                              >
                                <item.icon className="h-4 w-4 text-primary" />
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-1 items-end rounded-2xl border border-slate-200 px-3 py-1">
                      <AutoResizeTextarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            void sendMessage()
                          }
                        }}
                        placeholder={selectedAgent ? "Ask the agent..." : "Select an agent first..."}
                        className="w-full min-h-9.5 max-h-44 bg-transparent px-0 py-1 text-sm outline-none placeholder:text-slate-400"
                        disabled={!selectedAgentId || sending}
                        maxRows={8}
                      />
                    </div>

                    <Button
                      type="button"
                      variant={isMicActive ? "default" : "outline"}
                      className={`h-12 w-12 cursor-pointer rounded-2xl disabled:cursor-not-allowed ${isMicActive ? "bg-rose-500 text-white hover:bg-rose-600" : ""}`}
                      disabled={!selectedAgentId || sending}
                      onClick={toggleMic}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      className="h-12 w-12 cursor-pointer rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-light disabled:cursor-not-allowed"
                      disabled={!selectedAgentId || sending || (!input.trim() && attachments.length === 0)}
                      onClick={() => void sendMessage()}
                    >
                      <SendHorizonal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

              {/* </div> */}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => {
            if (deletingSession) return
            setDeleteConfirmOpen(open)
            if (!open) {
              setSessionToDelete(null)
            }
          }}
        >
          <DialogContent showCloseButton={false} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 sm:max-w-sm">
            <DialogHeader className="px-5 pb-3 pt-5">
              <DialogTitle className="text-base font-semibold text-slate-900">Delete conversation?</DialogTitle>
              <DialogDescription className="pt-2 text-sm text-slate-600">
                This action is permanent and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 py-3">
              {/* <p className="mb-3 truncate text-xs text-slate-500">{sessionToDelete?.title || "New chat"}</p> border-t border-slate-200 bg-slate-50 */}
              <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer disabled:cursor-not-allowed"
                onClick={() => {
                  if (deletingSession) return
                  setDeleteConfirmOpen(false)
                  setSessionToDelete(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed"
                onClick={() => void confirmDeleteSession()}
                disabled={deletingSession || !sessionToDelete}
              >
                {deletingSession ? "Deleting..." : "Delete"}
              </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
