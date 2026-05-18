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
})

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

  const token = stateOrCookieToken || explicitHeaderToken

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
  // eslint-disable-next-line no-console
  console.log(`[tenant-admin] calling API: ${method} ${url}`)

  return config
})

api.interceptors.response.use(
  (response: any) => response,
  async (error: any) => {
    const status = error?.response?.status
    const requestUrl = error?.config?.url || ""
    const isAccountRequest = String(requestUrl).startsWith("/account/")
    const isTenantAuthCall = /^\/tenant\/auth\/(signin|signup|google|refresh|logout)$/.test(requestUrl)
    const isUserAuthCall = /^\/account\/(signin|signup|auth\/otp\/send|auth\/otp\/verify|auth\/refresh|auth\/logout)$/.test(requestUrl)
    const hasRetried = Boolean(error?.config?._tenantRetry)

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

    return Promise.reject(error)
  },
)

export default api
