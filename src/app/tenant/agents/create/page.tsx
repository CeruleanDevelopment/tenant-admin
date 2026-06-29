"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import {
  createTenantAgent,
  fetchTenantAgent,
  fetchTenantAgentAssignment,
  fetchTenantAgentBlueprints,
  fetchTenantUsers,
  type TenantAgentBlueprint,
  updateTenantAgent,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  NodeResizer,
  getBezierPath,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  addEdge,
  Handle,
  Position,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node as FlowNode,
  type NodeProps,
} from "reactflow"
import "reactflow/dist/style.css"
import { Plus, Trash, X } from "lucide-react"

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
  | "service"
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
  shape?: NodeShape
  tone?: NodeTone
}

type NodeShape = "rounded" | "pill" | "square" | "diamond" | "circle"
type NodeTone = "slate" | "cyan" | "emerald" | "amber" | "rose"
type NodeDesignPreset = "card" | "compact" | "outlined" | "custom"
type NodeOverride = Partial<FlowNodeData> & {
  style?: CSSProperties
  designPreset?: NodeDesignPreset
  position?: { x: number; y: number }
}

type DeletableEdgeData = {
  showDelete?: boolean
  onDelete?: () => void
}

const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<DeletableEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {data?.showDelete ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="cursor-pointer rounded-md border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-red-600 shadow-sm hover:bg-red-50"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onClick={(event) => {
              event.stopPropagation()
              data?.onDelete?.()
            }}
          >
            <Trash className="h-4 w-4"/>
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const styleFromDesignPreset = (preset: NodeDesignPreset): CSSProperties | undefined => {
  if (preset === "card") {
    return { borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", width: 220 }
  }
  if (preset === "compact") {
    return { borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", width: 160 }
  }
  if (preset === "outlined") {
    return { borderRadius: 14, border: "2px dashed #94a3b8", background: "#f8fafc", width: 220 }
  }
  return undefined
}

type AgentCategory = "gmail" | "crm" | "support" | "calendar" | "knowledge" | "automation" | "general"
type WorkflowType = "direct" | "mastra" | "langchain"

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  gmail: "Gmail",
  crm: "CRM",
  support: "Support",
  calendar: "Calendar",
  knowledge: "Knowledge",
  automation: "Automation",
  general: "General",
}

const NODE_TONE_BY_KIND: Record<ConfigNodeType, NodeTone> = {
  agent_details: "cyan",
  service: "emerald",
  ai_config: "amber",
  auth: "rose",
  execution: "slate",
  limits: "amber",
  prompt: "cyan",
  permissions: "emerald",
  assignment: "rose",
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
    kind: "service",
    title: "Service Type",
    description: "Choose service domain and workflow engine.",
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
  "service",
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
    serviceType: AgentCategory
    workflowType: WorkflowType
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
  if (kind === "service") {
    return {
      label: `Service: ${String(values.serviceType || "general")}`,
      hint: `Workflow: ${String(values.workflowType || "direct")}`,
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
    serviceType: AgentCategory
    workflowType: WorkflowType
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

  const nodes: FlowNode<FlowNodeData>[] = []

  input.kinds.forEach((kind, index) => {
    const info = nodeLabelForKind(kind, input.values)
    const x = 340 + index * 240
    const id = `cfg_${kind}`

    nodes.push({
      id,
      type: "config",
      position: { x, y: 120 },
      data: {
        label: info.label,
        hint: info.hint,
        kind,
        tone: NODE_TONE_BY_KIND[kind],
      },
      style: { borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", width: 220 },
    })
  })

  return { nodes, edges: [] }
}

export default function TenantAgentCreatePage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()

  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)
  const tenantId = String(tenantProfile?.id || "")
  const initialBlueprintId = String(searchParams.get("blueprint") || "").trim()
  const editingAgentId = String(searchParams.get("agentId") || "").trim()
  const isEditMode = Boolean(editingAgentId)
  const [workingAgentId, setWorkingAgentId] = useState<string>(editingAgentId)
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
  const [loadingEditData, setLoadingEditData] = useState(false)

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
  const [serviceType, setServiceType] = useState<AgentCategory>("general")
  const [workflowType, setWorkflowType] = useState<WorkflowType>("direct")
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState("")

  const [flowNodeKinds, setFlowNodeKinds] = useState<ConfigNodeType[]>([])
  const [showNodePicker, setShowNodePicker] = useState(false)
  const [activeCanvasNodeId, setActiveCanvasNodeId] = useState<string>("")
  const nodePickerRef = useRef<HTMLDivElement | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [selectedEdgeType, setSelectedEdgeType] = useState<string>("smoothstep")
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, NodeOverride>>({})
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string>("")
  const [newConnectionSource, setNewConnectionSource] = useState<string>("")
  const [newConnectionTarget, setNewConnectionTarget] = useState<string>("")
  const [edgeColor, setEdgeColor] = useState<string>("#0f766e")
  const [edgeWidth, setEdgeWidth] = useState<string>("2")
  const [edgeDashed, setEdgeDashed] = useState<boolean>(false)
  const [edgeAnimated, setEdgeAnimated] = useState<boolean>(true)
  const [designDraft, setDesignDraft] = useState<NodeDesignPreset>("card")
  const [shapeDraft, setShapeDraft] = useState<NodeShape>("rounded")
  const [toneDraft, setToneDraft] = useState<NodeTone>("slate")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [pendingRemoveNode, setPendingRemoveNode] = useState<{
    nodeId: string
    kind: ConfigNodeType
    title: string
  } | null>(null)

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
    setWorkingAgentId(editingAgentId)
  }, [editingAgentId])

  useEffect(() => {
    if (isEditMode) return
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
    setServiceType(normalizeCategory(String((defaults as { serviceType?: string }).serviceType || selectedBlueprint.category || "general")))
    setWorkflowType(
      String((defaults as { workflowType?: string }).workflowType || "direct") === "mastra"
        ? "mastra"
        : String((defaults as { workflowType?: string }).workflowType || "direct") === "langchain"
          ? "langchain"
          : "direct",
    )
    setFlowNodeKinds([])
    setActiveCanvasNodeId("")
    setAppliedBlueprintId(String(selectedBlueprint.id))
  }, [selectedBlueprint, appliedBlueprintId, isEditMode])

  // Show nodes only when flow nodes have been added; keep canvas blank otherwise
  useEffect(() => {
    if (flowNodeKinds.length > 0) {
      setShowNodes(true)
    } else {
      setShowNodes(false)
      setShowNodeEditor(false)
      setActiveCanvasNodeId("")
    }
  }, [flowNodeKinds])

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

  useEffect(() => {
    if (!isEditMode || !editingAgentId) return

    const loadEditData = async () => {
      setLoadingEditData(true)
      setError(null)
      try {
        const [agent, assignment] = await Promise.all([
          dispatch(fetchTenantAgent(editingAgentId)) as Promise<Record<string, unknown> | null>,
          dispatch(fetchTenantAgentAssignment(editingAgentId)) as Promise<Record<string, unknown> | null>,
        ])

        const assignmentRow = assignment || {}

        setName(String(agent?.name || assignmentRow.agentName || ""))
        setDescription(String(agent?.description || ""))
        setSystemPrompt(String(agent?.systemPrompt || ""))
        setAgentSkill(String(agent?.agentSkill || ""))
        setAgentInstruction(String(agent?.agentInstruction || ""))
        setIsActive(Number(assignmentRow.isActive ?? agent?.isActive ?? 1) !== 0)

        const aiProviderValue =
          assignmentRow.aiProvider === "openrouter" ? "openrouter" : assignmentRow.aiProvider === "openai" ? "openai" : ""
        setAiProvider(aiProviderValue)
        setAiModel(String(assignmentRow.aiModel || ""))

        setAuthMode(
          assignmentRow.authMode === "user_personal_connection"
            ? "user_personal_connection"
            : assignmentRow.authMode === "tenant_shared_connection"
              ? "tenant_shared_connection"
              : "",
        )
        setExecutionMode(
          assignmentRow.executionMode === "scheduled"
            ? "scheduled"
            : assignmentRow.executionMode === "manual"
              ? "manual"
              : "",
        )
        setExecutionTime(String(assignmentRow.executionTime || "09:00"))
        setTimezone(String(assignmentRow.timezone || "UTC"))
        setLookbackHours(String(assignmentRow.lookbackHours ?? 24))
        setMaxEmails(String(assignmentRow.maxEmails ?? 75))
        setManagerCanRun(Boolean(assignmentRow.managerCanRun ?? true))
        setMemberCanRun(Boolean(assignmentRow.memberCanRun ?? false))
        setServiceType(
          normalizeCategory(String(agent?.serviceType || selectedBlueprint?.category || "general")),
        )
        setWorkflowType(
          String(agent?.workflowType || "direct") === "mastra"
            ? "mastra"
            : String(agent?.workflowType || "direct") === "langchain"
              ? "langchain"
              : "direct",
        )
        setAssignedUserIds(
          Array.isArray(assignmentRow.assignedUserIds)
            ? assignmentRow.assignedUserIds.map((value: unknown) => String(value || "")).filter(Boolean)
            : [],
        )

        const initialKinds: ConfigNodeType[] = [
          "agent_details",
          "service",
          "ai_config",
          "auth",
          "execution",
          "limits",
          "permissions",
          "assignment",
        ]
        if (String(agent?.systemPrompt || "").trim()) initialKinds.push("prompt")
        setFlowNodeKinds(Array.from(new Set(initialKinds)))
      } catch {
        setError("Failed to load agent details for editing.")
      } finally {
        setLoadingEditData(false)
      }
    }

    void loadEditData()
  }, [dispatch, editingAgentId, isEditMode])

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
        // only show the blueprint start node when a blueprint is selected AND there are flow nodes
        hasBlueprint: Boolean(selectedBlueprint) && flowNodeKinds.length > 0,
        blueprintTitle: selectedBlueprint?.title || "Choose blueprint",
        kinds: flowNodeKinds,
        values: {
          name,
          description,
          serviceType,
          workflowType,
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
      serviceType,
      workflowType,
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
    // Merge existing node positions and any per-node overrides so tenant edits aren't lost.
    setNodes((prevNodes) =>
      generatedGraph.nodes.map((n) => {
        const prev = prevNodes.find((p) => p.id === n.id) as FlowNode<FlowNodeData> | undefined
        const override = nodeOverrides[n.id]

        return {
          ...n,
          position: prev?.position || override?.position || n.position,
          data: {
            ...(n.data || {}),
            ...(override ? override : {}),
          },
          style: override?.style || n.style,
        }
      }),
    )
    // Preserve edge customizations when graph is regenerated.
    setEdges((prevEdges) =>
      {
        const regenerated = generatedGraph.edges.map((edge) => {
          const previous = prevEdges.find(
            (item) => item.id === edge.id || (item.source === edge.source && item.target === edge.target),
          )
          if (!previous) return edge

          return {
            ...edge,
            type: previous.type,
            animated: previous.animated,
            style: previous.style,
          }
        })

        const custom = prevEdges.filter(
          (item) =>
            !generatedGraph.edges.some(
              (edge) => edge.id === item.id || (edge.source === item.source && edge.target === item.target),
            ),
        )

        return [...regenerated, ...custom]
      },
    )
  }, [generatedGraph, setNodes, setEdges, nodeOverrides])

  useEffect(() => {
    const type = selectedEdgeType === "default" ? undefined : selectedEdgeType
    setEdges((prev) => prev.map((edge) => ({ ...edge, type })))
  }, [selectedEdgeType, setEdges])

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
    if (node?.data?.kind) {
      return node.data.kind
    }

    if (activeCanvasNodeId.startsWith("cfg_")) {
      const fallbackKind = activeCanvasNodeId.slice(4) as ConfigNodeType
      if (FLOW_NODE_LIBRARY.some((item) => item.kind === fallbackKind)) {
        return fallbackKind
      }
    }

    return undefined
  }, [nodes, activeCanvasNodeId])

  const edgeNodeOptions = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        label: String(node.data?.label || node.id),
      })),
    [nodes],
  )

  useEffect(() => {
    if (!activeCanvasNodeId) return
    setNewConnectionSource(activeCanvasNodeId)
  }, [activeCanvasNodeId])

  useEffect(() => {
    if (!hoveredEdgeId) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      event.preventDefault()
      removeConnectionById(hoveredEdgeId)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [hoveredEdgeId])

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

    const newNodeId = `cfg_${kind}`
    const sourceNode = nodes.find((item) => item.id === activeCanvasNodeId) || nodes[nodes.length - 1]
    const baseX = sourceNode ? sourceNode.position.x : 340 + flowNodeKinds.length * 260
    const baseY = sourceNode ? sourceNode.position.y : 120

    const SLOT_GAP_X = 260
    const LANE_GAP_Y = 170
    const COLLISION_X = 220
    const COLLISION_Y = 120

    const hasCollision = (x: number, y: number) =>
      nodes.some((node) => Math.abs(node.position.x - x) < COLLISION_X && Math.abs(node.position.y - y) < COLLISION_Y)

    const laneOffsets = [0, LANE_GAP_Y, -LANE_GAP_Y, LANE_GAP_Y * 2, -(LANE_GAP_Y * 2)]
    let candidatePosition = { x: baseX + SLOT_GAP_X, y: baseY }

    let placed = false
    for (let slot = 1; slot <= 8 && !placed; slot += 1) {
      for (const laneOffset of laneOffsets) {
        const x = baseX + slot * SLOT_GAP_X
        const y = baseY + laneOffset
        if (!hasCollision(x, y)) {
          candidatePosition = { x, y }
          placed = true
          break
        }
      }
    }

    setNodeOverrides((prev) => ({
      ...prev,
      [newNodeId]: {
        ...(prev[newNodeId] || {}),
        position: candidatePosition,
      },
    }))

    setFlowNodeKinds((prev) => [...prev, kind])
    setActiveCanvasNodeId(newNodeId)
    setShowNodePicker(false)
  }

  const removeFlowNode = (kind: ConfigNodeType) => {
    const nodeId = `cfg_${kind}`
    setFlowNodeKinds((prev) => prev.filter((item) => item !== kind))
    setNodeOverrides((prev) => {
      if (!(nodeId in prev)) return prev
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setActiveCanvasNodeId("")
  }

  const removeSelectedNodeFromCanvas = () => {
    if (!activeCanvasNodeId) {
      setError("Select a node to remove from canvas.")
      return
    }

    const selectedNodeId = activeCanvasNodeId
    const resolvedKind = activeNodeKind
      || (selectedNodeId.startsWith("cfg_") ? (selectedNodeId.slice(4) as ConfigNodeType) : undefined)

    if (!resolvedKind || !FLOW_NODE_LIBRARY.some((item) => item.kind === resolvedKind)) {
      setError("Unable to identify selected node for removal.")
      return
    }

    const nodeMeta = FLOW_NODE_LIBRARY.find((item) => item.kind === resolvedKind)
    setPendingRemoveNode({
      nodeId: selectedNodeId,
      kind: resolvedKind,
      title: nodeMeta?.title || "this node",
    })
    setIsRemoveDialogOpen(true)
  }

  const confirmRemoveNodeFromCanvas = () => {
    if (!pendingRemoveNode) return

    removeFlowNode(pendingRemoveNode.kind)
    setEdges((prev) => prev.filter((edge) => edge.source !== pendingRemoveNode.nodeId && edge.target !== pendingRemoveNode.nodeId))
    setShowNodeEditor(false)
    setActiveCanvasNodeId("")
    setIsRemoveDialogOpen(false)
    setPendingRemoveNode(null)
    setError(null)
    setSuccess(`${pendingRemoveNode.title} removed from canvas.`)
  }

  const createCanvasConnection = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return

    let created = false
    let duplicate = false

    setEdges((prev) => {
      if (prev.some((edge) => edge.source === sourceId && edge.target === targetId)) {
        duplicate = true
        return prev
      }

      created = true
      const e: Edge = {
        id: `edge_${sourceId}_${targetId}_${Date.now()}`,
        source: sourceId,
        target: targetId,
        animated: edgeAnimated,
        type: selectedEdgeType === "default" ? undefined : (selectedEdgeType as any),
        style: {
          stroke: edgeColor,
          strokeWidth: Number(edgeWidth),
          strokeDasharray: edgeDashed ? "6 4" : undefined,
        },
      }

      return addEdge(e, prev)
    })

    if (duplicate) {
      setSuccess("This connection already exists.")
      return
    }

    if (created) {
      const sourceLabel = String(nodes.find((n) => n.id === sourceId)?.data?.label || sourceId)
      const targetLabel = String(nodes.find((n) => n.id === targetId)?.data?.label || targetId)
      setSuccess(`Connected: ${sourceLabel} -> ${targetLabel}`)
      setError(null)
    }
  }

  const removeConnectionById = (edgeId: string) => {
    if (!edgeId) return

    setEdges((prev) => prev.filter((edge) => edge.id !== edgeId))
    if (hoveredEdgeId === edgeId) {
      setHoveredEdgeId("")
    }
    setSuccess("Connection removed.")
    setError(null)
  }

  const handleEdgeReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      if (!connection.source || !connection.target) return

      if (connection.source === connection.target) {
        setError("Source and target must be different.")
        return
      }

      let duplicate = false
      let reconnected = false

      setEdges((prev) => {
        duplicate = prev.some(
          (edge) =>
            edge.id !== oldEdge.id
            && edge.source === connection.source
            && edge.target === connection.target,
        )
        if (duplicate) return prev

        reconnected = true
        return reconnectEdge(
          oldEdge,
          {
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? null,
            targetHandle: connection.targetHandle ?? null,
          },
          prev,
        )
      })

      if (duplicate) {
        setError("This connection already exists.")
        return
      }

      if (reconnected) {
        const sourceLabel = String(nodes.find((n) => n.id === connection.source)?.data?.label || connection.source)
        const targetLabel = String(nodes.find((n) => n.id === connection.target)?.data?.label || connection.target)
        setSuccess(`Reconnected: ${sourceLabel} -> ${targetLabel}`)
        setError(null)
      }
    },
    [nodes, setEdges],
  )

  const buildFinalPrompt = () => {
    const flowSummary = flowSummaryText(nodes, edges)
    return [
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
  }

  const currentAllowedCollections = () =>
    Array.isArray(selectedBlueprint?.defaults.allowedCollections)
      ? selectedBlueprint?.defaults.allowedCollections
      : []

  const ensureWorkingAgent = async (): Promise<string> => {
    if (workingAgentId) return workingAgentId

    const safeName = name.trim()
    if (!safeName) {
      throw new Error("Agent name is required before saving node settings.")
    }

    const createResp = await (dispatch(
      createTenantAgent({
        name: safeName,
        description: description.trim(),
        systemPrompt: buildFinalPrompt(),
        agentSkill: agentSkill.trim(),
        agentInstruction: agentInstruction.trim(),
        topK: selectedBlueprint?.defaults.topK || 6,
        isActive: isActive ? 1 : 0,
        workflowType,
        serviceType,
        allowedCollections: currentAllowedCollections(),
      }),
    ) as Promise<{ agent?: { id?: string } }>)

    const createdId = String(createResp?.agent?.id || "")
    if (!createdId) {
      throw new Error("Agent id missing from create response.")
    }

    setWorkingAgentId(createdId)
    return createdId
  }

  const saveCoreAgentConfig = async (agentId: string) => {
    const safeName = name.trim()
    if (!safeName) {
      throw new Error("Agent name is required.")
    }

    await (dispatch(
      updateTenantAgent({
        agentId,
        name: safeName,
        description: description.trim(),
        systemPrompt: buildFinalPrompt(),
        agentSkill: agentSkill.trim(),
        agentInstruction: agentInstruction.trim(),
        isActive: isActive ? 1 : 0,
        topK: selectedBlueprint?.defaults.topK || 6,
        workflowType,
        serviceType,
        allowedCollections: currentAllowedCollections(),
      }),
    ) as Promise<unknown>)
  }

  const saveAssignmentConfig = async (agentId: string) => {
    const provider = aiProvider || "openai"
    const model = aiModel.trim() || AI_MODEL_OPTIONS[provider][0]
    const resolvedAuthMode: AuthMode = authMode || "tenant_shared_connection"
    const resolvedExecutionMode: ExecutionMode = executionMode || "manual"

    if (!aiProvider) setAiProvider(provider)
    if (!aiModel.trim()) setAiModel(model)
    if (!authMode) setAuthMode(resolvedAuthMode)
    if (!executionMode) setExecutionMode(resolvedExecutionMode)

    const parsedLookback = Number(lookbackHours)
    const parsedMax = Number(maxEmails)
    if (resolvedExecutionMode === "scheduled" && !executionTime.trim()) {
      throw new Error("Execution time is required for scheduled mode.")
    }
    if (!Number.isFinite(parsedLookback) || parsedLookback < 1 || parsedLookback > 168) {
      throw new Error("Lookback window must be between 1 and 168 hours.")
    }
    if (!Number.isFinite(parsedMax) || parsedMax < 1 || parsedMax > 100) {
      throw new Error("Max emails per run must be between 1 and 100.")
    }

    await (dispatch(
      upsertTenantAgentAssignment({
        agentId,
        aiProvider: provider,
        aiModel: model,
        authMode: resolvedAuthMode,
        executionMode: resolvedExecutionMode,
        executionTime,
        timezone,
        lookbackHours: parsedLookback,
        maxEmails: parsedMax,
        managerCanRun,
        memberCanRun,
        assignedUserIds,
      }),
    ) as Promise<unknown>)
  }

  const saveEditedSection = async (kind: ConfigNodeType) => {
    const agentId = await ensureWorkingAgent()

    if (kind === "agent_details" || kind === "prompt" || kind === "service") {
      await saveCoreAgentConfig(agentId)
      return
    }

    if (
      kind === "ai_config"
      || kind === "auth"
      || kind === "execution"
      || kind === "limits"
      || kind === "permissions"
      || kind === "assignment"
    ) {
      await saveAssignmentConfig(agentId)
      return
    }

    throw new Error("Unsupported node type for save.")
  }

  const createAgent = async () => {
    setError(null)
    setSuccess(null)

    if (!workingAgentId && !selectedBlueprint) {
      setError("Select a blueprint before creating an agent.")
      return
    }

    if (!workingAgentId) {
      const missingRequired = REQUIRED_FLOW_NODES.filter((kind) => !flowNodeKinds.includes(kind))
      if (missingRequired.length > 0) {
        const labels = missingRequired
          .map((kind) => FLOW_NODE_LIBRARY.find((item) => item.kind === kind)?.title || kind)
          .join(", ")
        setError(`Add required nodes from + Add Node first: ${labels}.`)
        return
      }
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
      const agentId = await ensureWorkingAgent()
      await saveCoreAgentConfig(agentId)
      await saveAssignmentConfig(agentId)
      setSuccess(workingAgentId ? "Agent updated and saved to database." : `${selectedBlueprint?.title || "Agent"} created and saved to database.`)
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

  // Custom node renderer so each node has visible handles and can apply nodeOverrides
  const ConfigNode = ({ data, id, selected }: NodeProps<FlowNodeData>) => {
    const override = nodeOverrides[id]
    const style = { ...(override?.style || (data && (data as any).style) || {}) }
    const shape = (override?.shape || data?.shape || "rounded") as NodeShape
    const tone = (override?.tone || data?.tone || "slate") as NodeTone

    const toneClass: Record<NodeTone, string> = {
      slate: "border-slate-300 bg-white text-slate-900",
      cyan: "border-cyan-300 bg-cyan-50 text-cyan-900",
      emerald: "border-emerald-300 bg-emerald-50 text-emerald-900",
      amber: "border-amber-300 bg-amber-50 text-amber-900",
      rose: "border-rose-300 bg-rose-50 text-rose-900",
    }

    const shapeClass: Record<NodeShape, string> = {
      rounded: "rounded-xl",
      pill: "rounded-full",
      square: "rounded-none",
      diamond: "rounded-lg rotate-45",
      circle: "rounded-full",
    }

    if (shape === "circle") {
      style.width = 150
      style.height = 150
    }

    if (shape === "diamond") {
      style.width = 170
      style.height = 170
    }

    return (
      <div style={style as any} className={`border p-3 shadow-sm ${toneClass[tone]} ${shapeClass[shape]}`}>
        <NodeResizer
          isVisible={Boolean(selected)}
          minWidth={140}
          minHeight={80}
          lineClassName="border-cyan-500"
          handleClassName="h-2.5 w-2.5 rounded-sm border border-cyan-700 bg-cyan-400"
        />
        <Handle type="target" position={Position.Left} />
        <div className={shape === "diamond" ? "-rotate-45" : ""}>
          <div className="text-sm font-semibold leading-tight">{data?.label}</div>
          <div className="mt-1 text-xs opacity-80">{data?.hint}</div>
        </div>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }

  const nodeTypes = useMemo(() => ({ config: ConfigNode }), [nodeOverrides])

  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), [])

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        type: "deletable",
        data: {
          ...(edge.data as DeletableEdgeData | undefined),
          showDelete: hoveredEdgeId === edge.id,
          onDelete: () => removeConnectionById(edge.id),
        },
      })),
    [edges, hoveredEdgeId],
  )

  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [showNodes, setShowNodes] = useState(false)

  useEffect(() => {
    if (!showNodeEditor || !activeCanvasNodeId) return

    const override = nodeOverrides[activeCanvasNodeId]
    setDesignDraft((override?.designPreset || "card") as NodeDesignPreset)
    setShapeDraft((override?.shape || "rounded") as NodeShape)
    setToneDraft((override?.tone || "slate") as NodeTone)
  }, [showNodeEditor, activeCanvasNodeId, nodeOverrides])

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfeff_0%,#ffffff_28%)] px-4 py-4 sm:px-4 lg:px-4">
      <div className="mx-auto flex w-full max-w-450 flex-col gap-4">
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{workingAgentId ? "Edit Agent Studio" : "Create Agent Studio"}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  {workingAgentId
                    ? "Edit section-wise settings and save each section directly to database."
                    : "Build your agent in a canvas-first workflow. Add required nodes, configure settings, then publish."}
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
                      setActiveCanvasNodeId("")
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
                    setActiveCanvasNodeId("")
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

              {/* <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">Nodes: {flowNodeKinds.length}</Badge>
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Assigned: {assignedUserIds.length}</Badge>
                {activeNodeMeta ? (
                  <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">Active: {activeNodeMeta.title}</Badge>
                ) : null}
                {loadingBlueprints ? <Badge variant="outline">Loading...</Badge> : null}
                {loadingEditData ? <Badge variant="outline">Loading agent...</Badge> : null}
              </div> */}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/tenant/agents" prefetch={false}>
                <Button variant="outline" className="cursor-pointer">Back to Agents</Button>
              </Link>
              <Button
                className="cursor-pointer bg-cyan-700 hover:bg-cyan-800"
                disabled={(workingAgentId ? false : !selectedBlueprint) || saving || loadingEditData}
                onClick={createAgent}
              >
                {saving
                  ? "Saving..."
                  : workingAgentId
                    ? "Save Agent"
                    : `Create ${selectedBlueprint?.title || "Agent"}`}
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
                  {/* <CardDescription>Click a node to edit its settings from the right-side inspector.</CardDescription> */}
                </div>
                <div ref={nodePickerRef} className="relative flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={!selectedBlueprint}
                    onClick={() => {
                      setShowNodeEditor(false)
                      setShowNodePicker((prev) => !prev)
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Node
                  </Button>

                  <div className="flex items-center gap-2">
                    {/* <Label className="text-xs">Connector:</Label>
                    <Select value={selectedEdgeType} onValueChange={(v) => setSelectedEdgeType(v)}>
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smoothstep">Smooth</SelectItem>
                        <SelectItem value="step">Step</SelectItem>
                        <SelectItem value="straight">Straight</SelectItem>
                        <SelectItem value="bezier">Bezier</SelectItem>
                        <SelectItem value="default">Default</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label className="text-xs">Width:</Label>
                    <Select value={edgeWidth} onValueChange={(v) => setEdgeWidth(v)}>
                      <SelectTrigger className="h-8 w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1px</SelectItem>
                        <SelectItem value="2">2px</SelectItem>
                        <SelectItem value="3">3px</SelectItem>
                        <SelectItem value="4">4px</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="color"
                      value={edgeColor}
                      onChange={(e) => setEdgeColor(e.target.value)}
                      className="h-8 w-10 p-1"
                    />
                    <div className="flex items-center gap-1">
                      <Label className="text-[11px]">Dash:</Label>
                      <Switch checked={edgeDashed} onCheckedChange={(v) => setEdgeDashed(Boolean(v))} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-[11px]">Anim:</Label>
                      <Switch checked={edgeAnimated} onCheckedChange={(v) => setEdgeAnimated(Boolean(v))} />
                    </div> */}
                  </div>

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
              <div className="flex gap-4">
                <div className="relative h-[80vh] min-h-160 flex-1 rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,#dbeafe_1px,transparent_0)] bg-size-[22px_22px]">
                  <ReactFlow
                    nodes={showNodes ? nodes : []}
                    edges={showNodes ? displayEdges : []}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={(_, node) => {
                      setActiveCanvasNodeId(node.id)
                      setShowNodeEditor(true)
                    }}
                    onNodeDoubleClick={(_, node) => {
                      setActiveCanvasNodeId(node.id)
                      setShowNodeEditor(true)
                    }}
                    onConnect={(connection) => {
                      if (!connection.source || !connection.target) return
                      createCanvasConnection(connection.source, connection.target)
                    }}
                    fitView
                    nodesDraggable={true}
                    nodesConnectable={true}
                    edgesUpdatable={true}
                    onReconnect={handleEdgeReconnect}
                    elementsSelectable
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onEdgeMouseEnter={(_, edge) => {
                      setHoveredEdgeId(edge.id)
                    }}
                    onEdgeMouseLeave={() => {
                      setHoveredEdgeId("")
                    }}
                    onPaneClick={() => {
                      setHoveredEdgeId("")
                    }}
                  >
                    <Controls />
                    <Background gap={20} size={1.1} color="#cbd5e1" />
                  </ReactFlow>

                  {showNodeEditor && activeNodeKind ? (
                    <div className="absolute inset-0 z-40 grid place-items-center">
                      <div className="w-[min(640px,96vw)] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">Edit: {activeNodeMeta?.title}</h4>
                            <p className="text-xs text-slate-500">
                              Edit settings for the selected node.
                              {" Save will persist this node to database."}
                            </p>
                          </div>
                          <div>
                            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setShowNodeEditor(false)}><X /></Button>
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Design</Label>
                            <Select
                              value={designDraft}
                              onValueChange={(v) => setDesignDraft(v as NodeDesignPreset)}
                            >
                              <SelectTrigger className="h-8 w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="compact">Compact</SelectItem>
                                <SelectItem value="outlined">Outlined</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Shape</Label>
                                <Select
                                  value={shapeDraft}
                                  onValueChange={(v) => setShapeDraft(v as NodeShape)}
                                >
                                  <SelectTrigger className="h-8 w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rounded">Rounded</SelectItem>
                                    <SelectItem value="pill">Pill</SelectItem>
                                    <SelectItem value="square">Square</SelectItem>
                                    <SelectItem value="diamond">Diamond</SelectItem>
                                    <SelectItem value="circle">Circle</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Tone</Label>
                                <Select
                                  value={toneDraft}
                                  onValueChange={(v) => setToneDraft(v as NodeTone)}
                                >
                                  <SelectTrigger className="h-8 w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="slate">Slate</SelectItem>
                                    <SelectItem value="cyan">Cyan</SelectItem>
                                    <SelectItem value="emerald">Emerald</SelectItem>
                                    <SelectItem value="amber">Amber</SelectItem>
                                    <SelectItem value="rose">Rose</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          {activeNodeKind === "agent_details" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Name</Label>
                              <Input value={name} onChange={(e) => setName(e.target.value)} />
                              <Label className="text-xs">Description</Label>
                              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Active</Label>
                                <Switch checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
                              </div>
                            </div>
                          ) : null}

                          {activeNodeKind === "service" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Service Type</Label>
                              <Select value={serviceType} onValueChange={(v) => setServiceType(normalizeCategory(v))}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gmail">Gmail</SelectItem>
                                  <SelectItem value="crm">CRM</SelectItem>
                                  <SelectItem value="support">Support</SelectItem>
                                  <SelectItem value="calendar">Calendar</SelectItem>
                                  <SelectItem value="knowledge">Knowledge</SelectItem>
                                  <SelectItem value="automation">Automation</SelectItem>
                                  <SelectItem value="general">General</SelectItem>
                                </SelectContent>
                              </Select>

                              <Label className="text-xs">Workflow Engine</Label>
                              <Select
                                value={workflowType}
                                onValueChange={(v) => setWorkflowType(v === "mastra" ? "mastra" : v === "langchain" ? "langchain" : "direct")}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="direct">Direct</SelectItem>
                                  <SelectItem value="mastra">Mastra</SelectItem>
                                  <SelectItem value="langchain">LangChain</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          {activeNodeKind === "ai_config" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Provider</Label>
                              <Select value={aiProvider || "none"} onValueChange={(v) => onProviderChange(v)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="openai">OpenAI</SelectItem>
                                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                                </SelectContent>
                              </Select>

                              <Label className="text-xs">Model</Label>
                              <Select value={aiModel || ""} onValueChange={(v) => setAiModel(v)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(aiProvider ? AI_MODEL_OPTIONS[aiProvider] : []).map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          {activeNodeKind === "auth" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Auth Mode</Label>
                              <Select value={authMode || "none"} onValueChange={(v) => setAuthMode(v === "none" ? ("" as AuthMode) : (v as AuthMode))}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select auth mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="tenant_shared_connection">Tenant shared</SelectItem>
                                  <SelectItem value="user_personal_connection">User personal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          {activeNodeKind === "execution" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Execution Mode</Label>
                              <Select value={executionMode || ""} onValueChange={(v) => setExecutionMode(v as ExecutionMode)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select execution" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">Manual</SelectItem>
                                  <SelectItem value="scheduled">Scheduled</SelectItem>
                                </SelectContent>
                              </Select>

                              {executionMode === "scheduled" ? (
                                <>
                                  <Label className="text-xs">Time</Label>
                                  <Input type="time" value={executionTime} onChange={(e) => setExecutionTime(e.target.value)} />
                                  <Label className="text-xs">Timezone</Label>
                                  <Select value={timezone} onValueChange={(v) => setTimezone(v)}>
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIMEZONE_OPTIONS.map((tz) => (
                                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </>
                              ) : null}
                            </div>
                          ) : null}

                          {activeNodeKind === "limits" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Lookback (hours)</Label>
                              <Input value={lookbackHours} onChange={(e) => setLookbackHours(e.target.value)} />
                              <Label className="text-xs">Max emails per run</Label>
                              <Input value={maxEmails} onChange={(e) => setMaxEmails(e.target.value)} />
                            </div>
                          ) : null}

                          {activeNodeKind === "prompt" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Instruction Prompt</Label>
                              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                              <Label className="text-xs">Agent Skill</Label>
                              <Textarea value={agentSkill} onChange={(e) => setAgentSkill(e.target.value)} />
                              <Label className="text-xs">User Instruction</Label>
                              <Textarea value={agentInstruction} onChange={(e) => setAgentInstruction(e.target.value)} />
                            </div>
                          ) : null}

                          {activeNodeKind === "permissions" ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Manager can run</Label>
                                <Switch checked={managerCanRun} onCheckedChange={(v) => setManagerCanRun(Boolean(v))} />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Member can run</Label>
                                <Switch checked={memberCanRun} onCheckedChange={(v) => setMemberCanRun(Boolean(v))} />
                              </div>
                            </div>
                          ) : null}

                          {activeNodeKind === "assignment" ? (
                            <div className="space-y-2 text-xs text-slate-700">
                              <div className="flex items-center justify-between">
                                <div>Assigned users: {assignedUserIds.length}</div>
                                <Button type="button" size="sm" variant="outline" onClick={toggleSelectAllFiltered}>
                                  Select all visible
                                </Button>
                              </div>

                              <Input
                                placeholder="Search users by name/email"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                              />

                              <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                                {loadingUsers ? <p className="text-[11px] text-slate-500">Loading users...</p> : null}
                                {!loadingUsers && filteredUsers.length === 0 ? (
                                  <p className="text-[11px] text-slate-500">No active users found.</p>
                                ) : null}
                                {!loadingUsers
                                  ? filteredUsers.map((user) => {
                                      const id = String(user.id)
                                      const checked = assignedUserIds.includes(id)
                                      return (
                                        <label key={id} className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-white">
                                          <div className="min-w-0">
                                            <p className="truncate text-xs font-medium text-slate-900">{formatUserName(user)}</p>
                                            <p className="truncate text-[11px] text-slate-600">{user.email}</p>
                                          </div>
                                          <Switch checked={checked} onCheckedChange={() => toggleAssigned(id)} />
                                        </label>
                                      )
                                    })
                                  : null}
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="text-[11px] text-slate-500">Save Assignment will persist selected users to database.</div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={async () => {
                                    setError(null)
                                    setSuccess(null)
                                    setSaving(true)
                                    try {
                                      await saveEditedSection("assignment")
                                      setSuccess("User assignment saved to database.")
                                    } catch (err: unknown) {
                                      setError(err instanceof Error ? err.message : "Failed to save user assignment.")
                                    } finally {
                                      setSaving(false)
                                    }
                                  }}
                                  disabled={saving}
                                >
                                  {saving ? "Saving..." : "Save Assignment"}
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          <div className="flex gap-2 pt-2 justify-end">
                            <Button
                              variant="outline"
                              className="cursor-pointer" 
                              onClick={() => {
                                if (activeCanvasNodeId) {
                                  setNodeOverrides((prev) => ({
                                    ...prev,
                                    [activeCanvasNodeId]: {
                                      ...(prev[activeCanvasNodeId] || {}),
                                      designPreset: "card",
                                      shape: "rounded",
                                      tone: "slate",
                                      style: styleFromDesignPreset("card"),
                                    },
                                  }))
                                }
                                setShowNodeEditor(false)
                                setActiveCanvasNodeId("")
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="cursor-pointer" 
                              onClick={async () => {
                                  setError(null)
                                  setSuccess(null)
                                  if (activeNodeKind) {
                                    setSaving(true)
                                    try {
                                      await saveEditedSection(activeNodeKind)
                                      setSuccess(`${activeNodeMeta?.title || "Section"} saved to database.`)
                                    } catch (err: unknown) {
                                      setError(err instanceof Error ? err.message : "Failed to save section.")
                                      return
                                    } finally {
                                      setSaving(false)
                                    }
                                  }

                                  if (activeCanvasNodeId) {
                                    setNodeOverrides((prev) => ({
                                      ...prev,
                                      [activeCanvasNodeId]: {
                                        ...(prev[activeCanvasNodeId] || {}),
                                        designPreset: designDraft,
                                        shape: shapeDraft,
                                        tone: toneDraft,
                                        style: styleFromDesignPreset(designDraft),
                                      },
                                    }))
                                  }
                                  setShowNodeEditor(false)
                                  setActiveCanvasNodeId("")
                                }}
                              disabled={saving || loadingEditData}
                            >
                              Save
                            </Button>
                            <Button
                              variant="destructive"
                              className="cursor-pointer"
                              type="button"
                              onClick={() => {
                                removeSelectedNodeFromCanvas()
                              }}
                              disabled={saving || loadingEditData}
                            >
                              Remove Node
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {!selectedBlueprint ? (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/95 px-5 py-4 text-center shadow-sm">
                        <p className="text-sm font-semibold text-slate-800">Canvas is waiting for a blueprint</p>
                        <p className="mt-1 text-xs text-slate-500">Select a blueprint from top bar, then add nodes.</p>
                      </div>
                    </div>
                  ) : null}
                </div>               
              </div>

              {showNodes && edgeNodeOptions.length > 1 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Connection Manager</p>
                  <p className="mt-1 text-xs text-slate-600">Drag from one node handle to another to connect, or use the controls below to add, edit, and delete links.</p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">From Node</Label>
                      <Select value={newConnectionSource || "none"} onValueChange={(v) => setNewConnectionSource(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select source</SelectItem>
                          {edgeNodeOptions.map((node) => (
                            <SelectItem key={node.id} value={node.id}>{node.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">To Node</Label>
                      <Select value={newConnectionTarget || "none"} onValueChange={(v) => setNewConnectionTarget(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Select target" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select target</SelectItem>
                          {edgeNodeOptions.map((node) => (
                            <SelectItem key={node.id} value={node.id}>{node.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      className="h-8 cursor-pointer"
                      onClick={() => {
                        if (!newConnectionSource || !newConnectionTarget) {
                          setError("Select source and target node to create a connection.")
                          return
                        }
                        createCanvasConnection(newConnectionSource, newConnectionTarget)
                      }}
                    >
                      Add Connection
                    </Button>
                  </div>

                  <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {edges.length === 0 ? (
                      <p className="text-xs text-slate-500">No connections yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {edges.map((edge) => {
                          const sourceLabel = edgeNodeOptions.find((n) => n.id === edge.source)?.label || edge.source
                          const targetLabel = edgeNodeOptions.find((n) => n.id === edge.target)?.label || edge.target

                          return (
                            <div key={edge.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">
                              <div className="min-w-0 truncate text-slate-700">{sourceLabel} -&gt; {targetLabel}</div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 cursor-pointer px-2"
                                  onClick={() => removeConnectionById(edge.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-wrap">
                {flowSummaryText(nodes, edges)}
              </div>
              {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
              {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div> : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog
        open={isRemoveDialogOpen}
        onOpenChange={(open) => {
          setIsRemoveDialogOpen(open)
          if (!open) setPendingRemoveNode(null)
        }}
      >
        <DialogContent showCloseButton={false} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 sm:max-w-sm">
          <DialogHeader className="space-y-2 px-5 pt-5 pb-0">
            <DialogTitle className="text-base font-semibold text-slate-900">Remove node from canvas?</DialogTitle>
            <DialogDescription>
              {`Are you sure you want to remove ${pendingRemoveNode?.title || "this node"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 mt-4 rounded-b-2xl border-slate-200 bg-slate-50 px-5 py-4">
            <Button
              type="button"
              className="cursor-pointer" 
              variant="outline"
              onClick={() => {
                setIsRemoveDialogOpen(false)
                setPendingRemoveNode(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer" 
              variant="destructive"
              onClick={confirmRemoveNodeFromCanvas}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
