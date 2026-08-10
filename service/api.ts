import { API_URL } from "../config/config"
import axios from "axios"
import { store } from "../redux/store"
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
import {
  clearUserAuthSessionCookie,
  clearUserAuthTokenCookie,
  clearUserRefreshTokenCookie,
  loadUserAuthTokenCookie,
  loadUserRefreshTokenCookie,
  saveUserAuthSessionCookie,
  saveUserAuthTokenCookie,
  saveUserRefreshTokenCookie,
} from "../utils/userAuthCookies"
import { clearAuthSession, setAuthInitialized, setAuthSession, type AuthResponse, type AuthSession } from "../redux/reducers/Home"
import { clearTenantProfile, setTenantProfile } from "../redux/reducers/Tenant"

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
})

const toLoopbackApiUrl = (value: string): string => {
  try {
    const url = new URL(String(value || "").trim())
    if (url.hostname !== "localhost") return ""
    url.hostname = "127.0.0.1"
    return url.toString().replace(/\/$/, "")
  } catch {
    return ""
  }
}

const LOOPBACK_API_URL = toLoopbackApiUrl(API_URL)

const defaultSuccessMessage = (method?: string): string => {
  const m = String(method || "GET").toUpperCase()
  if (m === "POST") return "Created successfully."
  if (m === "PUT" || m === "PATCH") return "Updated successfully."
  if (m === "DELETE") return "Deleted successfully."
  return "Request completed successfully."
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

export const extractApiMessage = (error: any): string => {
  // Network-level errors (no response) — produce safe, user-friendly messages
  if (axios.isAxiosError(error) && !error.response) {
    const code = String(error.code || "").trim()
    // Mixed-content (HTTP API from HTTPS page)
    const baseTarget = String(API_URL || "").trim() || "http://localhost:4054"

    if (typeof window !== "undefined" && window.location.protocol === "https:" && baseTarget.startsWith("http://")) {
      return "Network error: the browser blocked an insecure request to the API. Use an HTTPS API URL or run the app on HTTP locally."
    }

    if (code === "ECONNABORTED") {
      return "Request timed out while contacting the API. Please check that the API service is running and reachable."
    }

    return "Network error: unable to reach the API. Please check your network connection or ensure the API service is running."
  }

  const payload = error?.response?.data

  const normalize = (value: unknown): string => normalizeOAuthErrorMessage(String(value || ""))

  if (typeof payload === "string" && payload.trim()) {
    return normalize(payload)
  }

  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) return normalize(payload.message)
    if (typeof payload.error === "string" && payload.error.trim()) return normalize(payload.error)

    if (payload.error && typeof payload.error === "object") {
      if (typeof payload.error.message === "string" && payload.error.message.trim()) return normalize(payload.error.message)
      if (typeof payload.error.error === "string" && payload.error.error.trim()) return normalize(payload.error.error)
    }
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return normalize(error.message)
  }

  return "Request failed. Please try again."
}

const clearApiAuthHeaders = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (api.defaults.headers as any)["x-tenant-token"]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (api.defaults.headers as any).user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (api.defaults.headers as any).Authorization
}

const clearClientSession = (): void => {
  clearAuthTokenCookie()
  clearRefreshTokenCookie()
  clearAuthSessionCookie()
  clearUserAuthTokenCookie()
  clearUserRefreshTokenCookie()
  clearUserAuthSessionCookie()
  clearApiAuthHeaders()
  store.dispatch(clearAuthSession())
  store.dispatch(clearTenantProfile())
  store.dispatch(setAuthInitialized(true))
}

let refreshRequestPromise: Promise<string | null> | null = null
let userRefreshRequestPromise: Promise<string | null> | null = null

