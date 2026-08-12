"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import {
  createTenantAgent,
  fetchTenantAgent,
  fetchTenantAgentAssignment,
  fetchTenantUsers,
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
  type ConnectionLineComponentProps,
  Controls,
  EdgeLabelRenderer,
  NodeResizer,
  getStraightPath,
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
  MiniMap,
} from "reactflow"
import "reactflow/dist/style.css"
import { Cpu, MessageSquare, Play, Plus, Settings, Shield, Trash, Trash2, X } from "lucide-react"

type TenantUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  isActive?: boolean | null
}

type AiProvider = "" | "openai" | "openrouter"
type ConfigNodeType =
  | "service"
  | "runtime"
  | "prompt"
  | "access"

type FlowNodeData = {
  label: string
  hint?: string
  kind?: ConfigNodeType
  isFirst?: boolean
  isStart?: boolean
  shape?: NodeShape
  tone?: NodeTone
}

type NodeShape = "rounded" | "pill" | "square" | "diamond" | "circle"
type NodeTone = "slate" | "cyan" | "emerald" | "amber" | "rose" | "indigo" | "violet" | "teal" | "orange" | "lime"
type NodeDesignPreset = "card" | "compact" | "outlined" | "custom"
type NodeOverride = Partial<FlowNodeData> & {
  style?: CSSProperties
  designPreset?: NodeDesignPreset
  position?: { x: number; y: number }
}

type DeletableEdgeData = {
  showDelete?: boolean
  onDelete?: () => void
  sourceColor?: string
  targetColor?: string
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
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })
  const gradientId = `edge-gradient-${id}`
  const gradientStyle = {
    ...(style || {}),
    stroke: `url(#${gradientId})`,
    strokeDasharray: "none",
  }

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={data?.sourceColor || "#475569"} />
          <stop offset="100%" stopColor={data?.targetColor || "#475569"} />
        </linearGradient>
      </defs>
      <BaseEdge id={id} path={edgePath} style={gradientStyle} />
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
            <Trash2 className="h-4 w-4"/>
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const styleFromDesignPreset = (preset: NodeDesignPreset): CSSProperties | undefined => {
  if (preset === "card") {
    return { borderRadius: 14, width: 220 }
  }
  if (preset === "compact") {
    return { borderRadius: 8, width: 160 }
  }
  if (preset === "outlined") {
    return { borderRadius: 14, width: 220, borderStyle: "dashed", borderWidth: 2 }
  }
  return undefined
}

type AgentCategory = "gmail" | "crm" | "support" | "calendar" | "knowledge" | "automation" | "general"
type WorkflowType = "mastra"

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  gmail: "Gmail",
  crm: "CRM",
  support: "Support",
  calendar: "Calendar",
  knowledge: "Knowledge",
  automation: "Automation",
  general: "General",
}

const DEFAULT_INSTRUCTION_PROMPTS: Record<AgentCategory, string> = {
  gmail:
    "You are a tenant Gmail assistant. Analyze incoming emails, classify intent, and return clear next actions in strict JSON. Do not send, delete, or modify mailbox data unless explicitly requested.",
  crm:
    "You are a tenant CRM assistant. Extract customer updates, opportunities, and risks from inputs, then return structured CRM-ready summaries and action items.",
  support:
    "You are a tenant support assistant. Identify issue type, urgency, and recommended response steps. Return concise, structured outputs suitable for support workflows.",
  calendar:
    "You are a tenant calendar assistant. Propose meeting actions, schedule suggestions, and conflict notes with clear timezone-aware details.",
  knowledge:
    "You are a tenant knowledge assistant. Retrieve and summarize relevant internal knowledge, cite key facts, and highlight confidence or missing information.",
  automation:
    "You are a tenant automation assistant. Convert requests into safe, step-by-step automation actions with validations, assumptions, and expected outputs.",
  general:
    "You are a tenant AI assistant. Follow tenant policy, provide accurate structured responses, and ask for clarification when key inputs are missing.",
}

