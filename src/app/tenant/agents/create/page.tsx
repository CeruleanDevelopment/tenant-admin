"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, CreditCard, FileText, Shield, Sparkles, Users } from "lucide-react"
import { cn } from "@/lib/utils"

type TenantUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  isActive?: boolean | null
}

type AiProvider = "" | "openai" | "openrouter"
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

const AI_MODEL_OPTIONS: Record<"openai" | "openrouter", string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  openrouter: ["openrouter/auto", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-flash"],
}

const USERS_CACHE = new Map<string, TenantUser[]>()
const USERS_IN_FLIGHT = new Map<string, Promise<TenantUser[]>>()

const tenantCacheKey = (tenantId: string) => String(tenantId || "__default__")

const resolveInstructionPrompt = (input: { tenantPrompt: string; serviceType: AgentCategory }) => {
  const tenantPrompt = String(input.tenantPrompt || "").trim()
  if (tenantPrompt) {
    return { prompt: tenantPrompt, isDefault: false }
  }

  const baseDefault = DEFAULT_INSTRUCTION_PROMPTS[input.serviceType] || DEFAULT_INSTRUCTION_PROMPTS.general
  return { prompt: baseDefault, isDefault: true }
}

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

const wizardSteps = [
  {
    id: 1,
    title: "Basics",
    description: "Name, category, and workflow setup.",
    icon: FileText,
  },
  {
    id: 2,
    title: "AI + Prompt",
    description: "Provider, model, and instructions.",
    icon: Sparkles,
  },
  {
    id: 3,
    title: "Access",
    description: "Permissions and user assignment.",
    icon: Shield,
  },
] as const

const stepNumberClasses = (active: boolean, complete: boolean) =>
  complete
    ? "border-emerald-500 bg-emerald-500 text-white"
    : active
      ? "border-cyan-600 bg-cyan-600 text-white shadow-lg shadow-cyan-200"
      : "border-slate-200 bg-white text-slate-500"

const stepTrackerIcon = (step: number) => {
  if (step === 1) return FileText
  if (step === 2) return Sparkles
  return Shield
}