const tryRefreshTenantToken = async (): Promise<string | null> => {
  const refreshToken = String(loadRefreshTokenCookie() || "").trim()
  if (!refreshToken) {
    return null
  }

  try {
    const response = await axios.post(
      `${API_URL}/tenant/auth/refresh`,
      { refreshToken },
      { withCredentials: true },
    )

    const payload = (response?.data || {}) as AuthResponse
    const token = String(payload.token || "").trim()
    const nextRefreshToken = String(payload.refreshToken || "").trim()
    const user = payload.user || loadAuthSessionCookie<AuthSession>()?.user || null

    if (!token || !nextRefreshToken || !user) {
      return null
    }

    const session: AuthSession = {
      token,
      refreshToken: nextRefreshToken,
      user,
      tenant: payload.tenant || null,
    }

    saveAuthTokenCookie(token)
    saveRefreshTokenCookie(nextRefreshToken)
    saveAuthSessionCookie(session)

    store.dispatch(setAuthSession(session))
    if (session.tenant) {
      store.dispatch(setTenantProfile(session.tenant))
    } else {
      store.dispatch(clearTenantProfile())
    }

    return token
  } catch {
    return null
  }
}

const tryRefreshUserToken = async (): Promise<string | null> => {
  const refreshToken = String(loadUserRefreshTokenCookie() || "").trim()
  if (!refreshToken) {
    return null
  }

  try {
    const response = await axios.post(
      `${API_URL}/account/auth/refresh`,
      { refreshToken },
      { withCredentials: true },
    )

    const payload = (response?.data || {}) as AuthResponse
    const token = String(payload.token || "").trim()
    const nextRefreshToken = String(payload.refreshToken || "").trim()
    const user = payload.user || null

    if (!token || !nextRefreshToken || !user) {
      return null
    }

    saveUserAuthTokenCookie(token)
    saveUserRefreshTokenCookie(nextRefreshToken)
    saveUserAuthSessionCookie({ token, refreshToken: nextRefreshToken, user, tenant: null })

    store.dispatch(setAuthSession({ token, refreshToken: nextRefreshToken, user, tenant: null }))
    store.dispatch(clearTenantProfile())

    return token
  } catch {
    return null
  }
}

api.interceptors.request.use((config: any) => {
  const requestUrl = String(config?.url || "")
  const isAccountRequest = requestUrl.startsWith("/account/")

  const stateToken = store.getState().auth?.token || ""
  const stateOrCookieToken = isAccountRequest
    ? (stateToken || loadUserAuthTokenCookie())
    : (stateToken || loadAuthTokenCookie())

  config.headers = config.headers ?? {}

  const explicitHeaderToken =
    String(config.headers["x-tenant-token"] || "").trim() ||
    (() => {
      const authHeader = String(config.headers.Authorization || config.headers.authorization || "").trim()
      if (!authHeader.toLowerCase().startsWith("bearer ")) return ""
      return authHeader.slice(7).trim()
    })()

  // Prefer an explicit token provided on the request (e.g. Authorization header)
  // so callers can override the stored tenant/user tokens when needed.
  const token = explicitHeaderToken || stateOrCookieToken

  if (token) {
    if (!isAccountRequest) {
      config.headers["x-tenant-token"] = token
    } else {
      delete config.headers["x-tenant-token"]
    }
    config.headers.user = token
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers["x-tenant-token"]
    delete config.headers.user
    delete config.headers.Authorization
  }

  if (typeof window !== "undefined") {
    config.headers["x-client-path"] = window.location.pathname
  }

  const method = (config.method || "GET").toString().toUpperCase()
  const url = config.url || "/"
   
  // console.log(`[tenant-admin] calling API: ${method} ${url}`)

  return config
})

