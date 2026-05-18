"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDispatch } from "react-redux"
import { toast } from "sonner"

import { hydrateTenantSession } from "../../../../actions/auth"
import type { AppDispatch } from "../../../../redux/store"

const TENANT_SIGNIN_PATH = "/tenannt/signin"
const TENANT_SIGNUP_PATH = "/tenannt/signup"

const normalizePostAuthNext = (value?: string | null): string => {
  const fallback = "/"
  const candidate = String(value || "").trim()

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback
  }

  const blocked = ["/signin", "/signup", TENANT_SIGNIN_PATH, TENANT_SIGNUP_PATH, "/auth/callback"]
  if (blocked.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}?`))) {
    return fallback
  }

  return candidate
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    let mounted = true

    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const token = params.get("token") || undefined
        const refreshToken = params.get("refreshToken") || undefined
        const error = String(params.get("error") || "").trim()
        const rawNext = params.get("next")
        const next = normalizePostAuthNext(rawNext)
        const normalizedRawNext = String(rawNext || "").trim().toLowerCase()
        const isSignup = normalizedRawNext.startsWith("/signup") || normalizedRawNext.startsWith(TENANT_SIGNUP_PATH)

        if (error) {
          if (typeof window !== "undefined" && window.opener && window.opener !== window) {
            try {
              window.opener.postMessage({ type: "tenant-auth-error", error, next }, window.location.origin)
            } catch {
              // ignore
            }

            setTimeout(() => {
              try {
                window.close()
              } catch {
                // ignore
              }
            }, 150)

            return
          }

          toast.error(error)
          const redirectPath = isSignup ? TENANT_SIGNUP_PATH : TENANT_SIGNIN_PATH
          router.replace(redirectPath)
          return
        }

        // If this page was opened as a popup, postMessage the tokens
        // back to the opener and close the popup. Otherwise hydrate
        // the session in the main window as before.
        if (typeof window !== "undefined" && window.opener && window.opener !== window) {
          try {
            window.opener.postMessage({ type: "tenant-auth", token, refreshToken, next }, window.location.origin)
          } catch {
            // ignore
          }

          // Give the message a moment to dispatch, then close the popup.
          setTimeout(() => {
            try {
              window.close()
            } catch {
              // ignore
            }
          }, 150)

          return
        }

        const session = await dispatch(hydrateTenantSession({ token, refreshToken }))

        if (mounted && session) {
          toast.success(isSignup ? "Tenant account created successfully." : "Signed in successfully.")
          router.replace(next)
          return
        }

        toast.error("Unable to complete tenant authentication. Please try again.")
        router.replace(TENANT_SIGNIN_PATH)
      } catch {
        toast.error("Unable to complete tenant authentication. Please try again.")
        router.replace(TENANT_SIGNIN_PATH)
      }
    }

    void run()

    return () => {
      mounted = false
    }
  }, [dispatch, router])

  return <div className="p-6">Signing you in...</div>
}