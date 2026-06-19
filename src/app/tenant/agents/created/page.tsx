"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch } from "react-redux"
import {
  fetchTenantAgentAssignment,
  fetchTenantAgents,
} from "../../../../../actions/auth"
import type { AppDispatch } from "../../../../../redux/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AgentCategory = "gmail" | "crm" | "support" | "calendar" | "knowledge" | "automation" | "general"

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  gmail: "Gmail",
  crm: "CRM",
  support: "Support",
  calendar: "Calendar",
  knowledge: "Knowledge",
  automation: "Automation",
  general: "General",
}

const CATEGORY_STYLE: Record<AgentCategory, string> = {
  gmail: "border-sky-300 bg-sky-50 text-sky-700",
  crm: "border-indigo-300 bg-indigo-50 text-indigo-700",
  support: "border-violet-300 bg-violet-50 text-violet-700",
  calendar: "border-cyan-300 bg-cyan-50 text-cyan-700",
  knowledge: "border-emerald-300 bg-emerald-50 text-emerald-700",
  automation: "border-orange-300 bg-orange-50 text-orange-700",
  general: "border-slate-300 bg-slate-50 text-slate-700",
}

type TenantAgentCard = {
  id: string
  name: string
  description: string
  category: AgentCategory
  configured: boolean
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
  workflowType?: string
  createdAt?: string | null
}

const detectAgentCategory = (input: {
  name: string
  description: string
  systemPrompt?: string
  allowedCollections?: string[]
}): AgentCategory => {
  const blob = [
    input.name,
    input.description,
    input.systemPrompt || "",
    ...(input.allowedCollections || []),
  ]
    .join(" ")
    .toLowerCase()

  if (/gmail|email|inbox|thread/.test(blob)) return "gmail"
  if (/crm|salesforce|hubspot|lead|opportunity|pipeline|contact/.test(blob)) return "crm"
  if (/ticket|support|helpdesk|zendesk|service desk/.test(blob)) return "support"
  if (/calendar|meeting|schedule|appointment/.test(blob)) return "calendar"
  if (/knowledge|document|rag|embedding|search/.test(blob)) return "knowledge"
  if (/workflow|automation|trigger|approval/.test(blob)) return "automation"
  return "general"
}

