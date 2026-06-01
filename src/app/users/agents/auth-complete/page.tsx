"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

const normalizeNext = (value?: string | null): string => {
  const fallback = "/users/agents"
  const candidate = String(value || "").trim()
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback
  }
  return candidate
}

export default function AgentAuthCompletePage() {
  const router = useRouter() as { replace: (href: string) => void }
  const searchParams = useSearchParams()

  useEffect(() => {
    const next = normalizeNext(searchParams.get("next"))
    const agentId = String(searchParams.get("agentId") || "").trim()
    const error = String(searchParams.get("error") || "").trim()
    const payload = error
      ? {
          type: "tenant-auth-error",
          error,
        }
      : {
          type: "tenant-agent-auth-complete",
          next,
          agentId,
        }

    if (typeof window !== "undefined" && window.opener && window.opener !== window) {
      try {
        window.opener.postMessage(payload, window.location.origin)
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        try {
          window.close()
        } catch {
          // ignore
        }
      }, 150)
      return
    }

    router.replace(next)
  }, [router, searchParams])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="rounded-2xl border bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        Finalizing Google connection...
      </div>
    </main>
  )
}
