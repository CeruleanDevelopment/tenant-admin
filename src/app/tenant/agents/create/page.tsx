"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  useEdgesState,
  useNodesState,
  type Edge,
  type Node as FlowNode,
} from "reactflow"
import "reactflow/dist/style.css"
import { Plus } from "lucide-react"

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
type ConfigNodeType =
  | "agent_details"
  | "ai_config"
  | "auth"
  | "execution"
  | "limits"
  | "prompt"
  | "permissions"
  | "assignment"

type FlowNodeData = {
  label: string
  hint?: string
  kind?: ConfigNodeType
}

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

const FLOW_NODE_LIBRARY: Array<{
  kind: ConfigNodeType
  title: string
  description: string
  required?: boolean
}> = [
  {
    kind: "agent_details",
    title: "Agent Details",
    description: "Name, short description, and active status.",
    required: true,
  },
  {
    kind: "ai_config",
    title: "AI Model",
    description: "Choose provider and model.",
    required: true,
  },
  {
    kind: "auth",
    title: "Google Auth",
    description: "Select tenant shared or user personal auth mode.",
    required: true,
  },
  {
    kind: "execution",
    title: "Execution",
    description: "Manual or scheduled execution settings.",
    required: true,
  },
  {
    kind: "limits",
    title: "Run Limits",
    description: "Lookback window and max emails per run.",
    required: true,
  },
  {
    kind: "prompt",
    title: "Instruction Prompt",
    description: "Behavior instruction for the agent.",
  },
  {
    kind: "permissions",
    title: "Role Permissions",
    description: "Manager/member run access and active state.",
    required: true,
  },
  {
    kind: "assignment",
    title: "User Assignment",
    description: "Assign this agent to tenant users.",
  },
]

const REQUIRED_FLOW_NODES: ConfigNodeType[] = [
  "agent_details",
  "ai_config",
  "auth",
  "execution",
  "limits",
  "permissions",
]

const AI_MODEL_OPTIONS: Record<"openai" | "openrouter", string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  openrouter: ["openrouter/auto", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-flash"],
}

const TIMEZONE_OPTIONS = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"]

const formatUserName = (user: TenantUser): string => {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return full || String(user.email || "User")
}

const flowSummaryText = (nodes: FlowNode<FlowNodeData>[], edges: Edge[]): string => {
  if (!nodes.length) {
    return "Canvas is blank. Select an agent blueprint to start building the flow."
  }

  const byId = new Map(
    nodes.map((node) => [node.id, String((node.data as { label?: string } | undefined)?.label || node.id)]),
  )

  return edges.map((edge) => `${byId.get(edge.source) || edge.source} -> ${byId.get(edge.target) || edge.target}`).join("\n")
}

const nodeLabelForKind = (
  kind: ConfigNodeType,
  values: {
    name: string
    description: string
    aiProvider: AiProvider
    aiModel: string
    authMode: AuthMode
    executionMode: ExecutionMode
    executionTime: string
    timezone: string
    lookbackHours: string
    maxEmails: string
    systemPrompt: string
    managerCanRun: boolean
    memberCanRun: boolean
    isActive: boolean
    assignedCount: number
  },
): { label: string; hint: string } => {
  if (kind === "agent_details") {
    return {
      label: values.name.trim() ? `Agent: ${values.name.trim()}` : "Agent details",
      hint: values.description.trim() ? "Name and description configured" : "Set name, description, and status",
    }
  }
  if (kind === "ai_config") {
    return {
      label: values.aiProvider && values.aiModel ? `Model: ${values.aiProvider} / ${values.aiModel}` : "AI model",
      hint: values.aiProvider ? "Provider selected" : "Select provider and model",
    }
  }
  if (kind === "auth") {
    return {
      label:
        values.authMode === "user_personal_connection"
          ? "Auth: user personal"
          : values.authMode === "tenant_shared_connection"
            ? "Auth: tenant shared"
            : "Google auth",
      hint: values.authMode ? "Auth mode configured" : "Select an auth mode",
    }
  }
  if (kind === "execution") {
    return {
      label:
        values.executionMode === "scheduled"
          ? `Run: scheduled ${values.executionTime || "--:--"}`
          : values.executionMode === "manual"
            ? "Run: manual"
            : "Execution",
      hint: values.executionMode === "scheduled" ? `Timezone: ${values.timezone}` : "Choose manual or scheduled run",
    }
  }
  if (kind === "limits") {
    return {
      label: `Window: ${values.lookbackHours || "--"}h, max ${values.maxEmails || "--"}`,
      hint: "Run limits",
    }
  }
  if (kind === "prompt") {
    return {
      label: values.systemPrompt.trim() ? "Instruction prompt" : "Instruction prompt",
      hint: values.systemPrompt.trim() ? "Prompt configured" : "Optional behavior instructions",
    }
  }
  if (kind === "permissions") {
    return {
      label: `Permissions: Mgr ${values.managerCanRun ? "yes" : "no"}, Member ${values.memberCanRun ? "yes" : "no"}`,
      hint: `Agent active: ${values.isActive ? "yes" : "no"}`,
    }
  }
  return {
    label: `Assignments: ${values.assignedCount}`,
    hint: values.assignedCount > 0 ? "Users assigned" : "Optional user assignment",
  }
}

