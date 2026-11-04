import api from "../service/api"
import type { AnyAction } from "redux"
import type { ThunkAction } from "redux-thunk"

import {
  clearAuthSession,
  setAuthInitialized,
  setAuthSession,
  type AuthSession,
} from "../redux/reducers/Home"
import { clearTenantProfile } from "../redux/reducers/Tenant"
import type { RootState } from "../redux/reducers"
import { API_URL, tenantAdminConfig } from "../config/config"
import {
  clearAuthSessionCookie,
  clearAuthTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/authCookies"
import {
  clearUserAuthSessionCookie,
  clearUserAuthTokenCookie,
  clearUserRefreshTokenCookie,
  loadUserAuthSessionCookie,
  loadUserAuthTokenCookie,
  loadUserRefreshTokenCookie,
  saveUserAuthSessionCookie,
  saveUserAuthTokenCookie,
  saveUserRefreshTokenCookie,
} from "../utils/userAuthCookies"

type UserOtpSendResponse = {
  success: true
  sessionId: string
  expiresAt: string
  resendCooldownSeconds: number
}

type UserOtpVerifyInput = {
  sessionId: string
  code: string
}

type UserAuthApiResponse = {
  success: true
  token: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role?: string
    tenantId?: string | null
  }
}

type UserProfileResponse = {
  success: true
  user: {
    id: string
    email: string
    name: string
    role?: string
    tenantId?: string | null
  }
}

const userApi = api

const clearUserSessionCookies = (): void => {
  clearUserAuthTokenCookie()
  clearUserRefreshTokenCookie()
  clearUserAuthSessionCookie()
}

const persistUserSession = (session: AuthSession | null): void => {
  if (!session) {
    clearUserSessionCookies()
    return
  }

  saveUserAuthTokenCookie(session.token)
  saveUserRefreshTokenCookie(session.refreshToken)
  saveUserAuthSessionCookie(session)
}

const applyUserSession = (dispatch: any, payload: UserAuthApiResponse): AuthSession => {
  const session: AuthSession = {
    token: String(payload.token || "").trim(),
    refreshToken: String(payload.refreshToken || "").trim(),
    user: payload.user,
    tenant: null,
  }

  // Keep user and tenant sessions mutually exclusive in browser cookies.
  clearAuthTokenCookie()
  clearRefreshTokenCookie()
  clearAuthSessionCookie()

  persistUserSession(session)
  dispatch(setAuthSession(session))
  dispatch(clearTenantProfile())
  return session
}

const clearReduxSession = (dispatch: any): void => {
  dispatch(clearAuthSession())
  dispatch(clearTenantProfile())
}

export const requestUserOtp =
  (input: { email: string }): ThunkAction<Promise<UserOtpSendResponse>, RootState, unknown, AnyAction> =>
  async () => {
    const response = await userApi.post("/account/auth/otp/send", {
      email: String(input.email || "").trim().toLowerCase(),
    })
    return response.data as UserOtpSendResponse
  }

export const verifyUserOtp =
  (input: UserOtpVerifyInput): ThunkAction<Promise<AuthSession>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const response = await userApi.post("/account/auth/otp/verify", {
      sessionId: input.sessionId,
      code: input.code,
    })

    const payload = response.data as UserAuthApiResponse
    const session = applyUserSession(dispatch, payload)
    dispatch(setAuthInitialized(true))
    return session
  }

export const refreshUserSession =
  (): ThunkAction<Promise<AuthSession | null>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const refreshToken = String(loadUserRefreshTokenCookie() || "").trim()
    if (!refreshToken) {
      return null
    }

    try {
      const response = await userApi.post("/account/auth/refresh", { refreshToken })
      const payload = response.data as UserAuthApiResponse
      return applyUserSession(dispatch, payload)
    } catch {
      clearUserSessionCookies()
      return null
    }
  }