const resolveInstructionPrompt = (input: {
  tenantPrompt: string
  serviceType: AgentCategory
}): { prompt: string; isDefault: boolean } => {
  const tenantPrompt = String(input.tenantPrompt || "").trim()
  if (tenantPrompt) {
    return { prompt: tenantPrompt, isDefault: false }
  }

  const baseDefault =
    DEFAULT_INSTRUCTION_PROMPTS[input.serviceType] || DEFAULT_INSTRUCTION_PROMPTS.general

  return {
    prompt: baseDefault,
    isDefault: true,
  }
}

const NODE_TONE_BY_KIND: Record<ConfigNodeType, NodeTone> = {
  service: "emerald",
  runtime: "amber",
  prompt: "cyan",
  access: "rose",
}

const EDGE_COLOR_BY_TONE: Record<NodeTone, string> = {
  slate: "#64748b",
  cyan: "#06b6d4",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  teal: "#14b8a6",
  orange: "#fb923c",
  lime: "#84cc16",
}

const ColoredConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
  fromNode,
}: ConnectionLineComponentProps) => {
  const sourceTone = (fromNode?.data?.tone as NodeTone | undefined) || "slate"
  const sourceColor = EDGE_COLOR_BY_TONE[sourceTone]
  const targetColor = sourceColor
  const [path] = getStraightPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  })
  const gradientId = `connection-preview-${String(sourceTone)}`

  return (
    <g>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
        >
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  )
}

const FLOW_NODE_LIBRARY: Array<{
  kind: ConfigNodeType
  title: string
  description: string
  required?: boolean
}> = [
  {
    kind: "runtime",
    title: "Agent Config",
    description: "AI provider and model settings.",
    required: true,
  },
  {
    kind: "prompt",
    title: "Instruction Prompt",
    description: "Behavior instruction for the agent.",
  },
  {
    kind: "access",
    title: "Access & Assignment",
    description: "Role permissions, meeting automation, and user assignment.",
    required: true,
  },
]

const REQUIRED_FLOW_NODES: ConfigNodeType[] = [
  "runtime",
  "access",
]

const AI_MODEL_OPTIONS: Record<"openai" | "openrouter", string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  openrouter: ["openrouter/auto", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-flash"],
}

const USERS_CACHE = new Map<string, TenantUser[]>()
const USERS_IN_FLIGHT = new Map<string, Promise<TenantUser[]>>()

const tenantCacheKey = (tenantId: string) => String(tenantId || "__default__")

const extractBackendMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return ""

  const direct = payload as { message?: unknown }
  if (typeof direct.message === "string" && direct.message.trim()) {
    return direct.message.trim()
  }

  const nested = payload as { data?: { message?: unknown } }
  if (nested.data && typeof nested.data.message === "string" && nested.data.message.trim()) {
    return nested.data.message.trim()
  }

  return ""
}

const formatUserName = (user: TenantUser): string => {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return full || String(user.email || "User")
}

const flowSummaryText = (nodes: FlowNode<FlowNodeData>[], edges: Edge[]): string => {
  if (!nodes.length) {
    return "Canvas is blank. Add nodes to start building the flow."
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
    serviceType: AgentCategory
    aiProvider: AiProvider
    aiModel: string
    systemPrompt: string
    managerCanRun: boolean
    memberCanRun: boolean
    isActive: boolean
    assignedCount: number
  },
): { label: string; hint: string } => {
  if (kind === "runtime") {
    return {
      label:
        values.aiProvider && values.aiModel
          ? `Agent Config: ${values.aiProvider} / ${values.aiModel}`
          : "Agent config",
      hint: "Provider and model configuration",
    }
  }
  if (kind === "prompt") {
    const hasTenantPrompt = Boolean(values.systemPrompt.trim())
    return {
      label: "Instruction prompt",
      hint: hasTenantPrompt
        ? "Tenant instruction prompt configured"
        : `Using default ${CATEGORY_LABEL[values.serviceType]} instruction prompt`,
    }
  }
  if (kind === "access") {
    return {
      label: `Permissions: Mgr ${values.managerCanRun ? "yes" : "no"}, Member ${values.memberCanRun ? "yes" : "no"}`,
      hint:
        values.assignedCount > 0
          ? `${values.assignedCount} users assigned, active ${values.isActive ? "yes" : "no"}`
          : `No users assigned, active ${values.isActive ? "yes" : "no"}`,
    }
  }
  return { label: "Configuration", hint: "Update node settings" }
}

