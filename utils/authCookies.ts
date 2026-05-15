const ACCESS_TOKEN_KEY = "TENANT_ADMIN_ACCESS_TOKEN"
const REFRESH_TOKEN_KEY = "TENANT_ADMIN_REFRESH_TOKEN"
const SESSION_KEY = "TENANT_ADMIN_SESSION"
const TENANT_ADMIN_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const isBrowser = (): boolean => typeof window !== "undefined"

const writeCookie = (name: string, value: string): void => {
  if (!isBrowser()) return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${TENANT_ADMIN_TOKEN_MAX_AGE_SECONDS}; samesite=lax`
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

export const saveAuthTokenCookie = (token: string): void => writeCookie(ACCESS_TOKEN_KEY, token)
export const loadAuthTokenCookie = (): string | null => readCookie(ACCESS_TOKEN_KEY)
export const clearAuthTokenCookie = (): void => clearCookie(ACCESS_TOKEN_KEY)

export const saveRefreshTokenCookie = (token: string): void => writeCookie(REFRESH_TOKEN_KEY, token)
export const loadRefreshTokenCookie = (): string | null => readCookie(REFRESH_TOKEN_KEY)
export const clearRefreshTokenCookie = (): void => clearCookie(REFRESH_TOKEN_KEY)

export const saveAuthSessionCookie = (payload: unknown): void => writeCookie(SESSION_KEY, JSON.stringify(payload))
export const loadAuthSessionCookie = <T,>(): T | null => {
  const value = readCookie(SESSION_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}
export const clearAuthSessionCookie = (): void => clearCookie(SESSION_KEY)
