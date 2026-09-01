"use client"

import React from "react"
import { usePathname } from "next/navigation"
import AdminLayout from "@/components/layout/admin-layout"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"

  const PUBLIC_PATHS = new Set(["/signin", "/signup", "/users/signin", "/tenant/signin", "/tenant/signup", "/auth/callback"]) // no header/sidebar
  const AUTH_CALLBACK_PREFIXES = ["/auth/callback", "/tenant/auth/google/callback"]
  const FULL_SCREEN_PATHS = new Set(["/tenant/agents/create"])

  // Do not wrap pages that already use no-layout-pages or layout-pages (they have their own layouts)
  if (
    PUBLIC_PATHS.has(pathname) ||
    FULL_SCREEN_PATHS.has(pathname) ||
    AUTH_CALLBACK_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/no-layout-pages") ||
    pathname.startsWith("/layout-pages")
  ) {
    return <>{children}</>
  }

  return (
    <TooltipProvider delayDuration={0}>
      <AdminLayout>{children}</AdminLayout>
    </TooltipProvider>
  )
}