const buildCanvasGraph = (input: {
  kinds: ConfigNodeType[]
  values: {
    name: string
    serviceType: AgentCategory
    aiProvider: AiProvider
    aiModel: string
    systemPrompt: string
    managerCanRun: boolean
    memberCanRun: boolean
    isActive: boolean
    assignedCount: number
  }
}): { nodes: FlowNode<FlowNodeData>[]; edges: Edge[] } => {
  const nodes: FlowNode<FlowNodeData>[] = []

  nodes.push({
    id: "cfg_start",
    type: "config",
    position: { x: 120, y: 120 },
    data: {
      label: "Start",
      hint: "Connect to first node",
      isStart: true,
      tone: "indigo",
    },
    style: { borderRadius: 18, border: "1px solid #c7d2fe", background: "#eef2ff", width: 180 },
  })

  input.kinds.forEach((kind, index) => {
    const info = nodeLabelForKind(kind, input.values)
    const x = 380 + index * 240
    const id = `cfg_${kind}`

    nodes.push({
      id,
      type: "config",
      position: { x, y: 120 },
      data: {
        label: info.label,
        hint: info.hint,
        kind,
        isFirst: index === 0,
        isStart: false,
        tone: NODE_TONE_BY_KIND[kind],
      },
      style: { borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", width: 220 },
    })

  })

  return { nodes, edges: [] }
}

export default function TenantAgentCreatePage() {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)
  const tenantId = String(tenantProfile?.id || "")
  const editingAgentId = String(searchParams.get("agentId") || "").trim()
  const isEditMode = Boolean(editingAgentId)
  const [workingAgentId, setWorkingAgentId] = useState<string>(editingAgentId)
  const workingAgentIdRef = useRef<string>(editingAgentId)

  const [users, setUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingEditData, setLoadingEditData] = useState(false)

  const [name, setName] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [agentSkill, setAgentSkill] = useState("")
  const [agentInstruction, setAgentInstruction] = useState("")
  const [aiProvider, setAiProvider] = useState<AiProvider>("")
  const [aiModel, setAiModel] = useState("")
  const [managerCanRun, setManagerCanRun] = useState(true)
  const [memberCanRun, setMemberCanRun] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [serviceType, setServiceType] = useState<AgentCategory>("general")
  const [workflowType, setWorkflowType] = useState<WorkflowType>("mastra")
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState("")

  const [flowNodeKinds, setFlowNodeKinds] = useState<ConfigNodeType[]>([])
  const [showNodePicker, setShowNodePicker] = useState(false)
  const [activeCanvasNodeId, setActiveCanvasNodeId] = useState<string>("")
  const nodePickerRef = useRef<HTMLDivElement | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const nodesRef = useRef<FlowNode<FlowNodeData>[]>([])

  const [selectedEdgeType, setSelectedEdgeType] = useState<string>("straight")
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, NodeOverride>>({})
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string>("")
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("")
  const hoveredEdgeIdRef = useRef<string>("")
  const selectedEdgeIdRef = useRef<string>("")
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

  useEffect(() => {
    setWorkingAgentId(editingAgentId)
    workingAgentIdRef.current = editingAgentId
  }, [editingAgentId])

  useEffect(() => {
    workingAgentIdRef.current = workingAgentId
  }, [workingAgentId])

  const syncAgentIdInUrl = useCallback((agentId: string) => {
    const normalizedAgentId = String(agentId || "").trim()
    if (!normalizedAgentId) return

    const currentPath = String(pathname || "/tenant/agents/create")
    const queryText = searchParams ? searchParams.toString() : ""
    const params = new URLSearchParams(queryText)
    params.set("agentId", normalizedAgentId)

    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `${currentPath}?${nextQuery}` : currentPath
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!isEditMode) {
      setFlowNodeKinds([])
      setActiveCanvasNodeId("")
    }
  }, [isEditMode])

  useEffect(() => {
    setShowNodes(true)
  }, [])

  const loadUsers = useCallback(async () => {
    const key = tenantCacheKey(tenantId)
    const cached = USERS_CACHE.get(key)
    if (cached) {
      setUsers(cached)
      return
    }

    setLoadingUsers(true)
    const pending = USERS_IN_FLIGHT.get(key)

    try {
      const rows = pending
        ? await pending
        : await (() => {
            const request = (dispatch(fetchTenantUsers()) as Promise<unknown>)
              .then((result) => (Array.isArray(result) ? (result as TenantUser[]) : []))
            USERS_IN_FLIGHT.set(key, request)
            return request
          })()

      USERS_CACHE.set(key, rows)
      setUsers(rows)
    } finally {
      setLoadingUsers(false)
      USERS_IN_FLIGHT.delete(key)
    }
  }, [dispatch, tenantId])

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
        setSystemPrompt(String(agent?.systemPrompt || ""))
        setAgentSkill(String(agent?.agentSkill || ""))
        setAgentInstruction(String(agent?.agentInstruction || ""))
        setIsActive(Number(assignmentRow.isActive ?? agent?.isActive ?? 1) !== 0)

        const aiProviderValue =
          assignmentRow.aiProvider === "openrouter" ? "openrouter" : assignmentRow.aiProvider === "openai" ? "openai" : ""
        setAiProvider(aiProviderValue)
        setAiModel(String(assignmentRow.aiModel || ""))
        setManagerCanRun(Boolean(assignmentRow.managerCanRun ?? true))
        setMemberCanRun(Boolean(assignmentRow.memberCanRun ?? false))
        setServiceType(normalizeCategory(String(agent?.serviceType || "general")))
        setWorkflowType("mastra")
        setAssignedUserIds(
          Array.isArray(assignmentRow.assignedUserIds)
            ? assignmentRow.assignedUserIds.map((value: unknown) => String(value || "")).filter(Boolean)
            : [],
        )

        const initialKinds: ConfigNodeType[] = [
          "runtime",
          "access",
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

  const isActiveToggleDisabled = useMemo(() => {
    if (!tenantId) return true
    if (loadingEditData) return true
    if (loadingUsers) return true
    return false
  }, [tenantId, loadingEditData, loadingUsers])

  const generatedGraph = useMemo(
    () =>
      buildCanvasGraph({
        kinds: flowNodeKinds,
        values: {
          name,
          serviceType,
          aiProvider,
          aiModel,
          systemPrompt,
          managerCanRun,
          memberCanRun,
          isActive,
          assignedCount: assignedUserIds.length,
        },
      }),
    [
      flowNodeKinds,
      name,
      serviceType,
      aiProvider,
      aiModel,
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

  const addedNodeTemplates = useMemo(
    () => FLOW_NODE_LIBRARY.filter((node) => flowNodeKinds.includes(node.kind)),
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
    hoveredEdgeIdRef.current = hoveredEdgeId
  }, [hoveredEdgeId])

  useEffect(() => {
    selectedEdgeIdRef.current = selectedEdgeId
  }, [selectedEdgeId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      const edgeToDelete = selectedEdgeIdRef.current || hoveredEdgeIdRef.current
      if (!edgeToDelete) return

      event.preventDefault()
      removeConnectionById(edgeToDelete)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

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
          strokeDasharray: undefined,
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

  const removeConnectionById = useCallback((edgeId: string) => {
    if (!edgeId) return

    setEdges((prev) => prev.filter((edge) => edge.id !== edgeId))
    setHoveredEdgeId((current) => (current === edgeId ? "" : current))
    setSelectedEdgeId((current) => (current === edgeId ? "" : current))
    if (hoveredEdgeIdRef.current === edgeId) hoveredEdgeIdRef.current = ""
    if (selectedEdgeIdRef.current === edgeId) selectedEdgeIdRef.current = ""
    setSuccess("Connection removed.")
    setError(null)
  }, [setEdges])

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
    const resolvedInstruction = resolveInstructionPrompt({
      tenantPrompt: systemPrompt,
      serviceType,
    })

    const flowSummary = flowSummaryText(nodes, edges)
    return [
      resolvedInstruction.prompt,
      agentSkill.trim() ? `Agent Skill:\n${agentSkill.trim()}` : "",
      agentInstruction.trim() ? `User Instruction:\n${agentInstruction.trim()}` : "",
      "",
      resolvedInstruction.isDefault
        ? `Prompt Source: default (${CATEGORY_LABEL[serviceType]})`
        : "Prompt Source: tenant",
      `Tenant scope: ${tenantId}`,
      `Flow: ${flowSummary}`,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const currentAllowedCollections = () =>
    []

  const createAgent = async () => {
    setError(null)
    setSuccess(null)

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


    setSaving(true)
    try {
      const provider = aiProvider || "openai"
      const model = aiModel.trim() || AI_MODEL_OPTIONS[provider][0]
      if (!aiProvider) setAiProvider(provider)
      if (!aiModel.trim()) setAiModel(model)

      const existingWorkingAgentId = String(workingAgentIdRef.current || workingAgentId || "").trim()
      let agentId = existingWorkingAgentId
      let backendMessage = ""

      if (!agentId) {
        const createResp = await (dispatch(
          createTenantAgent({
            name: safeName,
            systemPrompt: buildFinalPrompt(),
            agentSkill: agentSkill.trim(),
            agentInstruction: agentInstruction.trim(),
            topK: 6,
            isActive: isActive ? 1 : 0,
            allowedCollections: currentAllowedCollections(),
          }),
        ) as Promise<{ agent?: { id?: string } }>)

        agentId = String(createResp?.agent?.id || "").trim()
        if (!agentId) {
          throw new Error("Agent id missing from create response.")
        }

        setWorkingAgentId(agentId)
        workingAgentIdRef.current = agentId
        syncAgentIdInUrl(agentId)
        backendMessage = extractBackendMessage(createResp)
      }

      const coreResp = await (dispatch(
        updateTenantAgent({
          agentId,
          name: safeName,
          systemPrompt: buildFinalPrompt(),
          agentSkill: agentSkill.trim(),
          agentInstruction: agentInstruction.trim(),
          isActive: isActive ? 1 : 0,
          topK: 6,
          allowedCollections: currentAllowedCollections(),
        }),
      ) as Promise<unknown>)
      const coreMessage = extractBackendMessage(coreResp)

      const assignmentResp = await (dispatch(
        upsertTenantAgentAssignment({
          agentId,
          aiProvider: provider,
          aiModel: model,
          managerCanRun: true,
          memberCanRun: true,
          assignedUserIds,
          meetingAutomationEnabled: true,
          meetingCreationMode: "auto",
        }),
      ) as Promise<unknown>)
      const assignmentMessage = extractBackendMessage(assignmentResp)

      const fallbackMessage = existingWorkingAgentId
        ? "Agent updated and saved to database."
        : "Agent created and saved to database."

      setSuccess(assignmentMessage || coreMessage || backendMessage || fallbackMessage)
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

  const missingRequiredNodeKinds = useMemo(
    () => REQUIRED_FLOW_NODES.filter((kind) => !flowNodeKinds.includes(kind)),
    [flowNodeKinds],
  )

  const createButtonDisabled = useMemo(() => {
    if (saving || loadingEditData) return true
    if (!name.trim()) return true
    if (!aiProvider) return true
    if (!aiModel.trim()) return true
    // For a new agent, enforce required canvas nodes before allowing create.
    if (!workingAgentId && missingRequiredNodeKinds.length > 0) return true
    return false
  }, [saving, loadingEditData, name, aiProvider, aiModel, workingAgentId, missingRequiredNodeKinds])

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
      indigo: "border-indigo-300 bg-indigo-50 text-indigo-900",
      violet: "border-violet-300 bg-violet-50 text-violet-900",
      teal: "border-teal-300 bg-teal-50 text-teal-900",
      orange: "border-orange-300 bg-orange-50 text-orange-900",
      lime: "border-lime-300 bg-lime-50 text-lime-900",
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

    const handleColor = EDGE_COLOR_BY_TONE[tone]

    const getNodeIcon = () => {
      if (data?.isStart) return <Play className="h-5 w-5" aria-hidden="true" />
      if (data?.kind === "runtime") return <Cpu className="h-5 w-5" aria-hidden="true" />
      if (data?.kind === "prompt") return <MessageSquare className="h-5 w-5" aria-hidden="true" />
      if (data?.kind === "access") return <Shield className="h-5 w-5" aria-hidden="true" />
      return <Play className="h-5 w-5" aria-hidden="true" />
    }

    const getNodeIconBadgeClass = () => {
      if (data?.isStart) return "bg-indigo-600"
      if (data?.kind === "runtime") return "bg-amber-600"
      if (data?.kind === "prompt") return "bg-sky-600"
      if (data?.kind === "access") return "bg-rose-600"
      return "bg-slate-600"
    }

    const requestNodeRemove = (nodeId: string) => {
      const resolvedKind =
        data?.kind
        || (nodeId.startsWith("cfg_") ? (nodeId.slice(4) as ConfigNodeType) : undefined)

      if (!resolvedKind || !FLOW_NODE_LIBRARY.some((item) => item.kind === resolvedKind)) {
        return
      }

      const nodeMeta = FLOW_NODE_LIBRARY.find((item) => item.kind === resolvedKind)
      setPendingRemoveNode({
        nodeId,
        kind: resolvedKind,
        title: nodeMeta?.title || "this node",
      })
      setIsRemoveDialogOpen(true)
    }

    return (
      <div style={style as any} className={`group relative border p-3 shadow-sm ${toneClass[tone]} ${shapeClass[shape]}`}>
        <NodeResizer
          isVisible={Boolean(selected)}
          minWidth={140}
          minHeight={80}
          lineClassName="border-cyan-500"
          handleClassName="h-2.5 w-2.5 rounded-sm border border-cyan-700 bg-cyan-400"
        />
        {!data?.isStart ? (
          <button
            type="button"
            className="absolute left-1/2 top-0 z-20 inline-flex -translate-x-1/2 -translate-y-[125%] items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-red-600 opacity-0 shadow-md transition-opacity hover:bg-red-50 group-hover:opacity-100 cursor-pointer"
            onClick={(event) => {
              event.stopPropagation()
              requestNodeRemove(id)
            }}
            aria-label="Delete node"
            title="Delete node"
          >
            <Trash2 className="h-4 w-4" />
            {/* Delete */}
          </button>
        ) : null}
        {!data?.isStart ? (
          <Handle
            type="target"
            position={Position.Left}
            style={{
              width: 12,
              height: 12,
              background: handleColor,
              border: "2px solid #ffffff",
              boxShadow: "0 0 0 1px rgba(15,23,42,0.35)",
            }}
          />
        ) : null}
        <div className={shape === "diamond" ? "-rotate-45" : ""}>
          <div
            className={`flex text-base font-semibold leading-tight ${data?.isStart ? "items-center justify-center gap-3 text-center" : "items-center gap-2"}`}
          >
            <span className={`inline-flex items-center justify-center rounded-md p-1.5 text-white ${getNodeIconBadgeClass()}`}>
              {getNodeIcon()}
            </span>
            <span>{data?.label}</span>
          </div>
          {!data?.isStart ? <div className="mt-1 text-xs opacity-80">{data?.hint}</div> : null}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 12,
            height: 12,
            background: handleColor,
            border: "2px solid #ffffff",
            boxShadow: "0 0 0 1px rgba(15,23,42,0.35)",
          }}
        />
      </div>
    )
  }

  const nodeTypes = useMemo(() => ({ config: ConfigNode }), [nodeOverrides])

  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), [])

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const sourceTone = (nodes.find((node) => node.id === edge.source)?.data?.tone as NodeTone | undefined) || "slate"
        const targetTone = (nodes.find((node) => node.id === edge.target)?.data?.tone as NodeTone | undefined) || "slate"

        return {
          ...edge,
          type: "deletable",
          markerStart: undefined,
          markerEnd: undefined,
          style: {
            ...(edge.style || {}),
            strokeDasharray: "none",
          },
          data: {
            ...(edge.data as DeletableEdgeData | undefined),
            showDelete: hoveredEdgeId === edge.id || selectedEdgeId === edge.id,
            onDelete: () => removeConnectionById(edge.id),
            sourceColor: EDGE_COLOR_BY_TONE[sourceTone],
            targetColor: EDGE_COLOR_BY_TONE[targetTone],
          },
        }
      }),
    [edges, hoveredEdgeId, nodes, selectedEdgeId],
  )

  const [showNodeEditor, setShowNodeEditor] = useState(false)
  const [showNodes, setShowNodes] = useState(true)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    if (!showNodeEditor || !activeCanvasNodeId) return

    const override = nodeOverrides[activeCanvasNodeId]
    const activeNode = nodesRef.current.find((node) => node.id === activeCanvasNodeId)
    const activeNodeData = activeNode?.data as FlowNodeData | undefined
    setDesignDraft((override?.designPreset || "card") as NodeDesignPreset)
    setShapeDraft((override?.shape || activeNodeData?.shape || "rounded") as NodeShape)
    setToneDraft((override?.tone || activeNodeData?.tone || "slate") as NodeTone)
  }, [showNodeEditor, activeCanvasNodeId, nodeOverrides])

  useEffect(() => {
    if (!showNodeEditor) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showNodeEditor])

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
                    ? "Edit nodes in canvas. Use Save Agent (top-right) to persist all changes to database."
                    : "Build your agent in a canvas-first workflow. Add required nodes, configure settings, then publish."}
                </p>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-[minmax(260px,1fr)_auto] sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Agent Name</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-10 w-full"
                    placeholder="Enter agent name"
                  />
                </div>

              </div>

              {/* <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">Nodes: {flowNodeKinds.length}</Badge>
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Assigned: {assignedUserIds.length}</Badge>
                {activeNodeMeta ? (
                  <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">Active: {activeNodeMeta.title}</Badge>
                ) : null}
                {loadingEditData ? <Badge variant="outline">Loading agent...</Badge> : null}
              </div> */}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/tenant/agents" prefetch={false}>
                <Button variant="outline" className="cursor-pointer">Back to Agents</Button>
              </Link>
              <Button
                className="cursor-pointer bg-cyan-700 hover:bg-cyan-800"
                disabled={createButtonDisabled}
                onClick={createAgent}
              >
                {saving
                  ? "Saving..."
                  : workingAgentId
                    ? "Save Agent"
                    : "Create Agent"}
              </Button>
              {/* {!workingAgentId && missingRequiredNodeKinds.length > 0 ? (
                <p className="text-xs text-amber-700">
                  Add required nodes first: {missingRequiredNodeKinds.map((kind) => FLOW_NODE_LIBRARY.find((item) => item.kind === kind)?.title || kind).join(", ")}
                </p>
              ) : null} */}
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
                      <div className="space-y-3">
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Add New Node</p>
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
                                >
                                  <p className="text-sm font-semibold text-slate-900">{node.title}</p>
                                  <p className="mt-1 text-xs text-slate-600">{node.description}</p>
                                  {node.required ? <p className="mt-1 text-[11px] font-medium text-cyan-700">Required</p> : null}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Edit Existing Node</p>
                          {addedNodeTemplates.length === 0 ? (
                            <p className="text-xs text-slate-500">No nodes added yet.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {addedNodeTemplates.map((node) => (
                                <div
                                  key={`edit_${node.kind}`}
                                  className="rounded-xl border border-slate-200 bg-white p-3"
                                >
                                  <p className="text-sm font-semibold text-slate-900">{node.title}</p>
                                  <p className="mt-1 text-xs text-slate-600">{node.description}</p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 h-7 cursor-pointer"
                                    onClick={() => {
                                      setActiveCanvasNodeId(`cfg_${node.kind}`)
                                      setShowNodeEditor(true)
                                      setShowNodePicker(false)
                                    }}
                                  >
                                    Edit Node
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div> */}
                      </div>
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
                    connectionLineComponent={ColoredConnectionLine}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={(_, node) => {
                      setActiveCanvasNodeId(node.id)
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
                    onEdgeClick={(_, edge) => {
                      removeConnectionById(edge.id)
                    }}
                    onEdgeDoubleClick={(_, edge) => {
                      removeConnectionById(edge.id)
                    }}
                    onPaneClick={() => {
                      setHoveredEdgeId("")
                      setSelectedEdgeId("")
                    }}
                  >
                    <Controls />
                    <MiniMap />
                    <Background gap={20} size={1.1} color="#cbd5e1" />
                  </ReactFlow>

                  {showNodeEditor && activeNodeKind ? (
                    <div className="fixed inset-0 z-120 grid place-items-center bg-slate-900/20 p-3">
                      <div className="flex max-h-[92vh] w-[min(640px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">Edit: {activeNodeMeta?.title}</h4>
                            <p className="text-xs text-slate-500">
                              Edit settings for the selected node.
                              {" Save updates this node in canvas only. Use top-right Save Agent to persist to database."}
                            </p>
                          </div>
                          <div>
                            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setShowNodeEditor(false)}><X /></Button>
                          </div>
                        </div>

                        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:auto] [scrollbar-color:#64748b_#e2e8f0] [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-slate-200">
                          {activeNodeKind === "runtime" ? (
                            <div className="space-y-2">
                              <p className="text-[11px] font-medium text-slate-600">AI Configuration</p>
                              <Label className="text-xs">Provider</Label>
                              <Select value={aiProvider || "none"} onValueChange={(v) => onProviderChange(v)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent className="z-220">
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
                                <SelectContent className="z-220">
                                  {(aiProvider ? AI_MODEL_OPTIONS[aiProvider] : []).map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          {activeNodeKind === "prompt" ? (
                            <div className="space-y-2">
                              <Label className="text-xs">Instruction Prompt</Label>
                              {/* {!systemPrompt.trim() ? (
                                <p className="text-[11px] text-amber-700">
                                  Tenant prompt is empty. A default {CATEGORY_LABEL[serviceType]} prompt will be applied automatically.
                                </p>
                              ) : null} */}
                              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                              <Label className="text-xs">Agent Skill</Label>
                              <Textarea value={agentSkill} onChange={(e) => setAgentSkill(e.target.value)} />
                              <Label className="text-xs">User Instruction</Label>
                              <Textarea value={agentInstruction} onChange={(e) => setAgentInstruction(e.target.value)} />
                            </div>
                          ) : null}

                          {activeNodeKind === "access" ? (
                            <div className="space-y-2">
                              <p className="text-[11px] font-medium text-slate-600">Status</p>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Active</Label>
                                <Switch
                                  checked={isActive}
                                  disabled={isActiveToggleDisabled}
                                  onCheckedChange={(v) => setIsActive(Boolean(v))}
                                />
                              </div>
                              {isActiveToggleDisabled ? (
                                <p className="text-[11px] text-slate-500">Active status is disabled until tenant details finish loading.</p>
                              ) : null}

                              <p className="text-[11px] font-medium text-slate-600">Role Permissions</p>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Manager can run</Label>
                                <Switch checked={managerCanRun} onCheckedChange={(v) => setManagerCanRun(Boolean(v))} />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Member can run</Label>
                                <Switch checked={memberCanRun} onCheckedChange={(v) => setMemberCanRun(Boolean(v))} />
                              </div>

                              <p className="pt-1 text-[11px] font-medium text-slate-600">User Assignment</p>
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
                              <div className="text-[11px] text-slate-500">
                                User assignment is saved when you click Save.
                              </div>
                            </div>
                            </div>
                          ) : null}

                        </div>

                        <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white pt-3">
                          <Button
                            variant="outline"
                            className="cursor-pointer" 
                            onClick={() => {
                              setShowNodeEditor(false)
                              setActiveCanvasNodeId("")
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="cursor-pointer" 
                            onClick={() => {
                                setError(null)
                                setSuccess(null)

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
                                setSuccess(`${activeNodeMeta?.title || "Section"} updated in canvas. Click Save Agent to persist.`)
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