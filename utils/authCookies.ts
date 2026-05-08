const ACCESS_TOKEN_KEY = "tenant_admin_access_token"
const REFRESH_TOKEN_KEY = "tenant_admin_refresh_token"
const SESSION_KEY = "tenant_admin_session"

const isBrowser = (): boolean => typeof window !== "undefined"

const writeCookie = (name: string, value: string): void => {
  if (!isBrowser()) return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
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
