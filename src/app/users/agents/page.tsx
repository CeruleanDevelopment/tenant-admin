"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "../../../../redux/store"
import { fetchAssignedAgents, startUserGmailIntegration, startTenantGmailIntegration } from "../../../../actions/auth"
import api from "../../../../service/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AssignedAgent = {
  id: string
  tenantId?: string
  name: string
  description: string
  status: string
  isActive: 0 | 1
  type: string
  aiProvider: string
  aiModel: string
  authMode: "tenant_shared_connection" | "user_personal_connection"
  requiresGoogleLogin: boolean
  oauthReady: boolean
  canRun: boolean
  lookbackHours: number
  maxEmails: number
}

export default function UserAssignedAgentsPage() {
  const [agents, setAgents] = useState<AssignedAgent[]>([])
  const [gmailHealth, setGmailHealth] = useState<{ tenantConnected?: boolean; tenantExpiresAt?: string | null; userConnected?: boolean; userExpiresAt?: string | null; error?: string | null }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectingAgentId, setConnectingAgentId] = useState<string | null>(null)

  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter() as { push: (href: string) => void }
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)
  // Load assigned agents on mount using the thunk via `dispatch`.
  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Dispatch the thunk and await its result. Cast to `any` so TypeScript
        // doesn't block the thunk-return value (redux-thunk typing).
        const rows = (await dispatch(fetchAssignedAgents() as any)) as unknown[]
        if (!mounted) return
        setAgents(Array.isArray(rows) ? (rows as AssignedAgent[]) : [])
      } catch (err: unknown) {
        if (!mounted) return
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: string }).message || "Failed to load assigned agents")
            : "Failed to load assigned agents"
        setError(message)
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [dispatch])

  // Gmail health probe (tenant + user). Polls periodically.
  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchHealth = async () => {
      setHealthLoading(true)
      setHealthError(null)
      try {
        const results: any = {}

        // Try tenant-level health (best-effort). This endpoint may require platform/tenant auth.
        try {
          const resp = await api.get("/integrations/gmail/health")
          if (mounted) {
            results.tenantConnected = Boolean(resp?.data?.connected)
            results.tenantExpiresAt = resp?.data?.expiresAt || null
          }
        } catch (err) {
          // ignore tenant probe errors, capture reason if available
          if (mounted) {
            results.tenantConnected = false
            try {
              const msg = err && typeof err === "object" && "response" in err ? String((err as any).response?.data?.message || (err as any).response?.data?.error || "") : String(err || "")
              results.tenantError = msg || null
            } catch {
              results.tenantError = null
            }
          }
        }

        // User-level health (requires user auth) — best-effort
        try {
          const resp2 = await api.get("/integrations/gmail/health/user")
          if (mounted) {
            results.userConnected = Boolean(resp2?.data?.connected)
            results.userExpiresAt = resp2?.data?.expiresAt || null
          }
        } catch (err) {
          if (mounted) {
            results.userConnected = false
            try {
              const msg2 = err && typeof err === "object" && "response" in err ? String((err as any).response?.data?.message || (err as any).response?.data?.error || "") : String(err || "")
              results.userError = msg2 || null
            } catch {
              results.userError = null
            }
          }
        }

        if (mounted) setGmailHealth(results)
      } catch (err) {
        if (mounted) setHealthError(String(err || "Failed to fetch Gmail health"))
      } finally {
        if (mounted) setHealthLoading(false)
      }
    }

    void fetchHealth()
    timer = setInterval(() => void fetchHealth(), 30 * 1000)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
    }
  }, [dispatch])

  const connectGoogle = async (agentId: string) => {
    setError(null)
    setConnectingAgentId(agentId)
    try {
      const agent = agents.find((a) => a.id === agentId)
      const chatHref = `/users/agents/chat?agentId=${encodeURIComponent(agentId)}`
      const browserWindow = typeof window !== "undefined" ? window : null
      if (!browserWindow) {
        setError("Google login is only available in the browser.")
        setConnectingAgentId(null)
        return
      }

      const popup = browserWindow.open("about:blank", "tenant-google", "width=600,height=700")
      if (!popup) {
        const startUrl = await dispatch(startUserGmailIntegration(chatHref, agent?.tenantId))
        if (!startUrl) {
          setError("Failed to start Google login.")
          setConnectingAgentId(null)
          return
        }
        window.location.assign(startUrl)
        setConnectingAgentId(null)
        return
      }

      popup.document.write('<p style="font-family:sans-serif;padding:24px">Opening Google login...</p>')
      popup.document.close()

      const startUrl = await dispatch(startUserGmailIntegration(chatHref, agent?.tenantId))
      if (!startUrl) {
        setError("Failed to start Google login.")
        popup.close()
        setConnectingAgentId(null)
        return
      }

      popup.location.href = startUrl

      let poll: ReturnType<typeof setInterval> | null = null

      const cleanup = () => {
        browserWindow.removeEventListener("message", handleMessage)
        if (poll) {
          clearInterval(poll)
          poll = null
        }
      }

      const refreshAgents = async (): Promise<AssignedAgent[]> => {
        try {
          const rows = (await dispatch(fetchAssignedAgents() as any)) as unknown[]
          const nextAgents = Array.isArray(rows) ? (rows as AssignedAgent[]) : []
          setAgents(nextAgents)
          return nextAgents
        } catch (refreshError: unknown) {
          const message =
            typeof refreshError === "object" && refreshError !== null && "message" in refreshError
              ? String((refreshError as { message?: string }).message || "Google login succeeded, but the page could not refresh.")
              : "Google login succeeded, but the page could not refresh."
          setError(message)
          return []
        }
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== browserWindow.location.origin) return

        const payload = event.data || {}
        if (payload?.type === "tenant-agent-auth-complete") {
          cleanup()
          popup.close()
          await refreshAgents()
          const nextHref = String(payload.next || chatHref || "/users/agents/chat")
          window.location.assign(nextHref)
          setConnectingAgentId(null)
          return
        }

        if (payload?.type === "tenant-auth-error") {
          cleanup()
          popup.close()
          const refreshed = await refreshAgents()
          const refreshedAgent = refreshed.find((item) => item.id === agentId)
          if (refreshedAgent?.oauthReady) {
            window.location.assign(chatHref)
            setConnectingAgentId(null)
            return
          }
          setError(String(payload.error || "Google login failed."))
          setConnectingAgentId(null)
          return
        }

        if (payload?.type === "tenant-auth") {
          cleanup()
          popup.close()
          await refreshAgents()
          window.location.assign(chatHref)
          setConnectingAgentId(null)
        }
      }

      browserWindow.addEventListener("message", handleMessage)

      poll = setInterval(() => {
        if (popup.closed) {
          cleanup()
          setConnectingAgentId(null)
          if (!error) {
            setError("Google login popup was closed before completion.")
          }
        }
      }, 500)
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "Failed to start Google login")
          : "Failed to start Google login"
      setError(message)
      setConnectingAgentId(null)
    }
  }

  const reconnectGoogle = async (agent: AssignedAgent) => {
    if (agent.requiresGoogleLogin) {
      await connectGoogle(agent.id)
      return
    }

    setError(null)
    setConnectingAgentId(agent.id)
    try {
      const response = await dispatch(startTenantGmailIntegration({ next: "/users/agents" }) as any)
      const startUrl = String(response?.startUrl || "").trim()
      if (!startUrl) {
        setError("Unable to start tenant Gmail reconnect. Ask your tenant admin to reconnect Google from tenant settings.")
        return
      }
      window.location.assign(startUrl)
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "Failed to start tenant Gmail reconnect.")
          : "Failed to start tenant Gmail reconnect."
      setError(`${message} Ask your tenant admin if you do not have permission.`)
    } finally {
      setConnectingAgentId(null)
    }
  }
  return (
    <main className="p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Assigned Agents</h1>
            <p className="text-sm text-muted-foreground">
              These are tenant-assigned agents. Gmail requirement depends on agent auth mode.
            </p>
          </div>
          {/* Gmail Health Banner */}
          {/* <div className="w-full md:w-auto">
            {healthLoading ? (
              <p className="text-sm text-muted-foreground">Checking Gmail connectivity...</p>
            ) : (
              <div className="text-right">
                {!gmailHealth.tenantConnected ? (
                  <div className="rounded-md border p-2 bg-yellow-50 text-sm">
                    <div>Tenant Gmail: Not connected</div>
                    <div className="mt-1 flex gap-2 justify-end">
                      <button
                        className="rounded bg-primary px-2 py-1 text-white cursor-pointer"
                        onClick={async () => {
                          try {
                            const resp = await dispatch(startTenantGmailIntegration({ next: "/users/agents" }) as any)
                            const startUrl = String(resp?.startUrl || "")
                            if (startUrl) window.location.assign(startUrl)
                          } catch (err: unknown) {
                            setError(typeof err === "object" && err !== null && "message" in err ? String((err as { message?: string }).message || "") : "Failed to start tenant Google connect")
                          }
                        }}
                      >
                        Reconnect (Tenant)
                      </button>
                      <Link href="/tenant/agents" prefetch={false} className="underline text-sm">Tenant Settings</Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border p-2 bg-green-50 text-sm">Tenant Gmail: Connected {gmailHealth.tenantExpiresAt ? `— expires ${gmailHealth.tenantExpiresAt}` : null}</div>
                )}

                {!gmailHealth.userConnected ? (
                  <div className="mt-2 rounded-md border p-2 bg-yellow-50 text-sm">
                    <div>Your personal Gmail: Not connected</div>
                    <div className="mt-1 flex gap-2 justify-end">
                      <button
                        className="rounded border px-2 py-1 cursor-pointer"
                        onClick={async () => {
                          try {
                            // open same-tab connect for personal Gmail
                            const resp = await dispatch(startUserGmailIntegration("/users/agents") as any)
                            const startUrl = String(resp || "")
                            if (startUrl) window.location.assign(startUrl)
                          } catch (err: unknown) {
                            setError(typeof err === "object" && err !== null && "message" in err ? String((err as { message?: string }).message || "") : "Failed to start Google connect")
                          }
                        }}
                      >
                        Connect Personal Gmail
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 rounded-md border p-2 bg-green-50 text-sm">Your Gmail: Connected {gmailHealth.userExpiresAt ? `— expires ${gmailHealth.userExpiresAt}` : null}</div>
                )}
              </div>
            )}
          </div> */}
          {/* <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/users/signin" prefetch={false}>Switch User</Link>
          </Button> */}
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading assigned agents...</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {!loading && !error && agents.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No agents assigned yet. Ask your tenant admin to assign a Gmail agent.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id} className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <CardDescription>{agent.description || "Gmail analysis agent"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                    {agent.isActive === 1 ? "active (1)" : "inactive (0)"}
                  </Badge>
                  <Badge variant="outline">{agent.aiProvider}</Badge>
                  <Badge variant="outline">{agent.aiModel}</Badge>
                  <Badge variant="outline">lookback {agent.lookbackHours}h</Badge>
                  <Badge variant="outline">max {agent.maxEmails}</Badge>
                </div>

                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p>
                    Google login: {agent.requiresGoogleLogin ? "Personal Google login required" : "Tenant shared connection"}
                  </p>
                  <p>
                    OAuth ready: {agent.oauthReady ? "Yes" : "No"}
                  </p>
                  <p>
                    Permission: {agent.canRun ? "Run allowed" : "View only"}
                  </p>
                </div>

                <Button
                  type="button"
                  className="w-full cursor-pointer"
                  disabled={!agent.canRun || connectingAgentId === agent.id}
                  onClick={() => {
                    if (agent.isActive === 0) return
                    if (!agent.canRun) return

                    // If OAuth is ready, open the chat. Otherwise, start Google connect if required.
                    if (agent.oauthReady) {
                      router.push(`/users/agents/chat?agentId=${encodeURIComponent(agent.id)}`)
                      return
                    }

                    if (agent.requiresGoogleLogin) {
                      void connectGoogle(agent.id)
                    }
                  }}
                >
                  {agent.isActive === 0
                    ? "Agent Inactive"
                    : agent.canRun
                      ? (agent.oauthReady ? "Run Gmail Agent" : "Connect Google to Run")
                      : "No Run Permission"}
                </Button>

                {agent.canRun && !agent.oauthReady && agent.requiresGoogleLogin ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full cursor-pointer"
                    disabled={connectingAgentId === agent.id}
                    onClick={() => void connectGoogle(agent.id)}
                  >
                    {connectingAgentId === agent.id ? "Opening Google Login..." : "Login with Google"}
                  </Button>
                ) : null}

                {agent.canRun ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full cursor-pointer"
                    disabled={connectingAgentId === agent.id}
                    onClick={() => void reconnectGoogle(agent)}
                  >
                    {connectingAgentId === agent.id
                      ? "Opening Google Login..."
                      : agent.requiresGoogleLogin
                        ? "Reconnect Google"
                        : "Reconnect Tenant Google"}
                  </Button>
                ) : null}

                {agent.canRun && agent.oauthReady ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full cursor-pointer"
                    onClick={() => router.push(`/users/agents/chat?agentId=${encodeURIComponent(agent.id)}`)}
                  >
                    Open Gmail Chat
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
