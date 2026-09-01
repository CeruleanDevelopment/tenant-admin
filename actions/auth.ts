import type { AnyAction } from "redux"
import type { ThunkAction } from "redux-thunk"
import { toast } from "sonner"

import axios from "../service/api"
import { extractApiMessage } from "../service/api"
import {
  clearAuthSession,
  setAuthInitialized,
  setAuthSession,
  type AuthResponse,
  type AuthSession,
} from "../redux/reducers/Home"
import {
  clearTenantProfile,
  setTenantProfile,
  type TenantProfile,
} from "../redux/reducers/Tenant"
import type { RootState } from "../redux/reducers"
import {
  clearAuthSessionCookie,
  clearAuthTokenCookie,
  clearRefreshTokenCookie,
  loadAuthSessionCookie,
  loadAuthTokenCookie,
  loadRefreshTokenCookie,
  saveAuthSessionCookie,
  saveAuthTokenCookie,
  saveRefreshTokenCookie,
} from "../utils/authCookies"
import { tenantAdminConfig } from "../config/config"
import {
  clearUserAuthSessionCookie,
  clearUserAuthTokenCookie,
  clearUserRefreshTokenCookie,
  loadUserAuthTokenCookie,
} from "../utils/userAuthCookies"
import { bootstrapUserAuth, signOutUser } from "./userAuth"
import { resolveSessionType } from "@/utils/access-control"

type TenantMeUser = {
  id: string
  email: string
  role: string
  isActive?: boolean | null
  firstName?: string | null
  lastName?: string | null
  assignedAgentIds?: string | null
}

type TenantMeResponse = {
  id?: string
  slug?: string
  companyName?: string
  company_name?: string
  name?: string
  tenantName?: string
  status?: string
  apiKey?: string | null
  apiSecretHash?: string | null
  secretKey?: string | null
  allowedOrigins: string[]
  phone?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryId?: string | null
  email?: string | null
  googleProvider?: string | null
  providerId?: string | null
  isActive?: 0 | 1
  settings: {
    defaultTopK?: number
    chunkSize?: number
    chunkOverlap?: number
  }
  oauth?: {
    clientId?: string
    clientSecret?: string
    authorizationURL?: string
    tokenURL?: string
    callbackURL?: string
    scope?: string[]
  }
  createdAt?: string
  updatedAt?: string
  picture?: string | null
  // users: TenantMeUser[]
}

type TenantGoogleAuthOptions = {
  tenantId?: string
  slug?: string
  tenantName?: string
  next?: string
  frontend?: string
  authPath?: "signin" | "signup"
}

type TenantOtpRequestInput = {
  email: string
  tenantId?: string
  tenantName?: string
  slug?: string
}

type TenantOtpVerifyInput = {
  sessionId: string
  code: string
  tenantId?: string
  tenantName?: string
  slug?: string
}

type TenantOtpSendResponse = {
  success: true
  sessionId: string
  expiresAt: string
  resendCooldownSeconds: number
}

type TenantRegisterInput = {
  firstName: string
  lastName: string
  email: string
  companyName: string
  countryId: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postalCode?: string
}

type TenantRegisterResponse = {
  success: true
  tenantId: string
  userId: string
  email: string
  message: string
}

type TenantAgentCreateInput = {
  name: string
  systemPrompt?: string
  agentSkill?: string
  agentInstruction?: string
  topK?: number
  isActive?: 0 | 1
  allowedCollections?: string[]
}

type TenantAgentUpdateInput = TenantAgentCreateInput & {
  agentId: string
}

type TenantAgentAssignmentInput = {
  agentId: string
  aiProvider: "openai" | "openrouter"
  aiModel: string
  managerCanRun: boolean
  userCanRun: boolean
  assignedUserIds: string[]
  meetingAutomationEnabled?: boolean
  meetingCreationMode?: "auto" | "confirm_first"
}

type TenantGmailStatus = {
  connected: boolean
  provider: string
  updatedAt?: string | null
}

type TenantAgentListItem = Record<string, unknown>

type TenantAgentDetail = Record<string, unknown>

type TenantAgentAssignmentView = {
  configured?: boolean
  [key: string]: unknown
}
type TenantAgentAssignmentMap = Record<string, TenantAgentAssignmentView | null>

type TenantAgentChatResponse = {
  response?: string
  reply?: string
  answer?: string
  markdown_summary?: string
  chatId?: string
  title?: string
  messageId?: string
  runId?: string
  runStatus?: string
  approvalId?: string
}

type TenantAgentChatHistoryMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

const unwrapEnvelope = <T>(input: unknown): T => {
  if (!input || typeof input !== "object") {
    return {} as T
  }

  const payload = input as Record<string, unknown>
  const nested = payload.data
  if (nested && typeof nested === "object") {
    return nested as T
  }

  return payload as T
}

const resolveTenantCompanyName = (source: Record<string, unknown>): string => {
  return String(
    source.companyName || source.company_name || source.tenantName || source.name || "",
  ).trim()
}

export type UserChatSessionItem = {
  id: string
  message_id?: string | null
  created_at: string
  title: string
}

const TENANT_SIGNIN_PATH = "/tenant/signin"
const TENANT_SIGNUP_PATH = "/tenant/signup"

export type ActiveCountry = {
  id: string
  name: string
  iso2: string
  phoneCode?: string | null
}

