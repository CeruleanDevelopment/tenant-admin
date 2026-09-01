import { NextRequest, NextResponse } from "next/server"

type SessionCookiePayload = {
  user?: {
    id?: string
  }
  tenant?: {
    id?: string
  } | null
}

type SessionType = "tenant" | "user" | "guest"

const TENANT_SESSION_COOKIE = "TENANT_ADMIN_SESSION"
const USER_SESSION_COOKIE = "TENANT_ADMIN_USER_SESSION"

const TENANT_ONLY_PREFIXES = ["/tenant"]
const USER_ONLY_PREFIXES = ["/users"]
const PUBLIC_PATHS = ["/users/signin", "/tenant/signin", "/tenant/signup", "/auth/callback", "/signin", "/signup"]

const matchesPrefix = (pathname: string, prefix: string): boolean => {
  if (!prefix || prefix === "/") {
    return pathname === "/"
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

const parseSessionCookie = (raw: string | undefined): SessionCookiePayload | null => {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SessionCookiePayload
  } catch {
    return null
  }
}

const resolveSessionType = (request: NextRequest): SessionType => {
  const tenantSessionRaw = request.cookies.get(TENANT_SESSION_COOKIE)?.value
  const userSessionRaw = request.cookies.get(USER_SESSION_COOKIE)?.value

  const tenantSession = parseSessionCookie(tenantSessionRaw)
  const userSession = parseSessionCookie(userSessionRaw)

  const hasTenantSession = Boolean(String(tenantSession?.tenant?.id || "").trim())
  const hasUserSession = Boolean(String(userSession?.user?.id || "").trim())

  if (hasTenantSession) {
    return "tenant"
  }

  if (hasUserSession) {
    return "user"
  }

  return "guest"
}

const buildRedirectUrl = (request: NextRequest, targetPath: string): URL => {
  const url = request.nextUrl.clone()
  url.pathname = targetPath
  url.search = ""
  return url
}

const getUnauthorizedRedirect = (pathname: string, sessionType: SessionType): string | null => {
  const isPublicPath = PUBLIC_PATHS.some((prefix) => matchesPrefix(pathname, prefix))
  if (isPublicPath) {
    return null
  }

  const isTenantOnly = TENANT_ONLY_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  const isUserOnly = USER_ONLY_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))

  if (isUserOnly && sessionType !== "user") {
    return "/users/signin"
  }

  if (isTenantOnly && sessionType !== "tenant") {
    return "/tenant/signin"
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionType = resolveSessionType(request)
  const redirectPath = getUnauthorizedRedirect(pathname, sessionType)

  if (redirectPath && redirectPath !== pathname) {
    return NextResponse.redirect(buildRedirectUrl(request, redirectPath))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/users/:path*", "/tenant/:path*"],
}
