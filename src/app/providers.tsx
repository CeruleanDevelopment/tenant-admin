"use client"

import { type PropsWithChildren, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Provider, useDispatch, useSelector } from "react-redux"

import { bootstrapAuth } from "../../actions/auth"
import type { RootState } from "../../redux/reducers"
import type { AppDispatch } from "../../redux/store"
import { store } from "../../redux/store"
import { resolveSessionType } from "@/utils/access-control"

const TENANT_SIGNIN_PATH = "/tenant/signin"
const TENANT_SIGNUP_PATH = "/tenant/signup"
const USER_SIGNIN_PATH = "/users/signin"
const TENANT_DASHBOARD_PATH = "/tenant/agents"
const USER_DASHBOARD_PATH = "/users/dashboard"
const AUTH_PATHS = ["/signin", "/signup", TENANT_SIGNIN_PATH, TENANT_SIGNUP_PATH, USER_SIGNIN_PATH]
const PUBLIC_PATHS = new Set([...AUTH_PATHS, "/auth/callback"])
const AUTH_CALLBACK_PREFIXES = ["/auth/callback", "/tenant/auth/google/callback"]

const isUserAreaPath = (pathname: string): boolean => {
  if (!pathname.startsWith("/users")) return false
  return pathname !== "/users/signin"
}

const isTenantAreaPath = (pathname: string): boolean => {
  if (pathname === "/tenant" || pathname.startsWith("/tenant/")) return true
  return false
}

const getGuestSignInPath = (pathname: string): string => {
  if (isUserAreaPath(pathname)) return USER_SIGNIN_PATH
  if (isTenantAreaPath(pathname)) return TENANT_SIGNIN_PATH
  return TENANT_SIGNIN_PATH
}

function AuthGuard({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const router = useRouter() as { replace: (href: string) => void }
  const authenticated = useSelector((state: RootState) => state.auth.authenticated)
  const isAuthInitialized = useSelector((state: RootState) => state.auth.isAuthInitialized)
  const authUser = useSelector((state: RootState) => state.auth.user)
  const tenantId = useSelector((state: RootState) => String(state.tenant?.profile?.id || "").trim())
  useEffect(() => {
    if (!pathname || !isAuthInitialized) {
      return
    }

    const isPublicPath = PUBLIC_PATHS.has(pathname) || AUTH_CALLBACK_PREFIXES.some((prefix) => pathname.startsWith(prefix))

    if (authenticated && AUTH_PATHS.includes(pathname)) {
      const sessionType = resolveSessionType({
        authUserId: authUser?.id,
        tenantId,
        role: authUser?.role,
      })

      const redirectTarget = sessionType === "tenant" ? TENANT_DASHBOARD_PATH : USER_DASHBOARD_PATH
      if (pathname !== redirectTarget) {
        router.replace(redirectTarget)
      }
      return
    }

    if (!authenticated && !isPublicPath) {
      const signInPath = getGuestSignInPath(pathname)
      const redirectTarget = `${signInPath}?next=${encodeURIComponent(pathname)}`
      router.replace(redirectTarget)
      return
    }

  }, [authenticated, authUser?.id, authUser?.role, isAuthInitialized, pathname, router, tenantId])

  if (!isAuthInitialized) {
    return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>
  }

  if (!authenticated && pathname && !PUBLIC_PATHS.has(pathname) && !AUTH_CALLBACK_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return <div className="p-6 text-sm text-muted-foreground">Redirecting to sign in...</div>
  }

  return <>{children}</>
}

function Bootstrapper({ children }: PropsWithChildren) {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    void dispatch(bootstrapAuth())
  }, [dispatch])

  return <>{children}</>
}

export function Providers({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <Bootstrapper>
        <AuthGuard>{children}</AuthGuard>
      </Bootstrapper>
    </Provider>
  )
}
