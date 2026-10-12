export type SessionType = "tenant" | "user" | "guest"

type RouteAccessConfig = {
  tenantOnlyPrefixes: string[]
  userOnlyPrefixes: string[]
  publicPaths: string[]
  defaultRedirectBySession: Record<SessionType, string>
}

export const routeAccessConfig: RouteAccessConfig = {
  // Add new tenant-only pages here (future-proof)
  tenantOnlyPrefixes: ["/tenant"],

  // Add new user-only pages here (future-proof)
  userOnlyPrefixes: ["/users"],

  // Shared public auth pages (no folder guard)
  publicPaths: ["/signin", "/signup", "/tenant/signin", "/tenant/signup", "/auth/callback", "/users/signin"],

  defaultRedirectBySession: {
    tenant: "/tenant/agents",
    user: "/users/dashboard",
    guest: "/tenant/signin",
  },
}

const matchPrefix = (pathname: string, prefix: string): boolean => {
  if (!prefix || prefix === "/") {
    return pathname === "/"
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export const resolveSessionType = (input: {
  authUserId?: string | null
  tenantId?: string | null
  role?: string | null
}): SessionType => {
  const isTenantSession = Boolean(String(input.tenantId || "").trim())
  const isUserSession = Boolean(String(input.authUserId || "").trim()) && !isTenantSession

  if (isTenantSession) return "tenant"
  if (isUserSession) return "user"
  return "guest"
}

export const canAccessPath = (pathname: string, sessionType: SessionType): boolean => {
  const normalizedPath = String(pathname || "/")

  if (routeAccessConfig.publicPaths.some((p) => matchPrefix(normalizedPath, p))) {
    return true
  }

  const isTenantOnly = routeAccessConfig.tenantOnlyPrefixes.some((p) => matchPrefix(normalizedPath, p))
  const isUserOnly = routeAccessConfig.userOnlyPrefixes.some((p) => matchPrefix(normalizedPath, p))

  // More specific user-only routes should override broader tenant prefixes (e.g. /users/agents).
  if (isUserOnly) {
    return sessionType === "user"
  }

  if (isTenantOnly && sessionType !== "tenant") {
    return false
  }

  return true
}

export const getUnauthorizedRedirectPath = (
  pathname: string,
  sessionType: SessionType,
): string | null => {
  const normalizedPath = String(pathname || "/")

  if (canAccessPath(normalizedPath, sessionType)) {
    return null
  }

  const isTenantOnly = routeAccessConfig.tenantOnlyPrefixes.some((p) => matchPrefix(normalizedPath, p))
  const isUserOnly = routeAccessConfig.userOnlyPrefixes.some((p) => matchPrefix(normalizedPath, p))

  if (isUserOnly) {
    return "/users/signin"
  }

  if (isTenantOnly) {
    return "/tenant/signin"
  }

  if (sessionType === "guest") {
    if (isUserOnly) {
      return "/users/signin"
    }
    if (isTenantOnly) {
      return "/tenant/signin"
    }
  }

  return routeAccessConfig.defaultRedirectBySession[sessionType] || "/"
}
