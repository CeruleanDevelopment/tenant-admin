"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export type NavItem = {
  title: string
  url?: string
  href?: string
  icon?: ReactNode
  items?: NavItem[]
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const rawPathname = pathname ?? "/"
  const effectivePathname = rawPathname === "/" ? "/dashboard/analytics" : rawPathname

  // active route check
  const isActive = (url?: string) => {
    if (!url) return false
    return effectivePathname === url || effectivePathname.startsWith(`${url}/`)
  }

  // check if parent should be open
  const isParentActive = (item: NavItem): boolean => {
    if (!item.items) return false

    return item.items.some((sub) => {
      if (sub.items) {
        return sub.items.some((child) => typeof child.url === "string" && child.url && effectivePathname.startsWith(child.url))
      }
      return typeof sub.url === "string" && sub.url && effectivePathname.startsWith(sub.url)
    })
  }

  const resolveHref = (i: NavItem) => {
    return i?.href ?? i?.url
  }

  const hrefOrFallback = (i: NavItem): string => {
    const href = resolveHref(i)
    return typeof href === "string" && href.trim() ? href : "#"
  }

  return (
    <SidebarMenu>
      {items.map((item) => {
        const parentActive = isParentActive(item)

        return item.items ? (
          <Collapsible
            key={`${item.title}-${effectivePathname}`}
            defaultOpen={parentActive}
          >
            <SidebarMenuItem>

              {/* Parent */}
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className="group "
                  isActive={parentActive}
                >
                  {item.icon}
                  <span>{item.title}</span>

                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarMenuSub>

                  {item.items.map((subItem) => {
                    const subActive = isActive(subItem.url)

                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        {subItem.items ? (
                          <Collapsible
                            defaultOpen={subItem.items.some((child) => typeof child.url === "string" && child.url && effectivePathname.startsWith(child.url))}
                          >
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton className="group">
                                {subItem.title}
                                <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <SidebarMenuSub>

                                {subItem.items.map((child) => (
                                  <SidebarMenuButton
                                    key={child.title}
                                    asChild
                                    isActive={isActive(child.url)}
                                  >
                                    <Link href={hrefOrFallback(child)} prefetch={false}>
                                      {child.title}
                                    </Link>
                                  </SidebarMenuButton>
                                ))}

                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <SidebarMenuButton
                            asChild
                            isActive={subActive}
                          >
                            <Link href={hrefOrFallback(subItem)} prefetch={false}>
                              {subItem.title}
                            </Link>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuSubItem>
                    )
                  })}

                </SidebarMenuSub>
              </CollapsibleContent>

            </SidebarMenuItem>
          </Collapsible>
        ) : (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={isActive(item.url)}
            >
              <Link href={hrefOrFallback(item)} prefetch={false}>
                {item.icon}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}