api.interceptors.response.use(
  (response: any) => {
    const payload = response?.data
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      if (typeof payload.success === "undefined") {
        payload.success = response.status >= 200 && response.status < 400
      }

      if (typeof payload.message === "undefined") {
        payload.message = defaultSuccessMessage(response?.config?.method)
      }
    }

    return response
  },
  async (error: any) => {
    const shouldRetryWithLoopback =
      axios.isAxiosError(error) &&
      !error.response &&
      typeof window !== "undefined" &&
      Boolean(LOOPBACK_API_URL) &&
      !Boolean(error?.config?._loopbackRetry) &&
      String(error?.config?.baseURL || API_URL).includes("localhost")

    if (shouldRetryWithLoopback) {
      const retryConfig = error.config || {}
      retryConfig._loopbackRetry = true
      retryConfig.baseURL = LOOPBACK_API_URL
      return api(retryConfig)
    }

    const status = error?.response?.status
    const requestUrl = error?.config?.url || ""
    const isAccountRequest = String(requestUrl).startsWith("/account/")
    const isTenantAuthCall = /^\/tenant\/auth\/(signin|signup|google|refresh|logout)$/.test(requestUrl)
    const isUserAuthCall = /^\/account\/(signin|signup|auth\/otp\/send|auth\/otp\/verify|auth\/refresh|auth\/logout)$/.test(requestUrl)
    const hasRetried = Boolean(error?.config?._tenantRetry)

    const requestHeaders = (error?.config?.headers || {}) as Record<string, unknown>
    const authHeader = String(requestHeaders.Authorization || requestHeaders.authorization || "").trim()
    const requestBearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : ""
    const cookieUserToken = String(loadUserAuthTokenCookie() || "").trim()
    const cookieTenantToken = String(loadAuthTokenCookie() || "").trim()
    const requestUsesUserToken = Boolean(requestBearerToken && cookieUserToken && requestBearerToken === cookieUserToken)
    const requestUsesTenantToken = Boolean(requestBearerToken && cookieTenantToken && requestBearerToken === cookieTenantToken)

    if (status === 401 && !hasRetried) {
      if (isAccountRequest && !isUserAuthCall) {
        userRefreshRequestPromise = userRefreshRequestPromise || tryRefreshUserToken()
        const refreshedUserToken = await userRefreshRequestPromise
        userRefreshRequestPromise = null

        if (refreshedUserToken) {
          const retryConfig = error.config || {}
          retryConfig._tenantRetry = true
          retryConfig.headers = retryConfig.headers || {}
          delete retryConfig.headers["x-tenant-token"]
          retryConfig.headers.user = refreshedUserToken
          retryConfig.headers.Authorization = `Bearer ${refreshedUserToken}`
          return api(retryConfig)
        }
      }

      if (!isAccountRequest && !isTenantAuthCall) {
        if (requestUsesUserToken || (!requestUsesTenantToken && cookieUserToken && !cookieTenantToken)) {
          userRefreshRequestPromise = userRefreshRequestPromise || tryRefreshUserToken()
          const refreshedUserToken = await userRefreshRequestPromise
          userRefreshRequestPromise = null

          if (refreshedUserToken) {
            const retryConfig = error.config || {}
            retryConfig._tenantRetry = true
            retryConfig.headers = retryConfig.headers || {}
            delete retryConfig.headers["x-tenant-token"]
            retryConfig.headers.user = refreshedUserToken
            retryConfig.headers.Authorization = `Bearer ${refreshedUserToken}`
            return api(retryConfig)
          }
        }

        refreshRequestPromise = refreshRequestPromise || tryRefreshTenantToken()
        const refreshedToken = await refreshRequestPromise
        refreshRequestPromise = null

        if (refreshedToken) {
          const retryConfig = error.config || {}
          retryConfig._tenantRetry = true
          retryConfig.headers = retryConfig.headers || {}
          retryConfig.headers["x-tenant-token"] = refreshedToken
          retryConfig.headers.user = refreshedToken
          retryConfig.headers.Authorization = `Bearer ${refreshedToken}`
          return api(retryConfig)
        }
      }
    }

    if (status === 401) {
      clearClientSession()
    }

    const normalizedMessage = extractApiMessage(error)
    if (error?.response?.data && typeof error.response.data === "object") {
      error.response.data.message = normalizedMessage
      error.response.data.error = normalizedMessage
      if (typeof error.response.data.success === "undefined") {
        error.response.data.success = false
      }
    }
    error.message = normalizedMessage

    return Promise.reject(error)
  },
)

export default api