const normalizePostAuthNext = (value?: string | null): string => {
  const fallback = "/"
  const candidate = String(value || "").trim()

  if (!candidate || !candidate.startsWith("/")) {
    return fallback
  }

  if (candidate.startsWith("//")) {
    return fallback
  }

  const blocked = ["/signin", "/signup", TENANT_SIGNIN_PATH, TENANT_SIGNUP_PATH, "/auth/callback"]
  if (blocked.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}?`))) {
    return fallback
  }

  return candidate
}

const redirectTo = (browserWindow: Window, path: string): void => {
  browserWindow.location.assign(path)
}

const getBrowserWindow = (): Window | null => {
  if (typeof window === "undefined") {
    return null
  }

  return window
}

const openCenteredPopup = (browserWindow: Window, url: string): Window | null => {
  const width = 600
  const height = 700
  const left = Math.floor(browserWindow.screenX + (browserWindow.outerWidth - width) / 2)
  const top = Math.floor(browserWindow.screenY + (browserWindow.outerHeight - height) / 2)

  return browserWindow.open(
    url,
    "tenant-google",
    `width=${width},height=${height},left=${left},top=${top}`,
  )
}

const runTenantGoogleAuthPopup = async (
  dispatch: any,
  options?: TenantGoogleAuthOptions,
): Promise<void> => {
  const browserWindow = getBrowserWindow()
  if (!browserWindow) {
    return
  }

  // Best-effort health probe: do not block OAuth kickoff on probe failure.
  // If backend is truly unavailable, callback flow will surface the real error.
  try {
    const health = await axios.get("/tenant/health")
    if (!health || !health.data || health.data.ok !== true) {
      const errText = String((health && health.data && health.data.error) || "Service temporarily unavailable. Please try again shortly.")
      toast.warning(errText)
    }
  } catch {
    // Ignore probe errors here to avoid blocking Google auth startup.
  }

  const authPath = options?.authPath === "signup" ? "signup" : "signin"
  const requestedNext = authPath === "signup" ? options?.next || "/" : options?.next
  const next = normalizePostAuthNext(requestedNext)
  const url = buildTenantGoogleAuthUrl(authPath, {
    ...options,
    next,
    frontend: options?.frontend || browserWindow.location.origin,
  })

  const popup = openCenteredPopup(browserWindow, url)
  if (!popup) {
    // Popup blocked or failed; fallback to same-tab redirect.
    redirectTo(browserWindow, url)
    return
  }

  let poll: ReturnType<typeof setInterval> | null = null

  const cleanup = () => {
    browserWindow.removeEventListener("message", handleMessage)
    if (poll) {
      clearInterval(poll)
      poll = null
    }
  }

  const closePopup = () => {
    try {
      popup.close()
    } catch {
      // ignore
    }
  }

    const handleMessage = async (event: MessageEvent) => {
    if (event.origin !== browserWindow.location.origin) {
      return
    }

    const payload = event.data || {}
    if (payload?.type !== "tenant-auth" && payload?.type !== "tenant-auth-error") {
      return
    }

    if (payload?.type === "tenant-auth-error") {
      const authMode = options?.authPath === "signup" || Boolean(options?.tenantName) ? "signup" : "signin"
      const errorText = String(payload.error || "Tenant authentication failed.").trim()
      const target = authMode === "signup" ? TENANT_SIGNUP_PATH : TENANT_SIGNIN_PATH

      cleanup()
      closePopup()
      toast.error(errorText)
      redirectTo(browserWindow, target)
      return
    }

    const token = String(payload.token || "").trim()
    const refreshToken = String(payload.refreshToken || "").trim()
    const nextPath = normalizePostAuthNext(payload.next || next)

    cleanup()

    try {
      if (!token || !refreshToken) {
        toast.error("Tenant authentication failed.")
        redirectTo(browserWindow, TENANT_SIGNIN_PATH)
        return
      }

      // Persist tokens immediately so hydration/refresh can recover reliably.
      saveAuthTokenCookie(token)
      saveRefreshTokenCookie(refreshToken)

      const hydrated = await dispatch(hydrateTenantSession({ token, refreshToken }))
      if (hydrated) {
        toast.success(authPath === "signup" ? "Tenant account created successfully." : "Signed in successfully.")
        redirectTo(browserWindow, nextPath)
        return
      }

      const refreshed = await dispatch(refreshTenantSession())
      if (refreshed) {
        toast.success(authPath === "signup" ? "Tenant account created successfully." : "Signed in successfully.")
        redirectTo(browserWindow, nextPath)
        return
      }

      persistSession(null)
      dispatch(clearAuthSession())
      dispatch(clearTenantProfile())
      toast.error("Unable to complete tenant authentication. Please try again.")
      redirectTo(browserWindow, TENANT_SIGNIN_PATH)
    } finally {
      closePopup()
    }
  }

  browserWindow.addEventListener("message", handleMessage)

  poll = setInterval(() => {
    if (!popup || popup.closed) {
      cleanup()
    }
  }, 500)
}

const normalizeSession = (data: AuthResponse): AuthSession => ({
  token: data.token,
  refreshToken: data.refreshToken,
  user: data.user,
  tenant: data.tenant || null,
})

const persistSession = (session: AuthSession | null): void => {
  if (!session) {
    clearAuthTokenCookie()
    clearRefreshTokenCookie()
    clearAuthSessionCookie()
    return
  }

  // Keep tenant and user sessions mutually exclusive in browser cookies.
  clearUserAuthTokenCookie()
  clearUserRefreshTokenCookie()
  clearUserAuthSessionCookie()

  saveAuthTokenCookie(session.token)
  saveRefreshTokenCookie(session.refreshToken)
  saveAuthSessionCookie(session)
}

const storeSession = (dispatch: any, data: AuthResponse): AuthSession => {
  const normalized = unwrapEnvelope<AuthResponse & { tenant?: Record<string, unknown> | null }>(data)
  const session = normalizeSession({
    ...normalized,
    tenant: normalized?.tenant
      ? {
          ...(normalized.tenant as TenantProfile),
          companyName: resolveTenantCompanyName(normalized.tenant),
        }
      : null,
  })
  persistSession(session)
  dispatch(setAuthSession(session))
  if (session.tenant) {
    dispatch(setTenantProfile(session.tenant))
  } else {
    dispatch(clearTenantProfile())
  }
  return session
}

const normalizeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return `${normalized}${padding}`
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const payload = token.split(".")[1]
  if (!payload) {
    return null
  }

  try {
    const json = typeof window !== "undefined"
      ? window.atob(normalizeBase64Url(payload))
      : Buffer.from(normalizeBase64Url(payload), "base64").toString("utf8")
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

let fetchAssignedAgentsInFlight: Promise<unknown[]> | null = null
const ASSIGNMENT_CACHE_TTL_MS = 15000
let fetchTenantAgentsInFlight: Promise<TenantAgentListItem[]> | null = null
let fetchTenantAgentsCache: { value: TenantAgentListItem[]; fetchedAt: number } | null = null
const tenantAgentAssignmentInFlight = new Map<string, Promise<TenantAgentAssignmentView | null>>()
const tenantAgentAssignmentCache = new Map<string, { value: TenantAgentAssignmentView | null; fetchedAt: number }>()
let tenantAgentAssignmentsBatchInFlight: Promise<TenantAgentAssignmentMap> | null = null
let tenantAgentAssignmentsBatchCache: { value: TenantAgentAssignmentMap; fetchedAt: number } | null = null

export const fetchAssignedAgents = (): ThunkAction<Promise<unknown[]>, RootState, unknown, AnyAction> => {
  return async (): Promise<unknown[]> => {
    if (fetchAssignedAgentsInFlight) {
      return fetchAssignedAgentsInFlight
    }

    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }
    fetchAssignedAgentsInFlight = (async (): Promise<unknown[]> => {
      try {
        const response = await axios.get("/api/users/agents/assigned", { headers })
        const agents = (response?.data?.agents || []) as unknown[]
        return agents
      } catch (error: unknown) {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: string }).message || "")
            : ""

        const responseMessage =
          typeof error === "object" && error !== null && "response" in error
            ? String(
                (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
                  (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
                  "",
              ).trim()
            : ""

        const extracted = extractApiMessage(error)
        if (!responseMessage) {
          throw new Error(extracted || message || "Failed to load assigned agents.")
        }

        throw new Error(responseMessage || message || "Failed to load assigned agents.")
      } finally {
        fetchAssignedAgentsInFlight = null
      }
    })()

    return fetchAssignedAgentsInFlight
  }
}

export const startUserGmailIntegration = (
  next = "/users/agents",
  tenantId?: string,
): ThunkAction<Promise<string>, RootState, unknown, AnyAction> => {
  return async (dispatch: any): Promise<string> => {
    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }
    if (tenantId) headers["x-tenant-id"] = tenantId

    const frontend = typeof window !== "undefined" ? window.location.origin : undefined
    const body: Record<string, unknown> = { next }
    if (frontend) body.frontend = frontend

    const response = await axios.post("/integrations/gmail/start/user", body, { headers })
    const startUrl = String(response?.data?.startUrl || "")
    return startUrl
  }
}

export const sendTenantAgentChat = (
  input: { agentId: string; message: string; chatId?: string; topK?: number; collections?: string[]; workflowType?: string },
): ThunkAction<Promise<TenantAgentChatResponse>, RootState, unknown, AnyAction> => {
  return async (): Promise<TenantAgentChatResponse> => {
    const agentId = String(input.agentId || "").trim()
    if (!agentId) {
      throw new Error("Agent id is required.")
    }

    const payload: Record<string, unknown> = {
      message: String(input.message || "").trim(),
    }

    if (input.chatId) payload.chatId = String(input.chatId)

    if (typeof input.topK === "number") payload.topK = input.topK
    if (Array.isArray(input.collections)) payload.collections = input.collections
    if (input.workflowType) payload.workflowType = input.workflowType

    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }

    try {
      const response = await axios.post(`/ai/agents/${encodeURIComponent(agentId)}/chat`, payload, {
        headers,
        timeout: 120000,
      })
      const raw = (response?.data || {}) as Record<string, unknown>
      const reply = raw.reply && typeof raw.reply === "object" ? (raw.reply as Record<string, unknown>) : null
        const markdownSummary = String(raw.markdown_summary || reply?.markdown_summary || "").trim()
        const answer = String(markdownSummary || raw.response || reply?.answer || reply?.reply || raw.answer || "").trim()

      return {
        ...raw,
        chatId: String(raw.chatId || "").trim() || undefined,
        reply: typeof raw.reply === "string" ? raw.reply : answer,
        answer,
          markdown_summary: markdownSummary || undefined,
        response: String(raw.response || answer || "").trim(),
      } as TenantAgentChatResponse
    } catch (error: unknown) {
      const normalizeOAuthError = (value: string): string => {
        const text = String(value || "").trim()
        const lower = text.toLowerCase()
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

      const fallbackMessage = "I could not reach the agent chat endpoint. Please try again."
      const payload =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: unknown } }).response?.data
          : undefined

      const payloadMessage =
        typeof payload === "string"
          ? payload.trim()
          : payload && typeof payload === "object"
            ? String(
                (payload as { message?: string; error?: string }).message ||
                  (payload as { message?: string; error?: string }).error ||
                  "",
              ).trim()
            : ""

      const apiMessage =
        typeof error === "object" && error !== null && "response" in error
          ? String(
              (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
                (error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
                "",
            ).trim()
          : ""

      const rawMessage =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message || "").trim()
          : ""

      const pickedMessage = payloadMessage || apiMessage || rawMessage || fallbackMessage
      // Use centralized, safe API error extraction for network-related errors
      const extracted = extractApiMessage(error)
      const finalMessage = !payloadMessage && (pickedMessage.toLowerCase() === "network error" || pickedMessage.toLowerCase().includes("err_network") || pickedMessage.toLowerCase().includes("econn"))
        ? extracted
        : pickedMessage

      throw new Error(normalizeOAuthError(finalMessage))
    }
  }
}

export const fetchTenantAgentChatHistory = (
  input: { agentId: string; chatId: string },
): ThunkAction<Promise<{ chatId: string; history: TenantAgentChatHistoryMessage[] }>, RootState, unknown, AnyAction> => {
  return async (): Promise<{ chatId: string; history: TenantAgentChatHistoryMessage[] }> => {
    const agentId = String(input.agentId || "").trim()
    const chatId = String(input.chatId || "").trim()

    if (!agentId || !chatId) {
      return { chatId, history: [] }
    }

    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }

    const response = await axios.get(
      `/ai/agents/${encodeURIComponent(agentId)}/chat/history/${encodeURIComponent(chatId)}`,
      { headers },
    )

    const payload = (response?.data || {}) as Record<string, unknown>
    const historyRaw = Array.isArray(payload.history) ? payload.history : []

    return {
      chatId: String(payload.chatId || chatId),
      history: historyRaw
        .map((row) => ({
          id: String((row as Record<string, unknown>).id || ""),
          role: (String((row as Record<string, unknown>).role || "assistant") === "user" ? "user" : "assistant") as "user" | "assistant",
          content: String((row as Record<string, unknown>).content || ""),
          created_at: String((row as Record<string, unknown>).created_at || ""),
        }))
        .filter((row) => Boolean(row.id || row.content)),
    }
  }
}

export const ensureTenantChatSession = (
  input: { agentId: string; chatId?: string },
): ThunkAction<Promise<{ chatId?: string }>, RootState, unknown, AnyAction> => {
  return async (): Promise<{ chatId?: string }> => {
    const agentId = String(input.agentId || "").trim()
    if (!agentId) throw new Error("Agent id is required.")

    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }

    const payload: Record<string, unknown> = {}
    if (input.chatId) payload.chatId = String(input.chatId)

    const response = await axios.post(`/ai/agents/${encodeURIComponent(agentId)}/chat/session`, payload, { headers })
    return response?.data || {}
  }
}

const buildTenantGoogleAuthUrl = (
  authPath: "signin" | "signup",
  options?: TenantGoogleAuthOptions,
): string => {
  const url = new URL(`${tenantAdminConfig.apiUrl}/tenant/auth/google/${authPath}`)

  if (options?.tenantId) {
    url.searchParams.set("tenantId", options.tenantId)
  }

  if (options?.slug) {
    url.searchParams.set("slug", options.slug)
  }

  if (options?.tenantName) {
    url.searchParams.set("tenantName", options.tenantName)
  }

  if (options?.next) {
    url.searchParams.set("next", options.next)
  }

  const frontend = options?.frontend || (typeof window !== "undefined" ? window.location.origin : "")
  if (frontend) {
    url.searchParams.set("frontend", frontend)
  }

  return url.toString()
}

export const bootstrapAuth =
  (): ThunkAction<Promise<void>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const session = loadAuthSessionCookie<AuthSession>()
    const accessToken = loadAuthTokenCookie()
    const refreshToken = loadRefreshTokenCookie()

    if (session?.token && session?.refreshToken && session?.user) {
      dispatch(setAuthSession(session))
      if (session.tenant) {
        dispatch(setTenantProfile(session.tenant))
      } else {
        dispatch(clearTenantProfile())
      }
      void dispatch(hydrateTenantSession({ token: session.token, refreshToken: session.refreshToken }))
      dispatch(setAuthInitialized(true))
      return
    }

    if (!accessToken && !refreshToken) {
      const userBootstrapped = await dispatch(bootstrapUserAuth())
      if (userBootstrapped) {
        dispatch(setAuthInitialized(true))
        return
      }

      dispatch(clearAuthSession())
      dispatch(clearTenantProfile())
      dispatch(setAuthInitialized(true))
      return
    }

    try {
      const hydrated = await dispatch(hydrateTenantSession({
        token: accessToken || undefined,
        refreshToken: refreshToken || undefined,
      }))

      if (!hydrated) {
        throw new Error("Profile lookup failed")
      }
    } catch {
      const refreshed = await dispatch(refreshTenantSession())
      if (!refreshed) {
        const userBootstrapped = await dispatch(bootstrapUserAuth())
        if (!userBootstrapped) {
          dispatch(clearAuthSession())
          dispatch(clearTenantProfile())
        }
      }
    } finally {
      dispatch(setAuthInitialized(true))
    }
  }

export const refreshTenantSession =
  (): ThunkAction<Promise<AuthSession | null>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const refreshToken = loadRefreshTokenCookie()

    if (!refreshToken) {
      return null
    }

    try {
      const resp = await axios.post("/tenant/auth/refresh", { refreshToken })
      return storeSession(dispatch, unwrapEnvelope<AuthResponse>(resp.data) as AuthResponse)
    } catch {
      persistSession(null)
      dispatch(clearAuthSession())
      dispatch(clearTenantProfile())
      return null
    }
  }

export const hydrateTenantSession =
  (input?: { token?: string; refreshToken?: string }): ThunkAction<Promise<AuthSession | null>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const token = input?.token || loadAuthTokenCookie()
    const refreshToken = input?.refreshToken || loadRefreshTokenCookie()

    if (!token || !refreshToken) {
      return null
    }

    try {
      const resp = await axios.get("/tenant/me", {
        headers: {
          "x-tenant-token": token,
        },
      })
      const payload = unwrapEnvelope<Record<string, unknown>>(resp.data)
      const tenantProfile = ((payload.tenant && typeof payload.tenant === "object")
        ? payload.tenant
        : payload) as TenantMeResponse

      const decoded = decodeJwtPayload(token)
      const decodedEmail = String(decoded?.email || "").trim().toLowerCase()
      const decodedUserId = String(decoded?.sub || "").trim()

      const companyName = resolveTenantCompanyName(tenantProfile as Record<string, unknown>)
      const tenantId = String(tenantProfile.id || "").trim()
      const tenantSlug = String(tenantProfile.slug || "").trim()

      if (!tenantId) {
        throw new Error("Tenant profile payload did not include id")
      }

      const profile: TenantProfile = {
        id: tenantId,
        slug: tenantSlug,
        companyName,
        status: tenantProfile.status,
        apiKey: tenantProfile.apiKey || null,
        apiSecretHash: tenantProfile.apiSecretHash || null,
        secretKey: tenantProfile.secretKey || null,
        allowedOrigins: tenantProfile.allowedOrigins,
        phone: tenantProfile.phone || null,
        address1: tenantProfile.address1 || null,
        address2: tenantProfile.address2 || null,
        city: tenantProfile.city || null,
        state: tenantProfile.state || null,
        postalCode: tenantProfile.postalCode || null,
        countryId: tenantProfile.countryId || null,
        email: tenantProfile.email || null,
        googleProvider: tenantProfile.googleProvider || null,
        providerId: tenantProfile.providerId || null,
        isActive: tenantProfile.isActive,
        settings: tenantProfile.settings,
        oauth: tenantProfile.oauth,
        picture: tenantProfile.picture || null,
        createdAt: tenantProfile.createdAt,
        updatedAt: tenantProfile.updatedAt,
      }

      const session: AuthSession = {
        token,
        refreshToken,
        user: {
          id: decodedUserId || "",
          email: decodedEmail,
          name: String(decoded?.name || decodedEmail || "Tenant User"),
          role: String(decoded?.role || "member"),
          tenantId,
        },
        tenant: profile,
      }

      persistSession(session)
      dispatch(setAuthSession(session))
      dispatch(setTenantProfile(profile))
      return session
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[auth] hydrateTenantSession failed", error)
      }
      return null
    }
  }

export const signOutTenant =
  (options?: { redirectToSignIn?: boolean }): ThunkAction<Promise<void>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const redirectToSignIn = options?.redirectToSignIn !== false
    const refreshToken = loadRefreshTokenCookie()

    try {
      await axios.post("/tenant/auth/logout", { refreshToken })
    } catch {
      // best effort
    }
    persistSession(null)
    dispatch(clearAuthSession())
    dispatch(clearTenantProfile())
    dispatch(setAuthInitialized(true))

    if (redirectToSignIn && typeof window !== "undefined") {
      window.location.assign(TENANT_SIGNIN_PATH)
    }
  }

  // Generic sign out that chooses tenant vs user session and delegates appropriately
  export const signOut =
    (options?: { redirectToSignIn?: boolean }): ThunkAction<Promise<void>, RootState, unknown, AnyAction> =>
    async (dispatch, getState) => {
      const state = getState() as RootState
      const sessionType = resolveSessionType({
        authUserId: state.auth.user?.id,
        tenantId: state.tenant.profile?.id,
        role: state.auth.user?.role,
      })

      if (sessionType === "tenant") {
        // delegate to tenant sign out (keeps existing behavior)
        // preserve redirect option
        // @ts-ignore - dispatch accepts thunk
        return dispatch(signOutTenant(options) as any)
      }

      if (sessionType === "user") {
        // delegate to user sign out
        // @ts-ignore
        await dispatch(signOutUser() as any)
        if (options?.redirectToSignIn !== false && typeof window !== "undefined") {
          window.location.assign("/users/signin")
        }
        return
      }

      // guest: ensure local cleanup
      persistSession(null)
      dispatch(clearAuthSession())
      dispatch(clearTenantProfile())
      dispatch(setAuthInitialized(true))

      if (options?.redirectToSignIn !== false && typeof window !== "undefined") {
        window.location.assign("/users/signin")
      }
    }

export const signInTenantWithGoogle =
  (options?: TenantGoogleAuthOptions): ThunkAction<void, RootState, unknown, AnyAction> =>
  (dispatch) => {
    runTenantGoogleAuthPopup(dispatch, { ...options, authPath: "signin" })
  }

export const signUpTenantWithGoogle =
  (options?: TenantGoogleAuthOptions): ThunkAction<void, RootState, unknown, AnyAction> =>
  (dispatch) => {
    runTenantGoogleAuthPopup(dispatch, { ...options, authPath: "signup" })
  }

export const requestTenantOtp =
  (input: TenantOtpRequestInput): ThunkAction<Promise<TenantOtpSendResponse>, RootState, unknown, AnyAction> =>
  async () => {
    const response = await axios.post("/tenant/auth/otp/send", input)
    return response.data as TenantOtpSendResponse
  }

export const registerTenant =
  (input: TenantRegisterInput): ThunkAction<Promise<TenantRegisterResponse>, RootState, unknown, AnyAction> =>
  async () => {
    const response = await axios.post("/tenant/register", input)
    return response.data as TenantRegisterResponse
  }

export const fetchCountries =
  (): ThunkAction<Promise<ActiveCountry[]>, RootState, unknown, AnyAction> =>
  async () => {
    const response = await axios.get("/tenant/countries")
    const countries = Array.isArray(response?.data?.countries) ? response.data.countries : []
    return countries as ActiveCountry[]
  }

let _fetchTenantUsersPromise: Promise<TenantMeUser[]> | null = null

export const fetchTenantUsers =
  (): ThunkAction<Promise<TenantMeUser[]>, RootState, unknown, AnyAction> =>
  async () => {
    // Deduplicate concurrent requests (helps with React StrictMode double-mounts)
    if (_fetchTenantUsersPromise) return _fetchTenantUsersPromise

    const token = loadAuthTokenCookie()
    if (!token) {
      console.debug("fetchTenantUsers: skipping request because tenant token is not available yet")
      return []
    }

    const headers: Record<string, string> = {}
    headers["x-tenant-token"] = token

    _fetchTenantUsersPromise = (async () => {
      try {
        const params = { sortBy: "createdAt", order: "desc" }
        console.debug("fetchTenantUsers: calling /tenant/users with headers and params:", headers, params)
        const response = await axios.get("/tenant/users", { headers, params })
        const users = Array.isArray(response?.data?.users) ? response.data.users : []
        return users as TenantMeUser[]
      } catch (error) {
        console.warn("fetchTenantUsers failed:", extractApiMessage(error))
        return []
      } finally {
        // clear promise so subsequent calls after completion will re-fetch
        _fetchTenantUsersPromise = null
      }
    })()

    return _fetchTenantUsersPromise
  }

export const fetchTenantAgentAssignments =
  (
    options?: { force?: boolean },
  ): ThunkAction<Promise<TenantAgentAssignmentMap>, RootState, unknown, AnyAction> =>
  async () => {
    const shouldForce = Boolean(options?.force)
    if (!shouldForce && tenantAgentAssignmentsBatchCache && Date.now() - tenantAgentAssignmentsBatchCache.fetchedAt < ASSIGNMENT_CACHE_TTL_MS) {
      return tenantAgentAssignmentsBatchCache.value
    }

    if (!shouldForce && tenantAgentAssignmentsBatchInFlight) {
      return tenantAgentAssignmentsBatchInFlight
    }

    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    tenantAgentAssignmentsBatchInFlight = (async (): Promise<TenantAgentAssignmentMap> => {
      try {
        const resp = await axios.get("/ai/agents/assignments", { headers })
        const rows = Array.isArray(resp?.data?.assignments) ? resp.data.assignments : []
        const fetchedAt = Date.now()
        const next: TenantAgentAssignmentMap = {}

        rows.forEach((row: unknown) => {
          const assignment = row && typeof row === "object" ? (row as TenantAgentAssignmentView) : null
          const agentId = String((assignment as Record<string, unknown> | null)?.agentId || "").trim()
          if (!agentId) return

          next[agentId] = assignment
          tenantAgentAssignmentCache.set(agentId, { value: assignment, fetchedAt })
        })

        tenantAgentAssignmentsBatchCache = { value: next, fetchedAt }
        return next
      } catch (error) {
        console.warn("fetchTenantAgentAssignments failed:", extractApiMessage(error))
        return {}
      } finally {
        tenantAgentAssignmentsBatchInFlight = null
      }
    })()

    return tenantAgentAssignmentsBatchInFlight
  }

export const verifyTenantOtp =
  (input: TenantOtpVerifyInput): ThunkAction<Promise<AuthResponse>, RootState, unknown, AnyAction> =>
  async () => {
    const response = await axios.post("/tenant/auth/otp/verify", input)
    return response.data as AuthResponse
  }

  export const addTenantUser =
  (input: { email: string; firstName?: string; lastName?: string; role?: string; isActive?: number | boolean; assignedAgentIds?: string })
  : ThunkAction<Promise<any>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const payload: Record<string, any> = {
      email: input.email,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      isActive: typeof input.isActive === "boolean" ? (input.isActive ? 1 : 0) : input.isActive,
    }

    if (typeof input.role !== "undefined" && input.role !== null) {
      payload.role = input.role
    }

    if (typeof input.assignedAgentIds === "string") {
      payload.assignedAgentIds = input.assignedAgentIds
    }

    console.debug("addTenantUser: calling /tenant/add_user with headers:", headers, "payload:", payload)
    const resp = await axios.post("/tenant/add_user", payload, { headers })
    return resp.data
  }

export const setTenantUserActiveStatus =
  (input: { userId: string; isActive: boolean }): ThunkAction<Promise<any>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const payload = { isActive: input.isActive ? 1 : 0 }
    console.debug("setTenantUserActiveStatus: calling PATCH /tenant/users/:userId/status", {
      userId: input.userId,
      headers,
      payload,
    })

    const resp = await axios.patch(`/tenant/users/${encodeURIComponent(String(input.userId || ""))}/status`, payload, { headers })
    return resp.data
  }

export const updateTenantUser =
  (input: { userId: string; firstName?: string; lastName?: string; role?: string; isActive?: number | boolean; assignedAgentIds?: string })
  : ThunkAction<Promise<any>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const payload: Record<string, any> = {}

    if (typeof input.firstName !== "undefined") {
      payload.firstName = input.firstName || null
    }

    if (typeof input.lastName !== "undefined") {
      payload.lastName = input.lastName || null
    }

    if (typeof input.isActive !== "undefined") {
      payload.isActive = typeof input.isActive === "boolean" ? (input.isActive ? 1 : 0) : input.isActive
    }

    if (typeof input.role !== "undefined" && input.role !== null) {
      payload.role = input.role
    }

    if (typeof input.assignedAgentIds === "string") {
      payload.assignedAgentIds = input.assignedAgentIds
    }

    console.debug("updateTenantUser: calling PATCH /tenant/users/:userId", {
      userId: input.userId,
      headers,
      payload,
    })

    const resp = await axios.patch(`/tenant/users/${encodeURIComponent(String(input.userId || ""))}`, payload, { headers })
    return resp.data
  }

export const createTenantAgent =
  (input: TenantAgentCreateInput): ThunkAction<Promise<{ agent?: { id?: string } }>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.post(
      "/ai/agents",
      {
        name: input.name,
        systemPrompt: input.systemPrompt || "",
        agentSkill: input.agentSkill || "",
        agentInstruction: input.agentInstruction || "",
        topK: input.topK ?? 6,
        isActive: Number(input.isActive ?? 1) === 0 ? 0 : 1,
        allowedCollections: Array.isArray(input.allowedCollections) ? input.allowedCollections : [],
      },
      { headers },
    )

    return (resp?.data || {}) as { agent?: { id?: string } }
  }

export const fetchTenantAgent =
  (agentId: string): ThunkAction<Promise<TenantAgentDetail | null>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.get(`/ai/agents/${encodeURIComponent(String(agentId || ""))}`, { headers })
    return (resp?.data?.agent || null) as TenantAgentDetail | null
  }

export const updateTenantAgent =
  (input: TenantAgentUpdateInput): ThunkAction<Promise<{ agent?: { id?: string } }>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.patch(
      `/ai/agents/${encodeURIComponent(String(input.agentId || ""))}`,
      {
        name: input.name,
        systemPrompt: input.systemPrompt || "",
        agentSkill: input.agentSkill || "",
        agentInstruction: input.agentInstruction || "",
        topK: input.topK ?? 6,
        isActive: Number(input.isActive ?? 1) === 0 ? 0 : 1,
        allowedCollections: Array.isArray(input.allowedCollections) ? input.allowedCollections : [],
      },
      { headers },
    )

    return (resp?.data || {}) as { agent?: { id?: string } }
  }

export const upsertTenantAgentAssignment =
  (input: TenantAgentAssignmentInput): ThunkAction<Promise<{ assignment?: unknown }>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.post(
      `/ai/agents/${encodeURIComponent(String(input.agentId || ""))}/assignments`,
      {
        aiProvider: input.aiProvider,
        aiModel: input.aiModel,
        managerCanRun: input.managerCanRun,
        userCanRun: input.userCanRun,
        assignedUserIds: input.assignedUserIds,
        meetingAutomationEnabled: Boolean(input.meetingAutomationEnabled ?? true),
        meetingCreationMode: input.meetingCreationMode || "auto",
      },
      { headers },
    )

    const assignmentAgentId = String(input.agentId || "").trim()
    if (assignmentAgentId) {
      tenantAgentAssignmentCache.delete(assignmentAgentId)
      tenantAgentAssignmentInFlight.delete(assignmentAgentId)
      tenantAgentAssignmentsBatchCache = null
      tenantAgentAssignmentsBatchInFlight = null
    }

    return (resp?.data || {}) as { assignment?: unknown }
  }

export const fetchTenantGmailStatus =
  (): ThunkAction<Promise<TenantGmailStatus>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.get("/integrations/gmail/status", { headers })
    return (resp?.data?.status || { connected: false, provider: "google" }) as TenantGmailStatus
  }

export const fetchUserGmailMessages =
  (input?: { max?: number }): ThunkAction<Promise<any[]>, RootState, unknown, AnyAction> =>
  async () => {
    const max = Math.max(1, Math.min(100, Number(input?.max || 20)))
    const resp = await axios.get(`/integrations/gmail/messages/user?max=${encodeURIComponent(String(max))}`)
    return Array.isArray(resp?.data?.messages) ? resp.data.messages : []
  }

export const fetchTenantGmailMessages =
  (input?: { max?: number }): ThunkAction<Promise<any[]>, RootState, unknown, AnyAction> =>
  async () => {
    const max = Math.max(1, Math.min(100, Number(input?.max || 20)))
    const resp = await axios.get(`/integrations/gmail/messages/tenant?max=${encodeURIComponent(String(max))}`)
    return Array.isArray(resp?.data?.messages) ? resp.data.messages : []
  }

export const fetchTenantAgents =
  (): ThunkAction<Promise<TenantAgentListItem[]>, RootState, unknown, AnyAction> =>
  async () => {
    if (fetchTenantAgentsCache && Date.now() - fetchTenantAgentsCache.fetchedAt < ASSIGNMENT_CACHE_TTL_MS) {
      return fetchTenantAgentsCache.value
    }

    if (fetchTenantAgentsInFlight) {
      return fetchTenantAgentsInFlight
    }

    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    fetchTenantAgentsInFlight = (async () => {
      try {
        const resp = await axios.get("/ai/agents", { headers })
        const rows = Array.isArray(resp?.data?.agents) ? resp.data.agents : []
        const value = rows as TenantAgentListItem[]
        fetchTenantAgentsCache = {
          value,
          fetchedAt: Date.now(),
        }
        return value
      } catch (error) {
        console.warn("fetchTenantAgents failed:", extractApiMessage(error))
        return []
      } finally {
        fetchTenantAgentsInFlight = null
      }
    })()

    return fetchTenantAgentsInFlight
  }

export const fetchTenantAgentAssignment =
  (
    agentId: string,
    options?: { force?: boolean },
  ): ThunkAction<Promise<TenantAgentAssignmentView | null>, RootState, unknown, AnyAction> =>
  async () => {
    const normalizedAgentId = String(agentId || "").trim()
    if (!normalizedAgentId) return null

    const shouldForce = Boolean(options?.force)
    if (!shouldForce) {
      const cached = tenantAgentAssignmentCache.get(normalizedAgentId)
      if (cached && Date.now() - cached.fetchedAt < ASSIGNMENT_CACHE_TTL_MS) {
        return cached.value
      }

      const inFlight = tenantAgentAssignmentInFlight.get(normalizedAgentId)
      if (inFlight) {
        return inFlight
      }
    }

    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const request = (async (): Promise<TenantAgentAssignmentView | null> => {
      try {
        const resp = await axios.get(`/ai/agents/${encodeURIComponent(normalizedAgentId)}/assignments`, { headers })
        const assignment = (resp?.data?.assignment || null) as TenantAgentAssignmentView | null
        tenantAgentAssignmentCache.set(normalizedAgentId, {
          value: assignment,
          fetchedAt: Date.now(),
        })
        return assignment
      } finally {
        tenantAgentAssignmentInFlight.delete(normalizedAgentId)
      }
    })()

    tenantAgentAssignmentInFlight.set(normalizedAgentId, request)
    return request
  }

export const startTenantGmailIntegration =
  (input?: { next?: string }): ThunkAction<Promise<{ startUrl?: string }>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.post("/integrations/gmail/start", { next: input?.next || "/tenant/agents" }, { headers })
    return (resp?.data || {}) as { startUrl?: string }
  }

export const disconnectTenantGmailIntegration =
  (): ThunkAction<Promise<{ disconnected?: boolean }>, RootState, unknown, AnyAction> =>
  async () => {
    const token = loadAuthTokenCookie()
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    const resp = await axios.delete("/integrations/gmail", { headers })
    return (resp?.data || {}) as { disconnected?: boolean }
  }
export const fetchUserChatSessions = (
  input?: { agentId?: string },
): ThunkAction<Promise<UserChatSessionItem[]>, RootState, unknown, AnyAction> => {
  return async (): Promise<UserChatSessionItem[]> => {
    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }

    const agentId = String(input?.agentId || "").trim()
    const response = await axios.get("/api/chat/sessions", {
      headers,
      params: agentId ? { agentId, limit: 200 } : { limit: 200 },
    })
    const rows = Array.isArray(response?.data?.sessions) ? response.data.sessions : []

    return rows
      .map((row: Record<string, unknown>) => ({
        id: String(row.id || "").trim(),
        message_id: row.message_id ? String(row.message_id) : null,
        created_at: String(row.created_at || ""),
        title: String(row.title || "New chat"),
      }))
      .filter((row: UserChatSessionItem) => Boolean(row.id))
  }
}

export const renameTenantAgentConversationUser = (
  input: { agentId: string; conversationId: string; title: string },
): ThunkAction<Promise<{ updated?: boolean }>, RootState, unknown, AnyAction> => {
  return async (): Promise<{ updated?: boolean }> => {
    const agentId = String(input.agentId || "").trim()
    const conversationId = String(input.conversationId || "").trim()
    const title = String(input.title || "").trim()

    if (!agentId) throw new Error("Agent id is required.")
    if (!conversationId) throw new Error("Conversation id is required.")
    if (!title) throw new Error("Title is required.")

    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }

    const response = await axios.patch(
      `/ai/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}/user`,
      { title },
      { headers },
    )

    return (response?.data || {}) as { updated?: boolean }
  }
}

export const deleteTenantAgentConversationUser = (
  input: { agentId: string; conversationId: string },
): ThunkAction<Promise<{ deleted?: boolean }>, RootState, unknown, AnyAction> => {
  return async (): Promise<{ deleted?: boolean }> => {
    const agentId = String(input.agentId || "").trim()
    const conversationId = String(input.conversationId || "").trim()

    if (!agentId) throw new Error("Agent id is required.")
    if (!conversationId) throw new Error("Conversation id is required.")

    const headers: Record<string, string> = {}
    const userToken = String(loadUserAuthTokenCookie() || "").trim()
    if (userToken) {
      headers.user = userToken
      headers.Authorization = `Bearer ${userToken}`
    }

    const response = await axios.delete(
      `/ai/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}/user`,
      { headers },
    )

    return (response?.data || {}) as { deleted?: boolean }
  }
}
