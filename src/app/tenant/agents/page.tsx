"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useDispatch } from "react-redux"
import {
  disconnectTenantGmailIntegration,
  fetchTenantAgentAssignment,
  fetchTenantAgents,
  fetchTenantGmailStatus,
  startTenantGmailIntegration,
} from "../../../../actions/auth"
import type { AppDispatch } from "../../../../redux/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type GmailStatus = {
  connected: boolean
  provider: string
  updatedAt?: string | null
}

type TenantAgentCard = {
  id: string
  name: string
  description: string
  isActive: 0 | 1
  authMode: "tenant_shared_connection" | "user_personal_connection"
  executionMode: "manual" | "scheduled"
  executionTime?: string | null
  timezone?: string
  aiProvider: "openai" | "openrouter"
  aiModel: string
  lookbackHours: number
  maxEmails: number
  managerCanRun: boolean
  memberCanRun: boolean
  assignedUserIds: string[]
}

export default function TenantAgentsPage() {
  const dispatch = useDispatch<AppDispatch>()

  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const [agents, setAgents] = useState<TenantAgentCard[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const status = await (dispatch(fetchTenantGmailStatus()) as Promise<GmailStatus>)
      setGmailStatus(status || { connected: false, provider: "google" })
    } catch {
      setGmailStatus({ connected: false, provider: "google" })
    } finally {
      setLoadingStatus(false)
    }
  }, [dispatch])

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    try {
      const rows = await (dispatch(fetchTenantAgents()) as Promise<Record<string, unknown>[]>)

      const mapped: Array<TenantAgentCard | null> = await Promise.all(
        rows.map(async (row: Record<string, unknown>) => {
          const id = String(row.id || "")
          if (!id) return null

          try {
            const assignment = await (dispatch(fetchTenantAgentAssignment(id)) as Promise<Record<string, unknown> | null>)
            if (!assignment || !assignment.configured) return null

            return {
              id,
              name: String(assignment.agentName || row.name || "Gmail Agent"),
              description: String(row.description || ""),
              isActive: Number(assignment.isActive ?? row.isActive ?? 1) === 0 ? 0 : 1,
              authMode:
                assignment.authMode === "user_personal_connection"
                  ? "user_personal_connection"
                  : "tenant_shared_connection",
              executionMode: assignment.executionMode === "scheduled" ? "scheduled" : "manual",
              executionTime: assignment.executionTime ? String(assignment.executionTime) : null,
              timezone: String(assignment.timezone || "UTC"),
              aiProvider: assignment.aiProvider === "openrouter" ? "openrouter" : "openai",
              aiModel: String(assignment.aiModel || "gpt-4.1-mini"),
              lookbackHours: Number(assignment.lookbackHours || 24),
              maxEmails: Number(assignment.maxEmails || 75),
              managerCanRun: Boolean(assignment.managerCanRun ?? true),
              memberCanRun: Boolean(assignment.memberCanRun ?? false),
              assignedUserIds: Array.isArray(assignment.assignedUserIds)
                ? assignment.assignedUserIds.map((value: unknown) => String(value))
                : [],
            } as TenantAgentCard
          } catch {
            return null
          }
        }),
      )

      setAgents(mapped.filter((value): value is TenantAgentCard => Boolean(value)))
    } finally {
      setLoadingAgents(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadStatus()
    void loadAgents()
  }, [loadAgents, loadStatus])

  const startGmailConnect = async () => {
    setError(null)
    try {
      const response = await (dispatch(startTenantGmailIntegration({ next: "/tenant/agents" })) as Promise<{ startUrl?: string }>)
      const startUrl = String(response?.startUrl || "")
      if (!startUrl) {
        setError("Unable to start Gmail OAuth flow.")
        return
      }
      window.location.assign(startUrl)
    } catch {
      setError("Failed to start Gmail OAuth")
    }
  }

  const disconnectGmail = async () => {
    setError(null)
    try {
      await (dispatch(disconnectTenantGmailIntegration()) as Promise<unknown>)
      setSuccess("Gmail integration disconnected.")
      await loadStatus()
    } catch {
      setError("Failed to disconnect Gmail")
    }
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tenant Agents</h1>
              <p className="mt-2 text-sm text-slate-600">
                Create and manage Gmail agents with tenant-safe permissions.
              </p>
            </div>
            <Link href="/tenant/agents/create" prefetch={false}>
              <Button className="cursor-pointer">Create New Agent</Button>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge className="border border-slate-300 bg-slate-50 text-slate-700">react flow builder</Badge>
            <Badge className="border border-slate-300 bg-slate-50 text-slate-700">tenant scoped</Badge>
            <Badge className="border border-slate-300 bg-slate-50 text-slate-700">permission aware</Badge>
          </div>
        </section>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Gmail Integration</CardTitle>
            <CardDescription>Tenant-level Google OAuth for Gmail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingStatus ? (
              <p className="text-sm text-muted-foreground">Checking integration status...</p>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p>Status: {gmailStatus?.connected ? "Connected" : "Not connected"}</p>
                <p>Provider: {gmailStatus?.provider || "google"}</p>
                <p>Updated: {gmailStatus?.updatedAt ? new Date(gmailStatus.updatedAt).toLocaleString() : "-"}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button className="cursor-pointer" onClick={startGmailConnect}>Connect Gmail</Button>
              <Button variant="outline" className="cursor-pointer" onClick={disconnectGmail} disabled={!gmailStatus?.connected}>
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Created Agents</CardTitle>
            <CardDescription>Configured agents and current assignment details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingAgents ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}
            {!loadingAgents && agents.length === 0 ? <p className="text-sm text-muted-foreground">No configured Gmail agents found.</p> : null}
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{agent.name}</p>
                  <div className="flex gap-1 text-xs">
                    <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                      {agent.isActive === 1 ? "active (1)" : "inactive (0)"}
                    </Badge>
                    <Badge variant="outline">{agent.aiProvider}</Badge>
                    <Badge variant="outline">{agent.aiModel}</Badge>
                    <Badge variant="outline">{agent.authMode === "user_personal_connection" ? "user google" : "tenant google"}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{agent.description || "No description"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    {agent.executionMode === "scheduled"
                      ? `schedule ${agent.executionTime || "--:--"} ${agent.timezone || "UTC"}`
                      : "manual run"}
                  </Badge>
                  <Badge variant="outline">lookback {agent.lookbackHours}h</Badge>
                  <Badge variant="outline">max {agent.maxEmails}</Badge>
                  <Badge variant="outline">manager run: {agent.managerCanRun ? "yes" : "no"}</Badge>
                  <Badge variant="outline">member run: {agent.memberCanRun ? "yes" : "no"}</Badge>
                  <Badge variant="outline">assigned users: {agent.assignedUserIds.length}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
