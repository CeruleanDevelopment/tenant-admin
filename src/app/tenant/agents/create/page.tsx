"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import {
  createTenantAgent,
  fetchTenantAgentBlueprints,
  fetchTenantUsers,
  type TenantAgentBlueprint,
  upsertTenantAgentAssignment,
} from "../../../../../actions/auth"
import type { AppDispatch } from "../../../../../redux/store"
import type { RootState } from "../../../../../redux/reducers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "reactflow"
import "reactflow/dist/style.css"

type TenantUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  isActive?: boolean | null
}

type AiProvider = "" | "openai" | "openrouter"
type AuthMode = "" | "tenant_shared_connection" | "user_personal_connection"
type ExecutionMode = "" | "manual" | "scheduled"

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AI_MODEL_OPTIONS: Record<"openai" | "openrouter", string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  openrouter: ["openrouter/auto", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-flash"],
}

const TIMEZONE_OPTIONS = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"]

const formatUserName = (user: TenantUser): string => {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return full || String(user.email || "User")
}

const buildFlowGraph = (input: {
  name: string
  aiProvider: AiProvider
  aiModel: string
  authMode: AuthMode
  executionMode: ExecutionMode
  executionTime: string
  timezone: string
  lookbackHours: string
  maxEmails: string
  assignedCount: number
  hasPrompt: boolean
  managerCanRun: boolean
  memberCanRun: boolean
}): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = []

  const pushNode = (id: string, label: string) => {
    nodes.push({
      id,
      type: nodes.length === 0 ? "input" : "default",
      position: { x: 80 + nodes.length * 240, y: 110 },
      data: { label },
    })
  }

  const name = input.name.trim()
  if (!name) {
    return { nodes: [], edges: [] }
  }

  pushNode("agent", `Agent: ${name}`)

  if (input.aiProvider && input.aiModel) {
    pushNode("ai", `Model: ${input.aiProvider} / ${input.aiModel}`)
  } else {
    return { nodes, edges: [] }
  }

  if (input.authMode) {
    const authLabel = input.authMode === "user_personal_connection" ? "Auth: user personal Google" : "Auth: tenant shared Google"
    pushNode("auth", authLabel)
  } else {
    return {
      nodes,
      edges: nodes.slice(1).map((node, index) => ({
        id: `e${index}`,
        source: nodes[index].id,
        target: node.id,
        animated: true,
      })),
    }
  }

  if (input.executionMode) {
    const scheduleLabel =
      input.executionMode === "scheduled"
        ? `Run: scheduled ${input.executionTime || "--:--"} ${input.timezone || "UTC"}`
        : "Run: manual"
    pushNode("schedule", scheduleLabel)
  }

  const lookback = Number(input.lookbackHours)
  const max = Number(input.maxEmails)
  if (Number.isFinite(lookback) && lookback > 0 && Number.isFinite(max) && max > 0) {
    pushNode("window", `Window: ${lookback}h, max ${max} emails`)
  }

  if (input.hasPrompt) {
    pushNode("prompt", "Instruction prompt configured")
  }

  if (input.assignedCount > 0) {
    pushNode("assign", `Assigned users: ${input.assignedCount}`)
  }

  pushNode(
    "perm",
    `Permissions: manager ${input.managerCanRun ? "yes" : "no"}, member ${input.memberCanRun ? "yes" : "no"}`,
  )

  pushNode("output", "Output: agent saved + assignments persisted")
  nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], type: "output" }

  const edges: Edge[] = nodes.slice(1).map((node, index) => ({
    id: `e${index + 1}`,
    source: nodes[index].id,
    target: node.id,
    animated: true,
  }))

  return { nodes, edges }
}

const flowSummaryText = (nodes: Node[], edges: Edge[]): string => {
  if (!nodes.length) {
    return "No nodes yet. Start by entering Agent name to begin step-by-step flow creation."
  }

  const byId = new Map(
    nodes.map((node) => [node.id, String((node.data as { label?: string } | undefined)?.label || node.id)]),
  )

  return edges.map((edge) => `${byId.get(edge.source) || edge.source} -> ${byId.get(edge.target) || edge.target}`).join("\n")
}

