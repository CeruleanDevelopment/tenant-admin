"use client"

import { type PropsWithChildren, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Provider, useDispatch, useSelector } from "react-redux"

import { bootstrapAuth } from "../../actions/auth"
import type { RootState } from "../../redux/reducers"
import type { AppDispatch } from "../../redux/store"
import { store } from "../../redux/store"

const PUBLIC_PATHS = new Set(["/signin", "/signup", "/auth/callback"])
const AUTH_CALLBACK_PREFIXES = ["/auth/callback", "/tenant/auth/google/callback"]

function AuthGuard({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const router = useRouter()
  const authenticated = useSelector((state: RootState) => state.auth.authenticated)
  const isAuthInitialized = useSelector((state: RootState) => state.auth.isAuthInitialized)

  useEffect(() => {
    if (!pathname || !isAuthInitialized) {
      return
    }

    const isPublicPath = PUBLIC_PATHS.has(pathname) || AUTH_CALLBACK_PREFIXES.some((prefix) => pathname.startsWith(prefix))

    if (!authenticated && !isPublicPath) {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`)
      return
    }

    if (authenticated && (pathname === "/signin" || pathname === "/signup")) {
      router.replace("/")
    }
  }, [authenticated, isAuthInitialized, pathname, router])

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
