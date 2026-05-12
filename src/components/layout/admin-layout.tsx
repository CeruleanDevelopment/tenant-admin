"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

import { AppSidebar } from "../app-sidebar"
import { NotificationDropdown } from "../notification-dropdown"
import { AppLauncherDropdown } from "../appLauncher-dropdown"
import { LanguageDropdown } from "../language-dropdown"
import { ThemeToggle } from "../theme-toggle"
import { GlobalSearch } from "../global-search"
import HeaderUser from "../header-user"
import { useSelector, useDispatch } from "react-redux"
import type { RootState } from "../../../redux/reducers"
import { signOutTenant } from "../../../actions/auth"
import type { AppDispatch } from "../../../redux/store"

import Footer from "./Footer"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb"

import { Separator } from "../ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar"

import { cn } from "../../lib/utils"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const isRoot = pathname === "/"
  const dispatch = useDispatch<AppDispatch>()
  const reduxUser = useSelector((state: RootState) => state.auth.user)
  const userForHeader = {
    name: reduxUser?.name || "User",
    email: reduxUser?.email || "user@example.com",
    avatar: "",
  }

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])


  return (
     <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header
                className={cn(
                    "px-6 sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 transition-all duration-200 border-b",
                    scrolled
                    ? "bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60 shadow-md"
                    : "bg-transparent"
                )}
              >
              <div className="flex items-center gap-3">
                <SidebarTrigger
                  size="icon"
                  className="-ml-1 rounded-full h-9 w-9 [&_svg]:size-5! hover:bg-muted/60 transition-colors"
                />
                <Separator
                  orientation="vertical"
                  className="data-[orientation=vertical]:h-16"
                />

                <Breadcrumb>
                  <BreadcrumbList>
                    {/** Build dynamic crumbs from pathname */}
                    {(() => {
                      const parts = String(pathname || "").split("/").filter(Boolean)
                      const crumbs: { href: string; label: string }[] = [{ href: "/", label: "Dashboard" }]

                      const singular = (s: string) => (s.endsWith("s") ? s.slice(0, -1) : s)
                      const capitalize = (s: string) => s.replace(/(^|\s)\S/g, (t) => t.toUpperCase())

                      let acc = ""
                      parts.forEach((segment, idx) => {
                        acc += `/${segment}`
                        let label = ""
                        const prev = parts[idx - 1]

                        if (segment === "add") {
                          label = prev ? `Add ${capitalize(singular(prev))}` : "Add"
                        } else if (segment === "view") {
                          label = prev ? `View ${capitalize(prev)}` : "View"
                        } else if (segment === "edit") {
                          label = prev ? `Edit ${capitalize(singular(prev))}` : "Edit"
                        } else if (/^\d+$/.test(segment)) {
                          label = `#${segment}`
                        } else {
                          label = capitalize(segment.replace(/-|_/g, " "))
                        }

                        crumbs.push({ href: acc, label })
                      })

                      {
                        const nodes: React.ReactNode[] = []
                        crumbs.forEach((c, i) => {
                          const last = i === crumbs.length - 1
                          if (i > 0) {
                            nodes.push(
                              <BreadcrumbSeparator key={`sep-${c.href}`} className="hidden md:block" />,
                            )
                          }

                          nodes.push(
                            <BreadcrumbItem key={c.href} className={i === 0 ? "hidden md:block" : undefined}>
                              {last ? (
                                <BreadcrumbPage>{c.label}</BreadcrumbPage>
                              ) : (
                                <BreadcrumbLink asChild>
                                  <Link href={c.href}>{c.label}</Link>
                                </BreadcrumbLink>
                              )}
                            </BreadcrumbItem>
                          )
                        })

                        return nodes
                      }
                    })()}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

                <div className="ml-auto">
                    <div className="flex items-center gap-1">
                        <GlobalSearch />
                        {/* <ThemeToggle />
                        <LanguageDropdown />
                        <AppLauncherDropdown />
                        <div className="relative">
                            <NotificationDropdown />
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                                5
                            </span>
                        </div> */}
                        <div className="ml-2">
                          {/* Header user profile (top-right) */}
                          <HeaderUser
                            user={userForHeader}
                            onLogout={async () => {
                              await dispatch(signOutTenant())
                            }}
                          />
                        </div>
                    </div>
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-6 p-6">
                {children}
              </div>
              <Footer />
            </SidebarInset>
          </SidebarProvider>
  )
}