export default function TenantAgentCreatePage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()

  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)
  const tenantId = String(tenantProfile?.id || "")
  const blueprintId = String(searchParams.get("blueprint") || "").trim()
  const [blueprints, setBlueprints] = useState<TenantAgentBlueprint[]>([])
  const [loadingBlueprints, setLoadingBlueprints] = useState(false)
  const selectedBlueprint = useMemo(
    () => blueprints.find((item) => String(item.id || "") === blueprintId),
    [blueprints, blueprintId],
  )
  const [appliedBlueprintId, setAppliedBlueprintId] = useState<string>("")

  const [users, setUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [aiProvider, setAiProvider] = useState<AiProvider>("")
  const [aiModel, setAiModel] = useState("")
  const [authMode, setAuthMode] = useState<AuthMode>("")
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("")
  const [executionTime, setExecutionTime] = useState("09:00")
  const [timezone, setTimezone] = useState("UTC")
  const [lookbackHours, setLookbackHours] = useState("24")
  const [maxEmails, setMaxEmails] = useState("75")
  const [managerCanRun, setManagerCanRun] = useState(true)
  const [memberCanRun, setMemberCanRun] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState("")

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const normalizeCategory = (value: string): AgentCategory => {
    const key = String(value || "").toLowerCase()
    if (key === "gmail") return "gmail"
    if (key === "crm") return "crm"
    if (key === "support") return "support"
    if (key === "calendar") return "calendar"
    if (key === "knowledge") return "knowledge"
    if (key === "automation") return "automation"
    return "general"
  }

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
    void loadBlueprints()
  }, [loadBlueprints])

  useEffect(() => {
    if (!selectedBlueprint) return
    if (appliedBlueprintId === String(selectedBlueprint.id)) return

    const defaults = selectedBlueprint.defaults || {}
    setName(String(defaults.name || ""))
    setDescription(String(defaults.description || ""))
    setSystemPrompt(String(defaults.systemPrompt || ""))
    setAiProvider(defaults.aiProvider === "openrouter" ? "openrouter" : defaults.aiProvider === "openai" ? "openai" : "")
    setAiModel(String(defaults.aiModel || ""))
    setAuthMode(
      defaults.authMode === "user_personal_connection"
        ? "user_personal_connection"
        : defaults.authMode === "tenant_shared_connection"
          ? "tenant_shared_connection"
          : "",
    )
    setExecutionMode(defaults.executionMode === "scheduled" ? "scheduled" : defaults.executionMode === "manual" ? "manual" : "")
    setExecutionTime(String(defaults.executionTime || "09:00"))
    setTimezone(String(defaults.timezone || "UTC"))
    setLookbackHours(String(defaults.lookbackHours ?? 24))
    setMaxEmails(String(defaults.maxEmails ?? 75))
    setManagerCanRun(Boolean(defaults.managerCanRun ?? true))
    setMemberCanRun(Boolean(defaults.memberCanRun ?? false))
    setIsActive(Boolean(defaults.isActive ?? true))
    setAppliedBlueprintId(String(selectedBlueprint.id))
  }, [selectedBlueprint, appliedBlueprintId])

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const result = await (dispatch(fetchTenantUsers()) as Promise<unknown>)
      setUsers(Array.isArray(result) ? (result as TenantUser[]) : [])
    } finally {
      setLoadingUsers(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const activeUsers = useMemo(
    () => users.filter((user) => Boolean(user.isActive ?? true)),
    [users],
  )

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return activeUsers

    return activeUsers.filter((user) => {
      const nameText = formatUserName(user).toLowerCase()
      const emailText = String(user.email || "").toLowerCase()
      return nameText.includes(q) || emailText.includes(q)
    })
  }, [activeUsers, userSearch])

  const generatedGraph = useMemo(
    () =>
      buildFlowGraph({
        name,
        aiProvider,
        aiModel,
        authMode,
        executionMode,
        executionTime,
        timezone,
        lookbackHours,
        maxEmails,
        assignedCount: assignedUserIds.length,
        hasPrompt: Boolean(systemPrompt.trim()),
        managerCanRun,
        memberCanRun,
      }),
    [
      name,
      aiProvider,
      aiModel,
      authMode,
      executionMode,
      executionTime,
      timezone,
      lookbackHours,
      maxEmails,
      assignedUserIds.length,
      systemPrompt,
      managerCanRun,
      memberCanRun,
    ],
  )

  useEffect(() => {
    setNodes(generatedGraph.nodes)
    setEdges(generatedGraph.edges)
  }, [generatedGraph, setNodes, setEdges])

  const onProviderChange = (value: string) => {
    const provider = value === "openrouter" ? "openrouter" : value === "openai" ? "openai" : ""
    setAiProvider(provider)
    setAiModel(provider ? AI_MODEL_OPTIONS[provider][0] : "")
  }

  const toggleAssigned = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const toggleSelectAllFiltered = () => {
    const ids = filteredUsers.map((user) => String(user.id))
    const allSelected = ids.length > 0 && ids.every((id) => assignedUserIds.includes(id))

    if (allSelected) {
      setAssignedUserIds((prev) => prev.filter((id) => !ids.includes(id)))
      return
    }

    setAssignedUserIds((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const createAgent = async () => {
    setError(null)
    setSuccess(null)

    if (!tenantId) {
      setError("Tenant selection is required.")
      return
    }

    const safeName = name.trim()
    if (!safeName) {
      setError("Agent name is required.")
      return
    }

    if (!aiProvider) {
      setError("AI provider is required.")
      return
    }

    if (!aiModel.trim()) {
      setError("AI model is required.")
      return
    }

    if (!authMode) {
      setError("Google auth mode is required.")
      return
    }

    if (!executionMode) {
      setError("Execution mode is required.")
      return
    }

    if (executionMode === "scheduled" && !executionTime.trim()) {
      setError("Execution time is required for scheduled mode.")
      return
    }

    const parsedLookback = Number(lookbackHours)
    const parsedMax = Number(maxEmails)
    if (!Number.isFinite(parsedLookback) || parsedLookback < 1 || parsedLookback > 168) {
      setError("Lookback window must be between 1 and 168 hours.")
      return
    }
    if (!Number.isFinite(parsedMax) || parsedMax < 1 || parsedMax > 100) {
      setError("Max emails per run must be between 1 and 100.")
      return
    }


    setSaving(true)
    try {
      const flowSummary = flowSummaryText(generatedGraph.nodes, generatedGraph.edges)
      const finalPrompt = [
        systemPrompt.trim() || "You are a read-only Gmail analysis assistant. Return strict JSON.",
        "",
        `Tenant scope: ${tenantId}`,
        `Execution: ${executionMode}${executionMode === "scheduled" ? ` at ${executionTime} ${timezone}` : ""}`,
        `Flow: ${flowSummary}`,
      ]
        .filter(Boolean)
        .join("\n")

      const createResp = await (dispatch(
        createTenantAgent({
          name: safeName,
          description: description.trim(),
          systemPrompt: finalPrompt,
          topK: selectedBlueprint?.defaults.topK || 6,
          isActive: isActive ? 1 : 0,
          allowedCollections: Array.isArray(selectedBlueprint?.defaults.allowedCollections)
            ? selectedBlueprint?.defaults.allowedCollections
            : [],
        }),
      ) as Promise<{ agent?: { id?: string } }>)

      const agentId = String(createResp?.agent?.id || "")
      if (!agentId) {
        throw new Error("Agent id missing from create response.")
      }

      await (dispatch(upsertTenantAgentAssignment({
          agentId,
          aiProvider,
          aiModel,
          authMode,
          executionMode,
          executionTime,
          timezone,
          lookbackHours: parsedLookback,
          maxEmails: parsedMax,
          managerCanRun,
          memberCanRun,
          assignedUserIds,
        }),
      ) as Promise<unknown>)

      setSuccess(`${selectedBlueprint?.title || "Agent"} created with step-by-step flow and assignment permissions.`)
    } catch (err: unknown) {
      let message = "Failed to create agent"

      if (typeof err === "object" && err !== null) {
        const e = err as {
          response?: { status?: number; data?: unknown }
          message?: string
        }
        const responseData = e.response?.data as
          | { message?: string; error?: string }
          | string
          | undefined

        if (typeof responseData === "string" && responseData.trim()) {
          message = responseData
        } else if (responseData && typeof responseData === "object") {
          if (responseData.message) message = String(responseData.message)
          else if (responseData.error) message = String(responseData.error)
        } else if (e.message) {
          message = e.message
        }

        if (e.response?.status === 403 && message === "Failed to create agent") {
          message = "Tenant admin role required."
        }
      }

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Create New Agent</h1>
              <p className="mt-2 text-sm text-slate-600">
                Configure tenant scope, schedule, permissions, and user assignments. The flow graph appears step by step as you fill inputs.
              </p>
              {loadingBlueprints ? <p className="mt-2 text-xs text-slate-500">Loading blueprint from database...</p> : null}
              {selectedBlueprint ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Blueprint: {selectedBlueprint.title}</Badge>
                  <Badge variant="outline">Category: {CATEGORY_LABEL[normalizeCategory(selectedBlueprint.category)]}</Badge>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Tip: open this page from Agent Blueprint Catalog. Blueprint data is loaded from database API.
                </p>
              )}
            </div>
            <Link href="/tenant/agents" prefetch={false}>
              <Button variant="outline" className="cursor-pointer">Back to Agents</Button>
            </Link>
          </div>
        </section>
        
        <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>Execution time, status, and permissions.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Finance Inbox Assistant" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>AI provider</Label>
                  <Select value={aiProvider || "none"} onValueChange={onProviderChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select provider</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>AI model</Label>
                  <Select value={aiModel || "none"} onValueChange={(value) => setAiModel(value === "none" ? "" : value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select model</SelectItem>
                      {(aiProvider ? AI_MODEL_OPTIONS[aiProvider] : []).map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Google auth mode</Label>
                  <Select value={authMode || "none"} onValueChange={(value) => setAuthMode(value === "none" ? "" : (value as AuthMode))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auth mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select auth mode</SelectItem>
                      <SelectItem value="tenant_shared_connection">Tenant shared connection</SelectItem>
                      <SelectItem value="user_personal_connection">User personal connection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Execution mode</Label>
                  <Select value={executionMode || "none"} onValueChange={(value) => setExecutionMode(value === "none" ? "" : (value as ExecutionMode))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Execution mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select mode</SelectItem>
                      <SelectItem value="manual">Manual run</SelectItem>
                      <SelectItem value="scheduled">Scheduled run</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {executionMode === "scheduled" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="execution-time">Execution time</Label>
                    <Input id="execution-time" type="time" value={executionTime} onChange={(event) => setExecutionTime(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lookback">Lookback (hours)</Label>
                  <Input id="lookback" type="number" min={1} max={168} value={lookbackHours} onChange={(event) => setLookbackHours(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-emails">Max emails</Label>
                  <Input id="max-emails" type="number" min={1} max={100} value={maxEmails} onChange={(event) => setMaxEmails(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="system-prompt">System prompt</Label>
                <Textarea id="system-prompt" rows={3} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} placeholder="Write instructions for the agent behavior" />
              </div>

              {/* VIP senders removed */}

              <div className="space-y-2">
                <Label>Role permissions</Label>
                <div className="grid gap-2 rounded-lg border p-3">
                  <label className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">manager can run</span>
                    <Switch checked={managerCanRun} className=" cursor-pointer"  onCheckedChange={(checked) => setManagerCanRun(Boolean(checked))} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">member can run</span>
                    <Switch checked={memberCanRun} className=" cursor-pointer" onCheckedChange={(checked) => setMemberCanRun(Boolean(checked))} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">agent active (is_active)</span>
                    <Switch checked={isActive} className=" cursor-pointer" onCheckedChange={(checked) => setIsActive(Boolean(checked))} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Assign users (multi-select)</Label>
                  <Link href="/tenant/users/view" className="text-xs text-primary underline underline-offset-4">Manage tenant users</Link>
                </div>

                <div className="grid gap-2 rounded-lg border p-2">
                  <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users by name or email" />
                  <Button type="button" variant="outline" className="cursor-pointer" onClick={toggleSelectAllFiltered}>
                    Toggle Select Visible Users ({filteredUsers.length})
                  </Button>
                </div>

                <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {loadingUsers ? <p className="p-2 text-sm text-muted-foreground">Loading users...</p> : null}
                  {!loadingUsers && filteredUsers.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No users found.</p> : null}
                  {filteredUsers.map((user) => {
                    const selected = assignedUserIds.includes(String(user.id))
                    return (
                      <label key={user.id} className="flex items-center justify-between rounded-md border p-2">
                        <div>
                          <p className="text-sm font-medium">{formatUserName(user)}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Switch checked={selected} className=" cursor-pointer" onCheckedChange={() => toggleAssigned(String(user.id))} />
                      </label>
                    )
                  })}
                </div>
              </div>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

              <Button className="w-full cursor-pointer" onClick={createAgent} disabled={saving}>
                {saving ? "Saving..." : `Create ${selectedBlueprint?.title || "Agent"}`}
              </Button>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">tenant scoped</Badge>
                <Badge variant="outline">permission aware</Badge>
                <Badge variant="outline">is_active: {isActive ? "1" : "0"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Agent Flow Editor</CardTitle>
              <CardDescription>Right-side flow updates automatically as each setup step is completed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-130 rounded-xl border">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                >
                  <MiniMap />
                  <Controls />
                  <Background gap={16} />
                </ReactFlow>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {flowSummaryText(nodes, edges)}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
