export type SessionType = "tenant" | "user" | "guest"

type RouteAccessConfig = {
  tenantOnlyPrefixes: string[]
  userOnlyPrefixes: string[]
  defaultRedirectBySession: Record<SessionType, string>
}

export const routeAccessConfig: RouteAccessConfig = {
  // Add new tenant-only pages here (future-proof)
  tenantOnlyPrefixes: ["/users"],

  // Add new user-only pages here (future-proof)
  userOnlyPrefixes: ["/agents"],

  defaultRedirectBySession: {
    tenant: "/users",
    user: "/agents",
    guest: "/tenannt/signin",
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
}): SessionType => {
  const isTenantSession = Boolean(String(input.tenantId || "").trim())
  const isUserSession = Boolean(String(input.authUserId || "").trim()) && !isTenantSession

  if (isTenantSession) return "tenant"
  if (isUserSession) return "user"
  return "guest"
}

export const canAccessPath = (pathname: string, sessionType: SessionType): boolean => {
  const normalizedPath = String(pathname || "/")

  const isTenantOnly = routeAccessConfig.tenantOnlyPrefixes.some((p) => matchPrefix(normalizedPath, p))
  const isUserOnly = routeAccessConfig.userOnlyPrefixes.some((p) => matchPrefix(normalizedPath, p))

  if (isTenantOnly && sessionType !== "tenant") {
    return false
  }

  if (isUserOnly && sessionType !== "user") {
    return false
  }

  return true
}

export const getUnauthorizedRedirectPath = (
  pathname: string,
  sessionType: SessionType,
): string | null => {
  if (canAccessPath(pathname, sessionType)) {
    return null
  }

  return routeAccessConfig.defaultRedirectBySession[sessionType] || "/"
}
