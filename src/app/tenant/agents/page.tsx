"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch } from "react-redux"
import {
  fetchTenantAgentAssignment,
  fetchTenantAgents,
} from "../../../../actions/auth"
import type { AppDispatch } from "../../../../redux/store"
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

type TenantAgentCard = {
  id: string
  name: string
  description: string
  category: AgentCategory
  configured: boolean
  isActive: 0 | 1
  aiProvider: "openai" | "openrouter"
  aiModel: string
  managerCanRun: boolean
  userCanRun: boolean
  assignedUserIds: string[]
  workflowType?: string
  createdAt?: string | null
  updatedAt?: string | null
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

export default function TenantAgentsPage() {
  const dispatch = useDispatch<AppDispatch>()

  const [agents, setAgents] = useState<TenantAgentCard[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    setPageError(null)
    try {
      const rows = await (dispatch(fetchTenantAgents()) as Promise<Record<string, unknown>[]>)

      const uniqueRows = Array.from(
        rows
          .reduce((acc, row) => {
            const id = String(row.id || "")
            if (id && !acc.has(id)) acc.set(id, row)
            return acc
          }, new Map<string, Record<string, unknown>>())
          .values(),
      )

      const mapped: Array<TenantAgentCard | null> = await Promise.all(
        uniqueRows.map(async (row: Record<string, unknown>) => {
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
            aiProvider: assignment?.aiProvider === "openrouter" ? "openrouter" : "openai",
            aiModel: String((assignment?.aiModel as string | undefined) || "gpt-4.1-mini"),
            managerCanRun: Boolean((assignment?.managerCanRun as boolean | undefined) ?? true),
            userCanRun: Boolean((assignment?.userCanRun as boolean | undefined) ?? (assignment?.memberCanRun as boolean | undefined) ?? false),
            assignedUserIds: Array.isArray(assignment?.assignedUserIds)
              ? assignment.assignedUserIds.map((value: unknown) => String(value))
              : [],
            workflowType: row.workflowType ? String(row.workflowType) : undefined,
            createdAt: row.createdAt ? String(row.createdAt) : null,
            updatedAt: row.updatedAt ? String(row.updatedAt) : null,
          } as TenantAgentCard
        }),
      )

      setAgents(mapped.filter((value): value is TenantAgentCard => Boolean(value)))
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message || "Failed to load agents.")
          : "Failed to load agents."
      setAgents([])
      setPageError(message)
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
    <main className="">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
              <p className="mt-2 text-sm text-slate-600">
                Create and manage multi-domain agents with tenant-safe permissions.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/tenant/agents/create" prefetch={false}>
                <Button className="cursor-pointer">Add New</Button>
              </Link>
            </div>
          </div>
        </section>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Created Agents</CardTitle>
            <CardDescription>
              All tenant-created agents are listed below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pageError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {pageError}
              </div>
            ) : null}
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
                <div key={agent.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                    <Badge variant="outline" className={CATEGORY_STYLE[agent.category]}>{CATEGORY_LABEL[agent.category]}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">ID: {agent.id}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                      {agent.isActive === 1 ? "active" : "inactive"}
                    </Badge>
                    <Badge variant="outline">{agent.aiProvider}</Badge>
                    <Badge variant="outline" className="max-w-full truncate">{agent.aiModel}</Badge>
                  </div>
                  <div className="mt-3">
                    <Link href={`/tenant/agents/create?agentId=${encodeURIComponent(agent.id)}`} prefetch={false}>
                      {/* <Button size="sm" variant="outline" className="cursor-pointer">Edit Agent</Button> */}
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