export default function TenantAgentCreatePage() {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)
  const tenantId = String(tenantProfile?.id || "")
  const editingAgentId = String(searchParams?.get("agentId") || "").trim()
  const isEditMode = Boolean(editingAgentId)

  const [workingAgentId, setWorkingAgentId] = useState<string>(editingAgentId)
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingEditData, setLoadingEditData] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const [name, setName] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [agentSkill, setAgentSkill] = useState("")
  const [agentInstruction, setAgentInstruction] = useState("")
  const [aiProvider, setAiProvider] = useState<AiProvider>("")
  const [aiModel, setAiModel] = useState("")
  const [managerCanRun, setManagerCanRun] = useState(true)
  const [userCanRun, setUserCanRun] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [serviceType, setServiceType] = useState<AgentCategory>("general")
  const [workflowType, setWorkflowType] = useState<WorkflowType>("mastra")
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState("")

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

  useEffect(() => {
    setWorkingAgentId(editingAgentId)
  }, [editingAgentId])

  useEffect(() => {
    if (!isEditMode) {
      setCurrentStep(1)
    }
  }, [isEditMode])

  const syncAgentIdInUrl = useCallback(
    (agentId: string) => {
      const normalizedAgentId = String(agentId || "").trim()
      if (!normalizedAgentId) return

      const currentPath = String(pathname || "/tenant/agents/create")
      const queryText = searchParams ? searchParams.toString() : ""
      const params = new URLSearchParams(queryText)
      params.set("agentId", normalizedAgentId)

      const nextQuery = params.toString()
      const nextUrl = nextQuery ? `${currentPath}?${nextQuery}` : currentPath
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams],
  )

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
            const request = (dispatch(fetchTenantUsers()) as Promise<unknown>).then((result) =>
              Array.isArray(result) ? (result as TenantUser[]) : [],
            )
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
        setUserCanRun(Boolean(assignmentRow.userCanRun ?? assignmentRow.memberCanRun ?? false))
        setServiceType(normalizeCategory(String(agent?.serviceType || "general")))
        setWorkflowType("mastra")
        setAssignedUserIds(
          Array.isArray(assignmentRow.assignedUserIds)
            ? assignmentRow.assignedUserIds.map((value: unknown) => String(value || "")).filter(Boolean)
            : [],
        )
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

  const canAdvanceFromStep = useCallback(
    (step: number) => {
      if (step === 1) {
        return Boolean(name.trim())
      }
      if (step === 2) {
        return Boolean(aiProvider && aiModel.trim())
      }
      return true
    },
    [aiModel, aiProvider, name],
  )

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

  const onProviderChange = (value: string) => {
    const provider = value === "openrouter" ? "openrouter" : value === "openai" ? "openai" : ""
    setAiProvider(provider)
    setAiModel(provider ? AI_MODEL_OPTIONS[provider][0] : "")
  }

  const buildFinalPrompt = () => {
    const resolvedInstruction = resolveInstructionPrompt({
      tenantPrompt: systemPrompt,
      serviceType,
    })

    return [
      resolvedInstruction.prompt,
      agentSkill.trim() ? `Agent Skill:\n${agentSkill.trim()}` : "",
      agentInstruction.trim() ? `User Instruction:\n${agentInstruction.trim()}` : "",
      "",
      resolvedInstruction.isDefault
        ? `Prompt Source: default (${CATEGORY_LABEL[serviceType]})`
        : "Prompt Source: tenant",
      `Tenant scope: ${tenantId}`,
      `Workflow: ${workflowType}`,
      `Category: ${CATEGORY_LABEL[serviceType]}`,
    ]
      .filter(Boolean)
      .join("\n")
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

    setSaving(true)
    try {
      const provider = aiProvider || "openai"
      const model = aiModel.trim() || AI_MODEL_OPTIONS[provider][0]
      if (!aiProvider) setAiProvider(provider)
      if (!aiModel.trim()) setAiModel(model)

      const existingWorkingAgentId = String(workingAgentId || "").trim()
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
            allowedCollections: [],
          }),
        ) as Promise<{ agent?: { id?: string } }>)

        agentId = String(createResp?.agent?.id || "").trim()
        if (!agentId) {
          throw new Error("Agent id missing from create response.")
        }

        setWorkingAgentId(agentId)
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
          allowedCollections: [],
        }),
      ) as Promise<unknown>)
      const coreMessage = extractBackendMessage(coreResp)

      const assignmentResp = await (dispatch(
        upsertTenantAgentAssignment({
          agentId,
          aiProvider: provider,
          aiModel: model,
          managerCanRun,
          userCanRun,
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

  const pageTitle = workingAgentId ? "Edit Agent" : "Create Agent"
  const pageDescription =
    "Use the three-step wizard to define the agent identity, configure its AI behavior, and assign access before saving."
  const finalButtonLabel = workingAgentId ? "Save Agent" : "Create Agent"
  const currentStepMeta = wizardSteps[currentStep - 1]
  const CurrentIcon = currentStepMeta.icon
  const TrackerStepIcon = stepTrackerIcon(currentStep)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(8,145,178,0.08),rgba(255,255,255,0))] px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Form Wizard</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-200">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Build your agent in three focused steps</h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    The canvas has been replaced with a guided form flow so the full agent definition stays easy to
                    review, edit, and save.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                <CurrentIcon className="mr-1.5 h-3.5 w-3.5" />
                {currentStepMeta.title}
              </Badge>
              {workingAgentId ? (
                <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Editing</Badge>
              ) : (
                <Badge className="rounded-full bg-cyan-50 text-cyan-700 hover:bg-cyan-50">New</Badge>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white px-4 py-5 sm:px-6">
            <div className="relative flex items-start justify-between gap-4">
              <div className="absolute left-0 top-6 h-0.5 w-full rounded-full bg-slate-200" />
              <div
                className="absolute left-0 top-6 h-1.5 rounded-full bg-cyan-600 transition-all duration-500"
                style={{ width: `${((currentStep - 1) / (wizardSteps.length - 1)) * 100}%` }}
              />

              {wizardSteps.map((step) => {
                const Icon = step.icon
                const active = currentStep === step.id
                const complete = currentStep > step.id

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (step.id === 1 || canAdvanceFromStep(step.id - 1) || currentStep > step.id) {
                        setCurrentStep(step.id)
                      }
                    }}
                    className="relative z-10 flex w-full flex-col items-center text-center"
                  >
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300", stepNumberClasses(active, complete))}>
                      {complete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <p className={cn("mt-4 text-sm font-medium transition-colors", active || complete ? "text-slate-900" : "text-slate-500")}>
                      {step.title}
                    </p>
                    <p className={cn("mt-1 max-w-48 text-xs transition-colors", active || complete ? "text-slate-600" : "text-slate-400")}>
                      {step.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-none">
          <CardHeader className="border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">Step {currentStep}</CardTitle>
                <CardDescription>{currentStepMeta.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setCurrentStep((value) => Math.max(1, value - 1))}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    className="cursor-pointer bg-cyan-700 hover:bg-cyan-800"
                    onClick={() => {
                      if (!canAdvanceFromStep(currentStep)) {
                        setError(currentStep === 1 ? "Agent name is required." : "AI provider and model are required.")
                        return
                      }
                      setError(null)
                      setCurrentStep((value) => Math.min(3, value + 1))
                    }}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="cursor-pointer bg-cyan-700 hover:bg-cyan-800"
                    disabled={saving || loadingEditData}
                    onClick={createAgent}
                  >
                    {saving ? "Saving..." : finalButtonLabel}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-5 py-6 sm:px-6">
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

              {currentStep === 1 ? (
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs font-medium text-slate-600">Agent Name</Label>
                        <Input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className="h-11 bg-white"
                          placeholder="Enter agent name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Category</Label>
                        <Select value={serviceType} onValueChange={(value) => setServiceType(normalizeCategory(value))}>
                          <SelectTrigger className="h-11 bg-white">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Workflow</Label>
                        <Select value={workflowType} onValueChange={(value) => setWorkflowType(value as WorkflowType)}>
                          <SelectTrigger className="h-11 bg-white">
                            <SelectValue placeholder="Select workflow" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mastra">Mastra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Agent active</p>
                        <p className="text-xs text-slate-500">Controls whether this agent is enabled when saved.</p>
                      </div>
                      <Switch checked={isActive} disabled={isActiveToggleDisabled} onCheckedChange={(value) => setIsActive(Boolean(value))} />
                    </div>

                    {isActiveToggleDisabled ? (
                      <p className="text-xs text-slate-500">Active status is disabled until tenant details finish loading.</p>
                    ) : null}
                  </div>

                  <div className="space-y-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5">
                    <div>
                      <p className="text-sm font-semibold text-cyan-900">Step 1 summary</p>
                      <p className="mt-1 text-sm text-cyan-900/80">
                        This section defines what the agent is and which workflow it uses.
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
                        <p className="mt-1 font-medium text-slate-900">{name.trim() || "Untitled agent"}</p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Category</p>
                        <p className="mt-1 font-medium text-slate-900">{CATEGORY_LABEL[serviceType]}</p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Workflow</p>
                        <p className="mt-1 font-medium text-slate-900">{workflowType}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">AI Provider</Label>
                        <Select value={aiProvider || "none"} onValueChange={(value) => onProviderChange(value === "none" ? "" : value)}>
                          <SelectTrigger className="h-11 bg-white">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select provider</SelectItem>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Model</Label>
                        <Select value={aiModel || "none"} onValueChange={(value) => setAiModel(value === "none" ? "" : value)}>
                          <SelectTrigger className="h-11 bg-white">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select model</SelectItem>
                            {(aiProvider ? AI_MODEL_OPTIONS[aiProvider] : []).map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600">Instruction Prompt</Label>
                      <Textarea
                        value={systemPrompt}
                        onChange={(event) => setSystemPrompt(event.target.value)}
                        className="min-h-30 bg-white"
                        placeholder={`Leave blank to use the default ${CATEGORY_LABEL[serviceType]} prompt`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600">Agent Skill</Label>
                      <Textarea
                        value={agentSkill}
                        onChange={(event) => setAgentSkill(event.target.value)}
                        className="min-h-24 bg-white"
                        placeholder="Describe the specific skill set or specialty"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600">User Instruction</Label>
                      <Textarea
                        value={agentInstruction}
                        onChange={(event) => setAgentInstruction(event.target.value)}
                        className="min-h-24 bg-white"
                        placeholder="Add any operating instruction the agent should follow"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Prompt preview</p>
                      <p className="mt-1 text-sm text-amber-900/80">
                        The final prompt combines the default instruction, any tenant override, and your supporting notes.
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Prompt source</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {systemPrompt.trim() ? "Tenant override" : `Default ${CATEGORY_LABEL[serviceType]} prompt`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Provider</p>
                        <p className="mt-1 font-medium text-slate-900">{aiProvider || "Not selected"}</p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Model</p>
                        <p className="mt-1 font-medium text-slate-900">{aiModel || "Not selected"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Active agent</p>
                        <p className="text-xs text-slate-500">Toggle whether this agent is enabled in the tenant.</p>
                      </div>
                      <Switch checked={isActive} disabled={isActiveToggleDisabled} onCheckedChange={(value) => setIsActive(Boolean(value))} />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Permissions</p>
                          <p className="text-xs text-slate-500">Define who can run the agent.</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                          <Shield className="mr-1 h-3.5 w-3.5" />
                          Access
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                        <Label className="text-sm text-slate-700">Manager can run</Label>
                        <Switch checked={managerCanRun} onCheckedChange={(value) => setManagerCanRun(Boolean(value))} />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                        <Label className="text-sm text-slate-700">User can run</Label>
                        <Switch checked={userCanRun} onCheckedChange={(value) => setUserCanRun(Boolean(value))} />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">User assignment</p>
                          <p className="text-xs text-slate-500">Pick the users that should see this agent.</p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={toggleSelectAllFiltered}>
                          Select all visible
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <Input
                          placeholder="Search users by name/email"
                          value={userSearch}
                          onChange={(event) => setUserSearch(event.target.value)}
                        />
                        <Badge variant="outline" className="justify-center rounded-full border-slate-200 px-3 py-1.5">
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          {assignedUserIds.length} assigned
                        </Badge>
                      </div>

                      <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        {loadingUsers ? <p className="px-3 py-2 text-xs text-slate-500">Loading users...</p> : null}
                        {!loadingUsers && filteredUsers.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-500">No active users found.</p>
                        ) : null}
                        {!loadingUsers
                          ? filteredUsers.map((user) => {
                              const id = String(user.id)
                              const checked = assignedUserIds.includes(id)

                              return (
                                <label
                                  key={id}
                                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 transition-colors hover:border-cyan-200 hover:bg-cyan-50/60"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900">{formatUserName(user)}</p>
                                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                                  </div>
                                  <Switch checked={checked} onCheckedChange={() => toggleAssigned(id)} />
                                </label>
                              )
                            })
                          : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Review before saving</p>
                      <p className="mt-1 text-sm text-emerald-900/80">
                        This summary reflects the agent that will be created or updated in the database.
                      </p>
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Agent</p>
                        <p className="mt-1 font-medium text-slate-900">{name.trim() || "Untitled agent"}</p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Provider / Model</p>
                        <p className="mt-1 font-medium text-slate-900">
                          {aiProvider && aiModel ? `${aiProvider} / ${aiModel}` : "Not selected"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Assigned users</p>
                        <p className="mt-1 font-medium text-slate-900">{assignedUserIds.length}</p>
                      </div>
                      <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                        <p className="mt-1 font-medium text-slate-900">{isActive ? "Active" : "Inactive"}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt preview</p>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
                        {buildFinalPrompt()}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
