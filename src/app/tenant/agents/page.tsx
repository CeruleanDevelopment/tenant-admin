"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch, useSelector } from "react-redux"
import {
  fetchTenantAgentBlueprints,
  fetchTenantAgentAssignment,
  fetchTenantAgents,
  type TenantAgentBlueprint,
} from "../../../../actions/auth"
import type { RootState } from "../../../../redux/reducers"
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

type GmailStatus = {
  connected: boolean
  provider: string
  updatedAt?: string | null
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
  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)

  const [agents, setAgents] = useState<TenantAgentCard[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [blueprints, setBlueprints] = useState<TenantAgentBlueprint[]>([])
  const [loadingBlueprints, setLoadingBlueprints] = useState(false)

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
            updatedAt: row.updatedAt ? String(row.updatedAt) : null,
          } as TenantAgentCard
        }),
      )

      setAgents(mapped.filter((value): value is TenantAgentCard => Boolean(value)))
    } finally {
      setLoadingAgents(false)
    }
  }, [dispatch])

  const loadBlueprints = useCallback(async () => {
    setLoadingBlueprints(true)
    try {
      const rows = await (dispatch(fetchTenantAgentBlueprints()) as Promise<TenantAgentBlueprint[]>)
      setBlueprints(Array.isArray(rows) ? rows : [])
    } catch {
      setBlueprints([])
    } finally {
      setLoadingBlueprints(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadAgents()
    void loadBlueprints()
  }, [loadAgents, loadBlueprints])

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

  const normalizeCategory = (raw: string): AgentCategory => {
    const value = String(raw || "").toLowerCase()
    if (value === "gmail") return "gmail"
    if (value === "crm") return "crm"
    if (value === "support") return "support"
    if (value === "calendar") return "calendar"
    if (value === "knowledge") return "knowledge"
    if (value === "automation") return "automation"
    return "general"
  }

  const blueprintRows = useMemo(
    () =>
      blueprints.map((item) => {
        const category = normalizeCategory(item.category)
        return {
          ...item,
          category,
          createdCount: categoryCounts[category],
        }
      }),
    [blueprints, categoryCounts],
  )

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
              {/* <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Badge className="border border-slate-300 bg-slate-50 text-slate-700">
                  Tenant created: {tenantProfile?.createdAt ? new Date(tenantProfile.createdAt).toLocaleDateString() : "-"}
                </Badge>
                <Badge className="border border-slate-300 bg-slate-50 text-slate-700">
                  Tenant: {tenantProfile?.companyName || "Unknown"}
                </Badge>
              </div> */}
            </div>
            <div className="flex gap-3">
              <Link href="/tenant/agents/create" prefetch={false}>
                <Button className="cursor-pointer">Create New Agent</Button>
              </Link>
              <Link href="/tenant/agents/created" prefetch={false}>
                <Button variant="outline" className="cursor-pointer">View Created Agents</Button>
              </Link>
            </div>
          </div>
        </section>

        <Card className="rounded-2xl border-dashed">
          <CardHeader>
            <CardTitle>Agent Catalog</CardTitle>
            <CardDescription>
              Click create to open configuration for that exact agent type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBlueprints ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
            {!loadingBlueprints && blueprintRows.length === 0 ? <p className="text-sm text-muted-foreground">No blueprint records found.</p> : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {blueprintRows.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <Badge variant="outline" className={CATEGORY_STYLE[item.category]}>{CATEGORY_LABEL[item.category]}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{item.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">Use case: {item.exampleUse}</p>
                  {/* <div className="mt-2 text-xs text-slate-600">
                    Existing agents in this category: <span className="font-semibold text-slate-900">{item.createdCount}</span>
                  </div> */}
                  <div className="mt-3">
                    <Link href={`/tenant/agents/create?blueprint=${encodeURIComponent(String(item.id))}`} prefetch={false}>
                      <Button size="sm" variant="default" className="cursor-pointer bg-primary">Create {item.title}</Button>
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