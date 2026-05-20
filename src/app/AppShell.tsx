"use client"

import React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSelector } from "react-redux"
import AdminLayout from "@/components/layout/admin-layout"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { RootState } from "../../redux/reducers"
import { getUnauthorizedRedirectPath, resolveSessionType } from "@/utils/access-control"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const router = useRouter()
  const authUser = useSelector((state: RootState) => state.auth.user)
  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)
  const sessionType = React.useMemo(
    () => resolveSessionType({ authUserId: authUser?.id, tenantId: tenantProfile?.id }),
    [authUser?.id, tenantProfile?.id],
  )

  const PUBLIC_PATHS = new Set(["/signin", "/signup", "/tenannt/signin", "/tenannt/signup", "/auth/callback"]) // no header/sidebar
  const AUTH_CALLBACK_PREFIXES = ["/auth/callback", "/tenant/auth/google/callback"]

  // Do not wrap pages that already use no-layout-pages or layout-pages (they have their own layouts)
  if (
    PUBLIC_PATHS.has(pathname) ||
    AUTH_CALLBACK_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/no-layout-pages") ||
    pathname.startsWith("/layout-pages")
  ) {
    return <>{children}</>
  }

  React.useEffect(() => {
    const redirectPath = getUnauthorizedRedirectPath(pathname, sessionType)
    if (redirectPath && redirectPath !== pathname) {
      router.replace(redirectPath)
    }
  }, [pathname, router, sessionType])

  return (
    <TooltipProvider delayDuration={0}>
      <AdminLayout>{children}</AdminLayout>
    </TooltipProvider>
  )
}