export const hydrateUserSession =
  (input?: { token?: string; refreshToken?: string }): ThunkAction<Promise<AuthSession | null>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const token = String(input?.token || loadUserAuthTokenCookie() || "").trim()
    const refreshToken = String(input?.refreshToken || loadUserRefreshTokenCookie() || "").trim()

    if (!token || !refreshToken) {
      return null
    }

    try {
      const response = await userApi.get("/account/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const profile = response.data as UserProfileResponse
      const payload: UserAuthApiResponse = {
        success: true,
        token,
        refreshToken,
        user: profile.user,
      }

      return applyUserSession(dispatch, payload)
    } catch {
      return null
    }
  }

export const USER_AUTH_POPUP_NAME = "cerulean-user-auth-popup"
export const USER_AUTH_MESSAGE_SOURCE = "cerulean-user-auth"

export type UserAuthPopupMessage = {
  source: typeof USER_AUTH_MESSAGE_SOURCE
  token?: string
  refreshToken?: string
  error?: string
}

export const startUserProviderSignIn =
  (provider: "microsoft" | "google", next: string): ThunkAction<Promise<AuthSession>, RootState, unknown, AnyAction> =>
  (dispatch) =>
    new Promise<AuthSession>((resolve, reject) => {
      const url =
        `${API_URL.replace(/\/$/, "")}/account/auth/${provider}/start` +
        `?next=${encodeURIComponent(next)}&origin=${encodeURIComponent(window.location.origin)}`

      const width = 500
      const height = 650
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
      const popup = window.open(
        url,
        USER_AUTH_POPUP_NAME,
        `width=${width},height=${height},left=${left},top=${top},popup=yes`,
      )

      if (!popup) {
        reject(new Error("Popup was blocked. Allow popups for this site and try again."))
        return
      }

      let settled = false
      const cleanup = () => {
        window.removeEventListener("message", onMessage)
        window.clearInterval(closedTimer)
      }
      const finish = (action: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        action()
      }

      const onMessage = (event: MessageEvent<UserAuthPopupMessage>) => {
        if (event.origin !== window.location.origin || event.source !== popup) return
        const data = event.data
        if (!data || data.source !== USER_AUTH_MESSAGE_SOURCE) return

        if (data.error || !data.token || !data.refreshToken) {
          finish(() => reject(new Error(data.error || "Unable to complete sign-in.")))
          return
        }

        const { token, refreshToken } = data
        finish(() => {
          dispatch(hydrateUserSession({ token, refreshToken }))
            .then((session) => (session ? resolve(session) : reject(new Error("Unable to complete sign-in."))))
            .catch(reject)
        })
      }

      const closedTimer = window.setInterval(() => {
        if (popup.closed) {
          finish(() => reject(new Error("Sign-in window was closed.")))
        }
      }, 500)

      window.addEventListener("message", onMessage)
    })

export const bootstrapUserAuth =
  (): ThunkAction<Promise<boolean>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const cached = loadUserAuthSessionCookie<AuthSession>()
    if (cached?.token && cached?.refreshToken && cached?.user) {
      dispatch(setAuthSession(cached))
      dispatch(clearTenantProfile())
      return true
    }

    const token = loadUserAuthTokenCookie()
    const refreshToken = loadUserRefreshTokenCookie()

    if (!token || !refreshToken) {
      return false
    }

    const hydrated = await dispatch(hydrateUserSession({ token, refreshToken }))
    if (hydrated) {
      return true
    }

    const refreshed = await dispatch(refreshUserSession())
    if (refreshed) {
      return true
    }

    clearUserSessionCookies()
    clearReduxSession(dispatch)
    return false
  }

export const signOutUser =
  (): ThunkAction<Promise<void>, RootState, unknown, AnyAction> =>
  async (dispatch) => {
    const refreshToken = String(loadUserRefreshTokenCookie() || "").trim()
    try {
      await userApi.post("/account/auth/logout", { refreshToken })
    } catch {
      // best effort
    }

    clearUserSessionCookies()
    clearReduxSession(dispatch)
    dispatch(setAuthInitialized(true))
  }
