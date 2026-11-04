"use client"

import { useEffect } from "react"
import { useDispatch } from "react-redux"

import { hydrateUserSession, USER_AUTH_MESSAGE_SOURCE, USER_AUTH_POPUP_NAME } from "../../../../../actions/userAuth"
import type { AppDispatch } from "../../../../../redux/store"

const DEFAULT_NEXT = "/users/dashboard"

const normalizeNext = (value: string): string => {
  const candidate = String(value || "").trim()
  if (!candidate.startsWith("/users") || candidate.startsWith("//") || candidate.startsWith("/users/signin")) {
    return DEFAULT_NEXT
  }
  return candidate
}

const redirectToSignIn = (message: string): void => {
  window.location.replace(`/users/signin?error=${encodeURIComponent(message)}`)
}

export default function UserAuthCallbackPage() {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const token = params.get("token") || ""
    const refreshToken = params.get("refreshToken") || ""
    const next = normalizeNext(params.get("next") || "")

    // Remove tokens from the address bar and history.
    window.history.replaceState(null, "", window.location.pathname)

    if (window.name === USER_AUTH_POPUP_NAME && window.opener) {
      window.opener.postMessage(
        {
          source: USER_AUTH_MESSAGE_SOURCE,
          token,
          refreshToken,
          error: token && refreshToken ? undefined : "Sign-in failed. Please try again.",
        },
        window.location.origin,
      )
      window.close()
      return
    }

    if (!token || !refreshToken) {
      redirectToSignIn("Microsoft sign-in failed. Please try again.")
      return
    }

    Promise.resolve(dispatch(hydrateUserSession({ token, refreshToken })))
      .then(() => window.location.replace(next))
      .catch(() => redirectToSignIn("Unable to complete Microsoft sign-in."))
  }, [dispatch])

  return (
    <div className="bg-muted min-h-svh w-full flex items-center justify-center text-sm text-muted-foreground">
      Signing you in...
    </div>
  )
}
