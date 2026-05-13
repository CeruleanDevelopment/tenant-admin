import type { TenantProfile } from "./Tenant"
import * as ReduxTypes from "../../constants/types"

export interface AuthUser {
  id: string
  email: string
  name: string
  role?: string
  tenantId?: string | null
}

export interface AuthSession {
  token: string
  refreshToken: string
  user: AuthUser
  tenant: TenantProfile | null
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: AuthUser
  tenant?: TenantProfile | null
  success: boolean
}

export interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  authenticated: boolean
  isAuthInitialized: boolean
}

export const AUTH_SESSION_SET = ReduxTypes.AUTH_SESSION_SET
export const AUTH_SESSION_CLEAR = ReduxTypes.AUTH_SESSION_CLEAR
export const AUTH_INITIALIZED_SET = ReduxTypes.AUTH_INITIALIZED_SET

export const initialAuthState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  authenticated: false,
  isAuthInitialized: false,
}

export const setAuthSession = (session: AuthSession) => ({
  type: AUTH_SESSION_SET,
  payload: session,
} as const)

export const clearAuthSession = () => ({
  type: AUTH_SESSION_CLEAR,
} as const)

export const setAuthInitialized = (isAuthInitialized: boolean) => ({
  type: AUTH_INITIALIZED_SET,
  payload: isAuthInitialized,
} as const)

export type AuthAction =
  | ReturnType<typeof setAuthSession>
  | ReturnType<typeof clearAuthSession>
  | ReturnType<typeof setAuthInitialized>

export function authReducer(
  state: AuthState = initialAuthState,
  action: AuthAction,
): AuthState {
  switch (action.type) {
    case AUTH_SESSION_SET:
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        user: action.payload.user,
        authenticated: true,
      }
    case AUTH_SESSION_CLEAR:
      return {
        ...initialAuthState,
        isAuthInitialized: state.isAuthInitialized,
      }
    case AUTH_INITIALIZED_SET:
      return {
        ...state,
        isAuthInitialized: action.payload,
      }
    default:
      return state
  }
}

export const selectAuthState = (state: { auth: AuthState }): AuthState => state.auth
export const selectAuthenticated = (state: { auth: AuthState }): boolean => state.auth.authenticated
export const selectAuthUser = (state: { auth: AuthState }): AuthUser | null => state.auth.user
export const selectIsAuthInitialized = (state: { auth: AuthState }): boolean => state.auth.isAuthInitialized
