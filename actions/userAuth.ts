import axios from "axios"
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
import { tenantAdminConfig } from "../config/config"
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

const userApi = axios.create({
  baseURL: tenantAdminConfig.apiUrl,
  withCredentials: true,
})

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
