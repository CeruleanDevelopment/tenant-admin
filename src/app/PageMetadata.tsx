"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { buildPageMeta } from "./page-meta"

// Layouts don't re-render on client navigation, so update the tab here.
export default function PageMetadata() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const { title, description } = buildPageMeta(pathname)
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute("content", description)
  }, [pathname])

  return null
}
