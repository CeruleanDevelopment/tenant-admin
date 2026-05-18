import type { AnyAction } from "redux"
import type { ThunkAction } from "redux-thunk"
import { toast } from "sonner"

import axios from "../service/api"
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
import { bootstrapUserAuth } from "./userAuth"

type TenantMeUser = {
  id: string
  email: string
  name: string
  role: string
}

type TenantMeResponse = {
  id: string
  slug: string
  companyName: string
  status: string
  allowedOrigins: string[]
  settings: {
    defaultTopK?: number
    chunkSize?: number
    chunkOverlap?: number
  }
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

const TENANT_SIGNIN_PATH = "/tenannt/signin"
const TENANT_SIGNUP_PATH = "/tenannt/signup"

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

  saveAuthTokenCookie(session.token)
  saveRefreshTokenCookie(session.refreshToken)
  saveAuthSessionCookie(session)
}

const storeSession = (dispatch: any, data: AuthResponse): AuthSession => {
  const session = normalizeSession(data)
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
      return storeSession(dispatch, resp.data as AuthResponse)
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
      const tenantProfile = resp.data as TenantMeResponse

      const decoded = decodeJwtPayload(token)
      const decodedEmail = String(decoded?.email || "").trim().toLowerCase()
      const decodedUserId = String(decoded?.sub || "").trim()

      const profile: TenantProfile = {
        id: tenantProfile.id,
        slug: tenantProfile.slug,
        companyName: (tenantProfile as any).companyName || (tenantProfile as any).name || "",
        status: tenantProfile.status,
        allowedOrigins: tenantProfile.allowedOrigins,
        settings: tenantProfile.settings,
        picture: tenantProfile.picture || null,
      }

      const session: AuthSession = {
        token,
        refreshToken,
        user: {
          id: decodedUserId || "",
          email: decodedEmail,
          name: String(decoded?.name || decodedEmail || "Tenant User"),
          role: String(decoded?.role || "member"),
          tenantId: tenantProfile.id,
        },
        tenant: profile,
      }

      persistSession(session)
      dispatch(setAuthSession(session))
      dispatch(setTenantProfile(profile))
      return session
    } catch {
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
    const headers: Record<string, string> = {}
    if (token) headers["x-tenant-token"] = token

    _fetchTenantUsersPromise = (async () => {
      try {
        const response = await axios.get("/tenant/users", { headers })
        const users = Array.isArray(response?.data?.users) ? response.data.users : []
        return users as TenantMeUser[]
      } finally {
        // clear promise so subsequent calls after completion will re-fetch
        _fetchTenantUsersPromise = null
      }
    })()

    return _fetchTenantUsersPromise
  }

export const verifyTenantOtp =
  (input: TenantOtpVerifyInput): ThunkAction<Promise<AuthResponse>, RootState, unknown, AnyAction> =>
  async () => {
    const response = await axios.post("/tenant/auth/otp/verify", input)
    return response.data as AuthResponse
  }

  export const addTenantUser =
  (input: { email: string; firstName?: string; lastName?: string; role?: string; isActive?: number | boolean })
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

    const resp = await axios.post("/tenant/add_user", payload, { headers })
    return resp.data
  }