export default function TenantCreatedAgentsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const [agents, setAgents] = useState<TenantAgentCard[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    try {
      const rows = await (dispatch(fetchTenantAgents()) as Promise<Record<string, unknown>[]>)

      const mapped: Array<TenantAgentCard | null> = await Promise.all(
        rows.map(async (row: Record<string, unknown>) => {
          const id = String(row.id || "")
          if (!id) return null

          let assignment: Record<string, unknown> | null = null
          try {
            assignment = await (dispatch(fetchTenantAgentAssignment(id)) as Promise<Record<string, unknown> | null>)
          } catch {
            assignment = null
          }

          return {
            id,
            name: String((assignment?.agentName as string) || row.name || "Untitled Agent"),
            description: String(row.description || ""),
            category: detectAgentCategory({
              name: String((assignment?.agentName as string) || row.name || "Untitled Agent"),
              description: String(row.description || ""),
              systemPrompt: String(row.systemPrompt || ""),
              allowedCollections: Array.isArray(row.allowedCollections)
                ? row.allowedCollections.map((value: unknown) => String(value))
                : [],
            }),
            configured: Boolean(assignment?.configured),
            isActive: Number((assignment?.isActive as number | undefined) ?? row.isActive ?? 1) === 0 ? 0 : 1,
            authMode:
              assignment?.authMode === "user_personal_connection"
                ? "user_personal_connection"
                : "tenant_shared_connection",
            executionMode: assignment?.executionMode === "scheduled" ? "scheduled" : "manual",
            executionTime: assignment?.executionTime ? String(assignment.executionTime) : null,
            timezone: String((assignment?.timezone as string | undefined) || "UTC"),
            aiProvider: assignment?.aiProvider === "openrouter" ? "openrouter" : "openai",
            aiModel: String((assignment?.aiModel as string | undefined) || "gpt-4.1-mini"),
            lookbackHours: Number((assignment?.lookbackHours as number | undefined) || 24),
            maxEmails: Number((assignment?.maxEmails as number | undefined) || 75),
            managerCanRun: Boolean((assignment?.managerCanRun as boolean | undefined) ?? true),
            memberCanRun: Boolean((assignment?.memberCanRun as boolean | undefined) ?? false),
            assignedUserIds: Array.isArray(assignment?.assignedUserIds)
              ? assignment.assignedUserIds.map((value: unknown) => String(value))
              : [],
            workflowType: row.workflowType ? String(row.workflowType) : undefined,
            createdAt: row.createdAt ? String(row.createdAt) : null,
          } as TenantAgentCard
        }),
      )

      setAgents(mapped.filter((value): value is TenantAgentCard => Boolean(value)))
    } finally {
      setLoadingAgents(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  const categoryCounts = useMemo(() => {
    return agents.reduce<Record<AgentCategory, number>>(
      (acc, agent) => {
        acc[agent.category] += 1
        return acc
      },
      {
        gmail: 0,
        crm: 0,
        support: 0,
        calendar: 0,
        knowledge: 0,
        automation: 0,
        general: 0,
      },
    )
  }, [agents])

  return (
    <main className="p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Created Agents</h1>
              <p className="mt-2 text-sm text-slate-600">All already-created tenant agents in one dedicated page.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/tenant/agents" prefetch={false}>
                <Button variant="outline" className="cursor-pointer">Back to Catalog</Button>
              </Link>
              <Link href="/tenant/agents/create" prefetch={false}>
                <Button className="cursor-pointer">Create New Agent</Button>
              </Link>
            </div>
          </div>
        </section>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Tenant Agent Inventory</CardTitle>
            <CardDescription>Configured and unconfigured agents with runtime details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingAgents ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}
            {!loadingAgents && agents.length === 0 ? <p className="text-sm text-muted-foreground">No agents found.</p> : null}

            {!loadingAgents && agents.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-700 space-y-2">
                <p>
                  Showing <span className="font-semibold text-slate-900">{agents.length}</span> agents. Configured: <span className="font-semibold text-slate-900">{agents.filter((agent) => agent.configured).length}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(categoryCounts) as AgentCategory[])
                    .filter((category) => categoryCounts[category] > 0)
                    .map((category) => (
                      <Badge key={category} variant="outline" className={CATEGORY_STYLE[category]}>
                        {CATEGORY_LABEL[category]}: {categoryCounts[category]}
                      </Badge>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="group rounded-2xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-amber-50/40 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="line-clamp-1 text-base font-semibold text-slate-900">{agent.name}</p>
                      <p className="mt-1 text-xs text-slate-600">ID: {agent.id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={CATEGORY_STYLE[agent.category]}>{CATEGORY_LABEL[agent.category]}</Badge>
                      <Badge
                        variant="outline"
                        className={agent.configured ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}
                      >
                        {agent.configured ? "configured" : "not configured"}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-3 min-h-10 text-xs text-slate-600">{agent.description || "No description provided for this agent."}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                      {agent.isActive === 1 ? "active" : "inactive"}
                    </Badge>
                    <Badge variant="outline">{agent.aiProvider}</Badge>
                    <Badge variant="outline" className="max-w-full truncate">{agent.aiModel}</Badge>
                    <Badge variant="outline">{agent.authMode === "user_personal_connection" ? "user google" : "tenant google"}</Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <div className="rounded-md border border-slate-200 bg-white px-2 py-1">{agent.executionMode === "scheduled" ? `Schedule: ${agent.executionTime || "--:--"}` : "Manual run"}</div>
                    <div className="rounded-md border border-slate-200 bg-white px-2 py-1">TZ: {agent.timezone || "UTC"}</div>
                    <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Lookback: {agent.lookbackHours}h</div>
                    <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Max emails: {agent.maxEmails}</div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">manager run: {agent.managerCanRun ? "yes" : "no"}</Badge>
                    <Badge variant="outline">member run: {agent.memberCanRun ? "yes" : "no"}</Badge>
                    <Badge variant="outline">assigned users: {agent.assignedUserIds.length}</Badge>
                    {agent.workflowType ? <Badge variant="outline">workflow: {agent.workflowType}</Badge> : null}
                    <Badge variant="outline">
                      created: {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "-"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link href={`/tenant/agents/create?agentId=${encodeURIComponent(agent.id)}`} prefetch={false}>
                      <Button size="sm" className="cursor-pointer">Edit Agent</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
