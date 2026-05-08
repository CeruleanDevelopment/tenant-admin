"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { NotificationDropdown } from "@/components/notification-dropdown"
import { AppLauncherDropdown } from "@/components/appLauncher-dropdown"
import { LanguageDropdown } from "@/components/language-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
import { GlobalSearch } from "@/components/global-search"
import HeaderUser from "@/components/header-user"
import { useSelector, useDispatch } from "react-redux"
import type { RootState } from "../../../redux/reducers"
import { signOutTenant } from "../../../actions/auth"
import type { AppDispatch } from "../../../redux/store"
import { useRouter } from "next/navigation"

import Footer from "@/components/layout/Footer"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { cn } from "@/lib/utils"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const isRoot = pathname === "/"
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
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
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    {!isRoot && (
                      <>
                        <BreadcrumbSeparator className="hidden md:block" />
                        <BreadcrumbItem>
                          <BreadcrumbPage>eCommerce</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

                <div className="ml-auto">
                    <div className="flex items-center gap-1">
                        <GlobalSearch />
                        <ThemeToggle />
                        <LanguageDropdown />
                        <AppLauncherDropdown />
                        <div className="relative">
                            <NotificationDropdown />
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                                5
                            </span>
                        </div>
                        <div className="ml-2">
                          {/* Header user profile (top-right) */}
                          <HeaderUser
                            user={userForHeader}
                            onLogout={async () => {
                              await dispatch(signOutTenant())
                              router.replace("/signin")
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