const buildCanvasGraph = (input: {
  hasBlueprint: boolean
  blueprintTitle: string
  kinds: ConfigNodeType[]
  values: {
    name: string
    description: string
    aiProvider: AiProvider
    aiModel: string
    authMode: AuthMode
    executionMode: ExecutionMode
    executionTime: string
    timezone: string
    lookbackHours: string
    maxEmails: string
    systemPrompt: string
    managerCanRun: boolean
    memberCanRun: boolean
    isActive: boolean
    assignedCount: number
  }
}): { nodes: FlowNode<FlowNodeData>[]; edges: Edge[] } => {
  if (!input.hasBlueprint) {
    return { nodes: [], edges: [] }
  }

  const nodes: FlowNode<FlowNodeData>[] = [
    {
      id: "blueprint_start",
      type: "input",
      position: { x: 80, y: 120 },
      data: {
        label: `Blueprint: ${input.blueprintTitle || "Select blueprint"}`,
        hint: "Starting node",
      },
      style: { borderRadius: 14, border: "1px solid #94a3b8", background: "#f8fafc", width: 220 },
    },
  ]

  const edges: Edge[] = []
  let previousNodeId = "blueprint_start"

  input.kinds.forEach((kind, index) => {
    const info = nodeLabelForKind(kind, input.values)
    const x = 340 + index * 240
    const id = `cfg_${kind}`

    nodes.push({
      id,
      type: "default",
      position: { x, y: 120 },
      data: {
        label: info.label,
        hint: info.hint,
        kind,
      },
      style: { borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", width: 220 },
    })

    edges.push({
      id: `edge_${previousNodeId}_${id}`,
      source: previousNodeId,
      target: id,
      animated: true,
      style: { strokeWidth: 1.5 },
    })

    previousNodeId = id
  })

  return { nodes, edges }
}

export default function TenantAgentCreatePage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()

  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)
  const tenantId = String(tenantProfile?.id || "")
  const initialBlueprintId = String(searchParams.get("blueprint") || "").trim()
  const [blueprints, setBlueprints] = useState<TenantAgentBlueprint[]>([])
  const [loadingBlueprints, setLoadingBlueprints] = useState(false)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(initialBlueprintId)
  const selectedBlueprint = useMemo(
    () => blueprints.find((item) => String(item.id || "") === selectedBlueprintId),
    [blueprints, selectedBlueprintId],
  )
  const [appliedBlueprintId, setAppliedBlueprintId] = useState<string>("")

  const [users, setUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [agentSkill, setAgentSkill] = useState("")
  const [agentInstruction, setAgentInstruction] = useState("")
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

  const [flowNodeKinds, setFlowNodeKinds] = useState<ConfigNodeType[]>([])
  const [showNodePicker, setShowNodePicker] = useState(false)
  const [activeCanvasNodeId, setActiveCanvasNodeId] = useState<string>("blueprint_start")
  const nodePickerRef = useRef<HTMLDivElement | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([])
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
    setAgentSkill(String((defaults as { agentSkill?: string }).agentSkill || ""))
    setAgentInstruction(String((defaults as { agentInstruction?: string }).agentInstruction || ""))
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
    setFlowNodeKinds([])
    setActiveCanvasNodeId("blueprint_start")
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
      buildCanvasGraph({
        hasBlueprint: Boolean(selectedBlueprint),
        blueprintTitle: selectedBlueprint?.title || "Choose blueprint",
        kinds: flowNodeKinds,
        values: {
          name,
          description,
          aiProvider,
          aiModel,
          authMode,
          executionMode,
          executionTime,
          timezone,
          lookbackHours,
          maxEmails,
          systemPrompt,
          managerCanRun,
          memberCanRun,
          isActive,
          assignedCount: assignedUserIds.length,
        },
      }),
    [
      selectedBlueprint?.title,
      flowNodeKinds,
      name,
      description,
      aiProvider,
      aiModel,
      authMode,
      executionMode,
      executionTime,
      timezone,
      lookbackHours,
      maxEmails,
      systemPrompt,
      managerCanRun,
      memberCanRun,
      isActive,
      assignedUserIds.length,
    ],
  )

  useEffect(() => {
    setNodes(generatedGraph.nodes)
    setEdges(generatedGraph.edges)
  }, [generatedGraph, setNodes, setEdges])

  useEffect(() => {
    if (!showNodePicker) return

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (nodePickerRef.current && !nodePickerRef.current.contains(target)) {
        setShowNodePicker(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [showNodePicker])

  const availableNodeTemplates = useMemo(
    () => FLOW_NODE_LIBRARY.filter((node) => !flowNodeKinds.includes(node.kind)),
    [flowNodeKinds],
  )

  const activeNodeKind = useMemo(() => {
    const node = nodes.find((item) => item.id === activeCanvasNodeId)
    return node?.data?.kind
  }, [nodes, activeCanvasNodeId])

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

  const addFlowNode = (kind: ConfigNodeType) => {
    if (flowNodeKinds.includes(kind)) return
    setFlowNodeKinds((prev) => [...prev, kind])
    setActiveCanvasNodeId(`cfg_${kind}`)
    setShowNodePicker(false)
  }

  const removeFlowNode = (kind: ConfigNodeType) => {
    setFlowNodeKinds((prev) => prev.filter((item) => item !== kind))
    setActiveCanvasNodeId("blueprint_start")
  }

  const createAgent = async () => {
    setError(null)
    setSuccess(null)

    if (!selectedBlueprint) {
      setError("Select a blueprint before creating an agent.")
      return
    }

    const missingRequired = REQUIRED_FLOW_NODES.filter((kind) => !flowNodeKinds.includes(kind))
    if (missingRequired.length > 0) {
      const labels = missingRequired
        .map((kind) => FLOW_NODE_LIBRARY.find((item) => item.kind === kind)?.title || kind)
        .join(", ")
      setError(`Add required nodes from + Add Node first: ${labels}.`)
      return
    }

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
      const flowSummary = flowSummaryText(nodes, edges)
      const finalPrompt = [
        systemPrompt.trim() || "You are a read-only Gmail analysis assistant. Return strict JSON.",
        agentSkill.trim() ? `Agent Skill:\n${agentSkill.trim()}` : "",
        agentInstruction.trim() ? `User Instruction:\n${agentInstruction.trim()}` : "",
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
          agentSkill: agentSkill.trim(),
          agentInstruction: agentInstruction.trim(),
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

      setSuccess(`${selectedBlueprint?.title || "Agent"} created with canvas flow and assignment permissions.`)
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

  const activeNodeMeta = useMemo(
    () => FLOW_NODE_LIBRARY.find((item) => item.kind === activeNodeKind),
    [activeNodeKind],
  )

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfeff_0%,#ffffff_28%)] px-4 py-4 sm:px-4 lg:px-4">
      <div className="mx-auto flex w-full max-w-450 flex-col gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Create Agent Studio</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Build your agent in a canvas-first workflow. Add required nodes, configure settings, then publish.
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-[minmax(260px,1fr)_auto_auto] sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Select Agent</Label>
                  <Select
                    value={selectedBlueprintId || "none"}
                    onValueChange={(value) => {
                      const nextId = value === "none" ? "" : value
                      setSelectedBlueprintId(nextId)
                      setAppliedBlueprintId("")
                      setFlowNodeKinds([])
                      setShowNodePicker(false)
                      setActiveCanvasNodeId("blueprint_start")
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No agent selected</SelectItem>
                      {blueprints.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-8 cursor-pointer"
                  disabled={!selectedBlueprintId}
                  onClick={() => {
                    setSelectedBlueprintId("")
                    setAppliedBlueprintId("")
                    setFlowNodeKinds([])
                    setShowNodePicker(false)
                    setActiveCanvasNodeId("blueprint_start")
                  }}
                >
                  Clear
                </Button>

                {/* {selectedBlueprint ? (
                  <Badge variant="outline" className="h-10 justify-center px-3 text-xs font-medium">
                    {CATEGORY_LABEL[normalizeCategory(selectedBlueprint.category)]}
                  </Badge>
                ) : null} */}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">Nodes: {flowNodeKinds.length}</Badge>
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Assigned: {assignedUserIds.length}</Badge>
                {activeNodeMeta ? (
                  <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">Active: {activeNodeMeta.title}</Badge>
                ) : null}
                {loadingBlueprints ? <Badge variant="outline">Loading...</Badge> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/tenant/agents" prefetch={false}>
                <Button variant="outline" className="cursor-pointer">Back to Agents</Button>
              </Link>
              <Button className="cursor-pointer bg-cyan-700 hover:bg-cyan-800" disabled={!selectedBlueprint || saving} onClick={createAgent}>
                {saving ? "Saving..." : `Create ${selectedBlueprint?.title || "Agent"}`}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4">
          <Card className="overflow-hidden rounded-3xl border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Flow Builder Canvas</CardTitle>
                  <CardDescription>Click a node to edit its settings from the right-side inspector.</CardDescription>
                </div>
                <div ref={nodePickerRef} className="relative flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={!selectedBlueprint}
                    onClick={() => setShowNodePicker((prev) => !prev)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Node
                  </Button>

                  {showNodePicker ? (
                    <div className="absolute right-0 top-11 z-30 w-[min(48rem,92vw)] rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-lg">
                      {availableNodeTemplates.length === 0 ? (
                        <p className="text-xs text-slate-500">All available configuration nodes are already on canvas.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {availableNodeTemplates.map((node) => (
                            <button
                              key={node.kind}
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-cyan-300 hover:bg-cyan-50/40"
                              onClick={() => addFlowNode(node.kind)}
                              disabled={!selectedBlueprint}
                            >
                              <p className="text-sm font-semibold text-slate-900">{node.title}</p>
                              <p className="mt-1 text-xs text-slate-600">{node.description}</p>
                              {node.required ? <p className="mt-1 text-[11px] font-medium text-cyan-700">Required</p> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="relative h-[80vh] min-h-160 rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,#dbeafe_1px,transparent_0)] bg-size-[22px_22px]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(_, node) => setActiveCanvasNodeId(node.id)}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                >
                  <Controls />
                  <Background gap={20} size={1.1} color="#cbd5e1" />
                </ReactFlow>

                {!selectedBlueprint ? (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/95 px-5 py-4 text-center shadow-sm">
                      <p className="text-sm font-semibold text-slate-800">Canvas is waiting for a blueprint</p>
                      <p className="mt-1 text-xs text-slate-500">Select a blueprint from top bar, then add nodes.</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-wrap">
                {flowSummaryText(nodes, edges)}
              </div>
              {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
              {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div> : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
