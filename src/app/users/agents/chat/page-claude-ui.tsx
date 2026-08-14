"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
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
  Send,
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
  aiProvider: "openai" | "openrouter"
  aiModel: string
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
const MAX_CHAT_INPUT_LENGTH = 4000

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
    lower.includes("refresh token is set") ||
    lower.includes("missing_refresh_token") ||
    lower.includes("no access token")
  ) {
    return "Google OAuth refresh token missing or expired. Please reconnect Google (tenant or user) from the Assigned Agents page and refresh this page."
  }

  return text
}

const sanitizeAssistantText = (value: string): string => {
  const text = String(value || "")
  return text
    .replace(/`?#sym:[A-Za-z0-9_.:-]+`?/g, "")
    .replace(/`?#file:[A-Za-z0-9_./\\:-]+`?/g, "")
    .replace(/`?sym:[A-Za-z0-9_.:-]+`?/g, "")
    .replace(/`?file:[A-Za-z0-9_./\\:-]+`?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
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

export default function UserAgentChatPage() {
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
  const [inputFocused, setInputFocused] = useState(false)
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
  const loadedHistoryRef = useRef<Set<string>>(new Set())
  const activeChatIdRef = useRef("")
  const loadingHistoryFlagRef = useRef(false)
  const filesInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const activeDisplayTimeZoneRef = useRef(DEFAULT_CHAT_TIMEZONE)
  const lastAgentsFetchAtRef = useRef(0)
  const lastSessionsFetchAtRef = useRef(0)
  const agentsRequestInFlightRef = useRef(false)
  const sessionsRequestInFlightRef = useRef(false)

  const AGENTS_REFRESH_COOLDOWN_MS = 60000
  const SESSIONS_REFRESH_COOLDOWN_MS = 30000

  const loadUserSessions = useCallback(async (force = false, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    const now = Date.now()
    if (!force && now - lastSessionsFetchAtRef.current < SESSIONS_REFRESH_COOLDOWN_MS) return
    if (sessionsRequestInFlightRef.current) return

    sessionsRequestInFlightRef.current = true
    lastSessionsFetchAtRef.current = now
    if (!silent) {
      setLoadingUserSessions(true)
    }
    try {
      const rows = (await dispatch(fetchUserChatSessions() as any)) as UserChatSession[]
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
    }
  }, [dispatch])

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
          aiProvider: row.aiProvider === "openrouter" ? "openrouter" : "openai",
          aiModel: String(row.aiModel || "gpt-4.1-mini"),
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
  const activeDisplayTimeZone = resolveChatTimeZone(selectedAgent?.type === "gmail_analysis" ? "Asia/Kolkata" : undefined)
  const selectedQuickPrompts = selectedAgentIsGmail ? GMAIL_QUICK_PROMPTS : GENERIC_QUICK_PROMPTS
  const activeChatId = selectedAgentId ? chatIdByAgent[selectedAgentId] || "" : ""
  const activeMessageBucketKey = selectedAgentId && activeChatId ? buildMessageBucketKey(selectedAgentId, activeChatId) : ""
  const charCount = input.length
  const isOverLimit = charCount > MAX_CHAT_INPUT_LENGTH
  const canSendMessage = Boolean(selectedAgentId) && !sending && !isOverLimit && (Boolean(input.trim()) || attachments.length > 0)

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

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return

    node.style.height = "0px"
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [input])

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
      attachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
    }
  }, [])

  const openAttachmentSource = () => {
    filesInputRef.current?.click()
    setAttachmentMenuOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (canSendMessage) {
        void sendMessage()
      }
    }
  }

  const toggleMic = () => {
    setIsMicActive((prev) => !prev)
  }

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
      setError("Google OAuth refresh token missing or expired. Please reconnect Google (tenant or user) from the Assigned Agents page and refresh this page.")
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
      }

      const replyText = sanitizeAssistantText(String(payload.answer || payload.response || payload.reply || "I analyzed your request and prepared a response."))
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
      attachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
      setAttachments([])
      setAttachmentMenuOpen(false)
      setIsMicActive(false)
      void loadUserSessions(true)
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
                        <span>configured</span>
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
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
                              onClick={() => startInlineRename(session)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rename
                            </button>
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-600 transition hover:bg-rose-50"
                              onClick={() => requestDeleteSession(session)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
                      ? `${selectedWorkflowType} workflow, model ${selectedAgent.aiModel}.`
                      : "Select an agent to start chat."}
                  </CardDescription> */}
                </div>

                {/* <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Tenant shared connection
                  </Badge>
                  <Badge variant="outline">{selectedAgent?.aiModel || "gpt-4.1-mini"}</Badge>
                  <Badge variant="outline">ready</Badge>
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
                    {selectedAgent ? "Email analysis ready for the selected agent." : "Waiting for an agent selection."}
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

                    return (
                      <div key={message.id} className={`w-full flex items-end gap-3 ${isUser ? "justify-end" : "justify-start pb-4"}`}>
                        {!isUser ? (
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSystem ? "bg-slate-200 text-slate-600" : "bg-primary text-white"}`}>
                            {isSystem ? <Wand2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                        ) : null}

                        <div className={`max-w-[86%] md:max-w-[70%] lg:max-w-[60%] inline-block rounded-[24px] px-4 py-3 shadow-sm ${
                            isUser
                              ? "rounded-br-md bg-primary text-white"
                              : isSystem
                                ? "rounded-tl-md border border-dashed border-slate-300 bg-white text-slate-600"
                                : "rounded-tl-md border border-white/80 bg-white text-slate-700"
                          }`}
                        >
                          {message.attachments?.length ? <AttachmentGallery attachments={message.attachments.map(createAttachmentView)} isUser={isUser} /> : null}
                          <p className="text-sm leading-6 whitespace-pre-wrap wrap-break-word">{!isUser ? sanitizeAssistantText(message.text) : message.text}</p>
                          {message.meta ? <p className={`mt-1 text-[11px] ${isUser ? "text-white/80" : "text-slate-400"}`}>{message.meta}</p> : null}
                          {/* Source badge: demo vs AI */}
                          {/* {!isUser && message.source ? (
                            <div className="mt-2">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${message.source === "server" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                                {message.source === "server" ? "Backend AI" : "AI"}
                              </span>
                            </div>
                          ) : null} */}
                          <p className={`mt-1 text-[11px] ${isUser ? "text-white/80 pl-3" : "text-slate-400 pr-3"}`} aria-label={`message-time-${message.id}`} >
                            {message.time}
                          </p>
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
                    <div className="w-full flex items-end gap-3">
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

                <div className="aurora-composer rounded-[26px] border border-slate-200 p-3 bg-white shadow-sm">
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
                            attachments.forEach((attachment) => {
                              if (attachment.previewUrl) {
                                URL.revokeObjectURL(attachment.previewUrl)
                              }
                            })
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

                  <div
                    className="relative input-glow rounded-2xl transition-all duration-300"
                    style={{
                      background: inputFocused
                        ? "rgba(19, 29, 53, 0.9)"
                        : "rgba(13, 20, 38, 0.8)",
                      border: inputFocused
                        ? "1px solid rgba(79, 142, 255, 0.35)"
                        : "1px solid rgba(148, 163, 184, 0.18)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    {inputFocused ? <div className="scan-line" /> : null}

                    <div className="flex items-end gap-2 p-3">
                      <button
                        type="button"
                        className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          color: "rgba(203, 213, 225, 0.72)",
                          background: "transparent",
                        }}
                        onClick={openAttachmentSource}
                        disabled={!selectedAgentId || sending}
                        title="Attach files"
                      >
                        <Paperclip size={16} />
                      </button>

                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        placeholder={selectedAgent ? "Message Aurora..." : "Select an agent first..."}
                        rows={1}
                        className="aurora-textarea flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          color: "rgba(248, 250, 252, 0.96)",
                          caretColor: "#4F8EFF",
                          fontFamily: "inherit",
                          minHeight: "36px",
                          maxHeight: "160px",
                        }}
                        disabled={!selectedAgentId || sending}
                      />

                      <button
                        type="button"
                        className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          color: isMicActive ? "#7DD3FC" : "rgba(203, 213, 225, 0.72)",
                          background: isMicActive ? "rgba(79, 142, 255, 0.12)" : "transparent",
                        }}
                        title="Voice input coming soon"
                        onClick={toggleMic}
                        disabled={!selectedAgentId || sending}
                      >
                        <Mic size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (canSendMessage) {
                            void sendMessage()
                          }
                        }}
                        disabled={!canSendMessage}
                        className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
                        style={
                          sending
                            ? {
                                background: "rgba(244, 114, 182, 0.15)",
                                border: "1px solid rgba(244, 114, 182, 0.3)",
                                color: "#F472B6",
                              }
                            : canSendMessage
                              ? {
                                  background: "linear-gradient(135deg, #4F8EFF, #24C6B7)",
                                  boxShadow: "0 0 20px rgba(79, 142, 255, 0.4)",
                                  color: "white",
                                  transform: "scale(1)",
                                }
                              : {
                                  background: "rgba(79, 142, 255, 0.05)",
                                  border: "1px solid rgba(148, 163, 184, 0.16)",
                                  color: "rgba(148, 163, 184, 0.72)",
                                }
                        }
                        title={sending ? "Sending..." : "Send message"}
                      >
                        {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : <Send size={14} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-3 pb-2">
                      <span
                        className="text-xs"
                        style={{ color: "rgba(203, 213, 225, 0.72)", fontFamily: "var(--font-mono)" }}
                      >
                        Enter to send · Shift+Enter for newline
                      </span>
                      <span
                        className="text-xs"
                        style={{
                          color: isOverLimit ? "#F87171" : "rgba(203, 213, 225, 0.72)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {charCount > 0 ? `${charCount}/${MAX_CHAT_INPUT_LENGTH}` : attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? "s" : ""}` : ""}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-center text-xs text-slate-500">
                    Aurora can make mistakes. Always verify important information.
                  </p>
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

        <style jsx>{`
          .aurora-composer :global(.aurora-textarea::placeholder) {
            color: rgba(203, 213, 225, 0.58);
          }

          .input-glow {
            box-shadow: 0 18px 45px rgba(2, 6, 23, 0.28);
            overflow: hidden;
          }

          .input-glow::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            border-radius: inherit;
            background: radial-gradient(circle at top, rgba(79, 142, 255, 0.16), transparent 45%);
            opacity: 0.9;
          }

          .scan-line {
            position: absolute;
            top: 0;
            left: -30%;
            width: 45%;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.9), transparent);
            box-shadow: 0 0 12px rgba(79, 142, 255, 0.55);
            animation: aurora-scan 2.4s linear infinite;
            pointer-events: none;
          }

          @keyframes aurora-scan {
            0% {
              left: -30%;
            }
            100% {
              left: 100%;
            }
          }
        `}</style>
      </div>
    </main>
  )
}
