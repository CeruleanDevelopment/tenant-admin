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
import type { AppDispatch } from "../../../../../redux/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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

const nowTime = (): string => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

const formatTimeFromIso = (value?: string): string => {
  if (!value) return nowTime()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return nowTime()
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

const formatSessionDate = (value?: string): string => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.toLocaleDateString()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

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

const getInitialMessages = (): ChatMessage[] => []
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
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({})
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
  // auto-analysis disabled; no auto-run on page load
  const [conversationTitle, setConversationTitle] = useState<string | null>(null)
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null)
  const loadedHistoryRef = useRef<Set<string>>(new Set())
  const activeChatIdRef = useRef("")
  const loadingHistoryFlagRef = useRef(false)
  const documentsInputRef = useRef<HTMLInputElement | null>(null)
  const photosInputRef = useRef<HTMLInputElement | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const filesInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null)
  const lastAgentsFetchAtRef = useRef(0)
  const lastSessionsFetchAtRef = useRef(0)
  const agentsRequestInFlightRef = useRef(false)
  const sessionsRequestInFlightRef = useRef(false)

  const AGENTS_REFRESH_COOLDOWN_MS = 60000
  const SESSIONS_REFRESH_COOLDOWN_MS = 30000

  const loadUserSessions = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastSessionsFetchAtRef.current < SESSIONS_REFRESH_COOLDOWN_MS) return
    if (sessionsRequestInFlightRef.current) return

    sessionsRequestInFlightRef.current = true
    lastSessionsFetchAtRef.current = now
    setLoadingUserSessions(true)
    try {
      const rows = (await dispatch(fetchUserChatSessions() as any)) as UserChatSession[]
      const mapped = Array.isArray(rows) ? rows : []
      setUserSessions(mapped)
    } catch {
      setUserSessions([])
    } finally {
      sessionsRequestInFlightRef.current = false
      setLoadingUserSessions(false)
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
      const messageText =
        typeof loadError === "object" && loadError !== null && "message" in loadError
          ? String((loadError as { message?: string }).message || "Failed to load assigned agents.")
          : "Failed to load assigned agents."
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

  useEffect(() => {
    if (!selectedAgentId) return

    setChatIdByAgent((prev) => {
      if (prev[selectedAgentId]) {
        return prev
      }

      const nextChatId = initialAgentId === selectedAgentId && initialChatId ? initialChatId : createChatId()
      return {
        ...prev,
        [selectedAgentId]: nextChatId,
      }
    })
  }, [initialAgentId, initialChatId, selectedAgentId])

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )
  const selectedAgentIsGmail = isGmailAnalysisType(selectedAgent?.type || selectedAgent?.workflowType)
  const selectedWorkflowType = String(selectedAgent?.workflowType || selectedAgent?.type || "direct")
  const selectedQuickPrompts = selectedAgentIsGmail ? GMAIL_QUICK_PROMPTS : GENERIC_QUICK_PROMPTS
  const activeChatId = selectedAgentId ? chatIdByAgent[selectedAgentId] || "" : ""

  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  useEffect(() => {
    loadingHistoryFlagRef.current = loadingHistory
  }, [loadingHistory])

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
          const mapped = historyRows.map((row: Record<string, unknown>) => ({
            id: String(row.id || `history-${Date.now()}`),
            role: String(row.role || "assistant") === "user" ? "user" : "assistant",
            text: String(row.content || ""),
            time: formatTimeFromIso(String(row.created_at || "")),
          })) as ChatMessage[]

          setMessagesByAgent((prev) => ({
            ...prev,
            [selectedAgentId]: mapped,
          }))
          return
        }

        setMessagesByAgent((prev) => {
          if (prev[selectedAgentId]) return prev
          return {
            ...prev,
            [selectedAgentId]: getInitialMessages(),
          }
        })
      } catch {
        setMessagesByAgent((prev) => ({
          ...prev,
          [selectedAgentId]: prev[selectedAgentId] || getInitialMessages(),
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
    () => (selectedAgentId ? messagesByAgent[selectedAgentId] ?? getInitialMessages() : []),
    [messagesByAgent, selectedAgent, selectedAgentId],
  )

  // Auto-analysis on load removed: do not auto-generate responses on page load.

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
        }))

      return [...prev, ...nextItems]
    })

    event.target.value = ""
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId))
  }

  const openAttachmentSource = (source: "documents" | "photos" | "media" | "all") => {
    if (source === "documents") documentsInputRef.current?.click()
    if (source === "photos") photosInputRef.current?.click()
    if (source === "media") mediaInputRef.current?.click()
    // if (source === "all") filesInputRef.current?.click()
    setAttachmentMenuOpen(false)
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

  const renameSession = async (session: UserChatSession) => {
    if (!selectedAgentId) {
      setError("Select an agent first.")
      setOpenSessionMenuId(null)
      return
    }

    const nextTitle = window.prompt("Rename chat", String(session.title || "New chat"))
    if (nextTitle === null) {
      setOpenSessionMenuId(null)
      return
    }

    const title = String(nextTitle).trim()
    if (!title) {
      setError("Title cannot be empty.")
      setOpenSessionMenuId(null)
      return
    }

    try {
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
      await loadUserSessions(true)
      setError(null)
    } catch (err) {
      setError(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "Failed to rename conversation")
          : "Failed to rename conversation",
      )
    } finally {
      setOpenSessionMenuId(null)
    }
  }

  const deleteSession = async (session: UserChatSession) => {
    if (!selectedAgentId) {
      setError("Select an agent first.")
      setOpenSessionMenuId(null)
      return
    }

    const confirmed = window.confirm(`Delete chat \"${session.title || "New chat"}\"? This cannot be undone.`)
    if (!confirmed) {
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

      if (activeChatId === session.id) {
        const nextChatId = createChatId()
        setChatIdByAgent((prev) => ({
          ...prev,
          [selectedAgentId]: nextChatId,
        }))
        router.replace(buildChatUrl(selectedAgentId, nextChatId))
        setMessagesByAgent((prev) => ({
          ...prev,
          [selectedAgentId]: getInitialMessages(),
        }))
        setConversationTitle(null)
      }

      await loadUserSessions(true)
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
      time: nowTime(),
    }

    setError(null)
    setSending(true)
    setInput("")

    setMessagesByAgent((prev) => ({
      ...prev,
      [selectedAgentId]: [...(prev[selectedAgentId] ?? activeMessages), userMessage],
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
          chatId: activeChatId,
          workflowType: selectedWorkflowType,
        }) as any,
      )) as Record<string, unknown>

      const returnedChatId = String(payload.chatId || "").trim()
      if (returnedChatId && returnedChatId !== activeChatId) {
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
        time: nowTime(),
        source: "server",
        meta:
          payload.runStatus || payload.runId
            ? [payload.runStatus ? `run: ${String(payload.runStatus)}` : null, payload.runId ? `id: ${String(payload.runId)}` : null]
                .filter(Boolean)
                .join(" | ")
            : undefined,
      }

      setMessagesByAgent((prev) => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] ?? []), assistantMessage],
      }))
      setAttachments([])
      setAttachmentMenuOpen(false)
      setIsMicActive(false)
      void loadUserSessions(true)
    } catch (chatError: unknown) {
      const messageText =
        typeof chatError === "object" && chatError !== null && "message" in chatError
          ? String((chatError as { message?: string }).message || "Failed to send message.")
          : "Failed to send message."
      const friendlyError = normalizeOAuthErrorMessage(messageText)

      setError(friendlyError)
      setMessagesByAgent((prev) => ({
        ...prev,
        [selectedAgentId]: [
          ...(prev[selectedAgentId] ?? activeMessages),
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            text: friendlyError || "I could not reach the agent chat endpoint. Please try again.",
            time: nowTime(),
          },
        ],
      }))
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-primary/10 via-white to-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8  rounded-2xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
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
            <Badge variant={selectedAgentIsGmail && !selectedAgent?.oauthReady ? "destructive" : "outline"}>
              {selectedAgentIsGmail ? (selectedAgent?.oauthReady ? "Integration connected" : "Integration required") : "Workflow ready"}
            </Badge>
            <Badge variant="outline">{selectedWorkflowType}</Badge>
            <Badge variant="outline">{selectedAgent?.authMode === "user_personal_connection" ? "personal connection" : "tenant shared"}</Badge>
              {sessionPersisted ? (
                <Badge variant="secondary">
                  <CheckCircle2 className="mr-2 inline-block h-4 w-4 align-text-bottom" />
                  Session persisted
                </Badge>
              ) : null}

              <Button type="button" variant="outline" className="cursor-pointer" onClick={openAssignedAgents}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-700">{sanitizeAssistantText(error)}</p> : null}

        <div className="grid gap-4 lg:items-stretch lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="relative z-20 flex h-full flex-col rounded-3xl border-white/80 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Configured Agents</CardTitle>
              <CardDescription>Choose the agent you want to talk to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingAgents ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}
              {!loadingAgents && agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No configured agents found.</p>
              ) : null}

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

              <div className="rounded-2xl border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Recent Conversations
                  </div>
                  {/* <Badge variant="outline">{userSessions.length}</Badge> */}
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  All user chat sessions (chat ID wise).
                </p>

                {loadingUserSessions ? <p className="text-xs text-muted-foreground">Loading sessions...</p> : null}

                {!loadingUserSessions && userSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No conversation history found yet.</p>
                ) : null}

                <div className="max-h-80 space-y-2 overflow-y-auto pr-3">
                  {userSessions.map((session) => {
                    const isActiveSession = activeChatId === session.id
                    return (
                      <div
                        key={session.id}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                          isActiveSession
                            ? "border-primary/40 bg-primary/5"
                            : "border-slate-200 bg-slate-50 hover:border-primary/20 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left cursor-pointer"
                            onClick={() => {
                              if (!selectedAgentId) return
                              setSelectedAgentId(selectedAgentId)
                              setChatIdByAgent((prev) => ({
                                ...prev,
                                [selectedAgentId]: session.id,
                              }))
                              router.replace(buildChatUrl(selectedAgentId, session.id))
                              setOpenSessionMenuId(null)
                            }}
                          >
                            <p className="truncate text-xs font-semibold text-slate-800">{session.title || "New chat"}</p>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              aria-label="Conversation actions"
                              className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-800"
                              onClick={() => setOpenSessionMenuId((prev) => (prev === session.id ? null : session.id))}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {openSessionMenuId === session.id ? (
                              <div className="absolute -right-10 top-full z-50 mt-1 w-36 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100"
                                  onClick={() => void renameSession(session)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-rose-600 transition hover:bg-rose-50"
                                  onClick={() => void deleteSession(session)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-[75vh] min-h-140 max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-3xl border-white/80 bg-white/90 shadow-sm">
            <CardHeader className="border-b bg-linear-to-r from-primary/5 via-white to-sky-50/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Bot className="h-5 w-5 text-primary" />
                    <div className="flex items-center gap-3">
                      <span>{selectedAgent?.name || "No agent selected"}</span>
                      {conversationTitle ? (
                        <span className="text-sm text-muted-foreground">{conversationTitle}</span>
                      ) : null}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {selectedAgent
                      ? `${selectedWorkflowType} workflow, ${selectedAgent.executionMode} execution, model ${selectedAgent.aiModel}.`
                      : "Select an agent to start chat."}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {selectedAgent?.authMode === "user_personal_connection" ? "personal connection" : "tenant shared"}
                  </Badge>
                  <Badge variant="outline">{selectedAgent?.aiModel || "gpt-4.1-mini"}</Badge>
                  <Badge variant="outline">{selectedAgent?.executionMode || "manual"}</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 bg-gray-200/30 p-0 sm:p-2">
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
                      setChatIdByAgent((prev) => ({
                        ...prev,
                        [selectedAgentId]: nextChatId,
                      }))
                      router.replace(buildChatUrl(selectedAgentId, nextChatId))
                      setMessagesByAgent((prev) => ({
                        ...prev,
                        [selectedAgentId]: getInitialMessages(),
                      }))
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset Chat
                  </Button>
                </div> */}

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  {activeMessages.map((message) => {
                    const isUser = message.role === "user"
                    const isSystem = message.role === "system"

                    return (
                      <div key={message.id} className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                        {!isUser ? (
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSystem ? "bg-slate-200 text-slate-600" : "bg-primary text-white"}`}>
                            {isSystem ? <Wand2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                        ) : null}

                        <div
                          className={`max-w-[86%] rounded-[24px] px-4 py-3 shadow-sm ${
                            isUser
                              ? "rounded-br-md bg-primary text-white"
                              : isSystem
                                ? "rounded-tl-md border border-dashed border-slate-300 bg-white text-slate-600"
                                : "rounded-tl-md border border-white/80 bg-white text-slate-700"
                          }`}
                        >
                          <p className="text-sm leading-6 whitespace-pre-wrap wrap-break-word">{!isUser ? sanitizeAssistantText(message.text) : message.text}</p>
                          {message.meta ? <p className={`mt-1 text-[11px] ${isUser ? "text-white/80" : "text-slate-400"}`}>{message.meta}</p> : null}
                          {/* Source badge: demo vs AI */}
                          {!isUser && message.source ? (
                            <div className="mt-2">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${message.source === "server" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                                {message.source === "server" ? "Backend AI" : "AI"}
                              </span>
                            </div>
                          ) : null}
                          <p className={`mt-1 text-[11px] ${isUser ? "text-white/80" : "text-slate-400"}`}>{message.time}</p>
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
                    <div className="flex items-end gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-[24px] rounded-tl-md border border-white/80 bg-white px-4 py-3 shadow-sm">
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
                    ref={documentsInputRef}
                    type="file"
                    multiple
                    onChange={onAttachmentInputChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.md"
                    className="hidden"
                  />
                  <input
                    ref={photosInputRef}
                    type="file"
                    multiple
                    onChange={onAttachmentInputChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <input
                    ref={mediaInputRef}
                    type="file"
                    multiple
                    onChange={onAttachmentInputChange}
                    accept="audio/*,video/*"
                    className="hidden"
                  />
                  {/* <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    onChange={onAttachmentInputChange}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.md"
                    className="hidden"
                  /> */}

                  {attachments.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                          {attachment.kind === "image" ? (
                            <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-slate-600" />
                          )}
                          <span className="max-w-60 truncate text-xs text-slate-700">{attachment.file.name}</span>
                          <span className="text-[11px] text-slate-500">{formatFileSize(attachment.file.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                            aria-label={`Remove ${attachment.file.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex h-12 items-stretch gap-2">
                    <div ref={attachmentMenuRef} className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-12 rounded-2xl"
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
                                label: "Documents",
                                icon: FileText,
                                onClick: () => openAttachmentSource("documents"),
                              },
                              {
                                label: "Photos",
                                icon: Image,
                                onClick: () => openAttachmentSource("photos"),
                              },
                              // {
                              //   label: "Media",
                              //   icon: Globe,
                              //   onClick: () => openAttachmentSource("media"),
                              // },
                              // {
                              //   label: "All files",
                              //   icon: FolderClosed,
                              //   onClick: () => openAttachmentSource("all"),
                              // },
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

                    <div className="flex h-12 flex-1 items-center rounded-2xl border border-slate-200 px-3">
                      <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault()
                            void sendMessage()
                          }
                        }}
                        placeholder={
                          selectedAgent
                            ? "Ask the agent..."
                            : "Select an agent first..."
                        }
                        className="h-full w-full resize-none bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
                        disabled={!selectedAgentId || sending}
                      />
                    </div>

                    <Button
                      type="button"
                      variant={isMicActive ? "default" : "outline"}
                      className={`h-12 w-12 rounded-2xl ${isMicActive ? "bg-rose-500 text-white hover:bg-rose-600" : ""}`}
                      disabled={!selectedAgentId || sending}
                      onClick={toggleMic}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      className="h-12 w-12 rounded-2xl bg-primary text-white shadow-lg cursor-pointer shadow-primary/20 hover:bg-primary-light"
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
      </div>
    </main>
  )
}
