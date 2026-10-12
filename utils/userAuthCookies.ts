const USER_ACCESS_TOKEN_KEY = "TENANT_ADMIN_USER_ACCESS_TOKEN"
const USER_REFRESH_TOKEN_KEY = "TENANT_ADMIN_USER_REFRESH_TOKEN"
const USER_SESSION_KEY = "TENANT_ADMIN_USER_SESSION"
const USER_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const isBrowser = (): boolean => typeof window !== "undefined"

const writeCookie = (name: string, value: string): void => {
  if (!isBrowser()) return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${USER_TOKEN_MAX_AGE_SECONDS}; samesite=lax`
}

const readCookie = (name: string): string | null => {
  if (!isBrowser()) return null
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null
}

const clearCookie = (name: string): void => {
  if (!isBrowser()) return
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
}

export const saveUserAuthTokenCookie = (token: string): void => writeCookie(USER_ACCESS_TOKEN_KEY, token)
export const loadUserAuthTokenCookie = (): string | null => readCookie(USER_ACCESS_TOKEN_KEY)
export const clearUserAuthTokenCookie = (): void => clearCookie(USER_ACCESS_TOKEN_KEY)

export const saveUserRefreshTokenCookie = (token: string): void => writeCookie(USER_REFRESH_TOKEN_KEY, token)
export const loadUserRefreshTokenCookie = (): string | null => readCookie(USER_REFRESH_TOKEN_KEY)
export const clearUserRefreshTokenCookie = (): void => clearCookie(USER_REFRESH_TOKEN_KEY)

export const saveUserAuthSessionCookie = (payload: unknown): void => writeCookie(USER_SESSION_KEY, JSON.stringify(payload))
export const loadUserAuthSessionCookie = <T,>(): T | null => {
  const value = readCookie(USER_SESSION_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}
export const clearUserAuthSessionCookie = (): void => clearCookie(USER_SESSION_KEY)
