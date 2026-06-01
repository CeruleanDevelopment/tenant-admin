"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import api from "../../../../service/api"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "../../../../redux/store"
import { fetchAssignedAgents, startUserGmailIntegration } from "../../../../actions/auth"
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectingAgentId, setConnectingAgentId] = useState<string | null>(null)

  const dispatch = useDispatch<AppDispatch>()
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

  const connectGoogle = async (agentId: string) => {
    setError(null)
    setConnectingAgentId(agentId)
    try {
      const agent = agents.find((a) => a.id === agentId)
      const startUrl = await dispatch(startUserGmailIntegration("/users/agents", agent?.tenantId))
      if (!startUrl) {
        setError("Failed to start Google login.")
        return
      }
      window.location.assign(startUrl)
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "Failed to start Google login")
          : "Failed to start Google login"
      setError(message)
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
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/users/signin" prefetch={false}>Switch User</Link>
          </Button>
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

                <Button className="w-full cursor-pointer" disabled={!agent.canRun || !agent.oauthReady}>
                  {agent.isActive === 0
                    ? "Agent Inactive"
                    : agent.canRun
                      ? (agent.oauthReady ? "Run Gmail Agent" : "Connect Google to Run")
                      : "No Run Permission"}
                </Button>

                {agent.canRun && !agent.oauthReady && agent.requiresGoogleLogin ? (
                  <Button
                    variant="outline"
                    className="w-full cursor-pointer"
                    disabled={connectingAgentId === agent.id}
                    onClick={() => void connectGoogle(agent.id)}
                  >
                    {connectingAgentId === agent.id ? "Opening Google Login..." : "Login with Google"}
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
