"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  createTenantAgent,
  addTenantUser,
  fetchTenantAgent,
  fetchTenantAgentAssignment,
  fetchTenantUsers,
  updateTenantAgent,
  upsertTenantAgentAssignment,
} from "../../../../../actions/auth";
import type { AppDispatch } from "../../../../../redux/store";
import type { RootState } from "../../../../../redux/reducers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TenantUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean | null;
};

type AiProvider = "" | "openrouter";
type AgentCategory =
  | "gmail"
  | "crm"
  | "support"
  | "calendar"
  | "knowledge"
  | "automation"
  | "general";
type WorkflowType = "mastra";

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  gmail: "Gmail",
  crm: "CRM",
  support: "Support",
  calendar: "Calendar",
  knowledge: "Knowledge",
  automation: "Automation",
  general: "General",
};

const AI_MODEL_OPTIONS: Record<"openrouter", string[]> = {
  openrouter: [
    "openrouter/auto",
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.5-flash",
  ],
};

const AGENT_NAME_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9 ]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

type Step1FieldErrors = {
  name?: string;
  aiProvider?: string;
  aiModel?: string;
  serviceType?: string;
  workflowType?: string;
};

const USERS_CACHE = new Map<string, TenantUser[]>();
const USERS_IN_FLIGHT = new Map<string, Promise<TenantUser[]>>();

const tenantCacheKey = (tenantId: string) => String(tenantId || "__default__");

const extractBackendMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";

  const direct = payload as { message?: unknown };
  if (typeof direct.message === "string" && direct.message.trim()) {
    return direct.message.trim();
  }

  const nested = payload as { data?: { message?: unknown } };
  if (
    nested.data &&
    typeof nested.data.message === "string" &&
    nested.data.message.trim()
  ) {
    return nested.data.message.trim();
  }

  return "";
};

const formatUserName = (user: TenantUser): string => {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || String(user.email || "User");
};

const extractErrorMessage = (err: unknown): string => {
  if (!err || typeof err !== "object") {
    return "Failed to save agent.";
  }

  const typedError = err as {
    response?: { data?: unknown };
    message?: string;
  };

  const responseData = typedError.response?.data as
    | { message?: string; error?: string }
    | string
    | undefined;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData && typeof responseData === "object") {
    if (responseData.message && String(responseData.message).trim()) {
      return String(responseData.message).trim();
    }

    if (responseData.error && String(responseData.error).trim()) {
      return String(responseData.error).trim();
    }
  }

  if (typedError.message && typedError.message.trim()) {
    return typedError.message.trim();
  }

  return "Failed to save agent.";
};

const validateAgentName = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Agent name is required.";
  }

  if (!AGENT_NAME_PATTERN.test(trimmed)) {
    return "Agent name can only contain letters, numbers, and spaces.";
  }

  return "";
};

const validateStep1Fields = ({
  name,
  aiProvider,
  aiModel,
  serviceType,
  workflowType,
}: {
  name: string;
  aiProvider: AiProvider;
  aiModel: string;
  serviceType: AgentCategory | "";
  workflowType: WorkflowType | "";
}): Step1FieldErrors => {
  const errors: Step1FieldErrors = {};

  const nameError = validateAgentName(name);
  if (nameError) errors.name = nameError;

  if (!aiProvider) {
    errors.aiProvider = "AI provider is required.";
  }

  if (!aiModel.trim()) {
    errors.aiModel = "AI model is required.";
  }

  if (!serviceType) {
    errors.serviceType = "Tool is required.";
  }

  if (!workflowType) {
    errors.workflowType = "Connector is required.";
  }

  return errors;
};

const wizardSteps = [
  {
    id: 1,
    title: "Basics + AI",
    description: "Name, category, workflow, provider, and model.",
    icon: FileText,
  },
  {
    id: 2,
    title: "Access",
    description: "Permissions and user assignment.",
    icon: Shield,
  },
] as const;

export default function TenantAgentCreatePage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tenantProfile = useSelector((state: RootState) => state.tenant.profile);
  const tenantId = String(tenantProfile?.id || "");
  const editingAgentId = String(searchParams?.get("agentId") || "").trim();
  const isEditMode = Boolean(editingAgentId);

  const [workingAgentId, setWorkingAgentId] = useState<string>(editingAgentId);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("");
  const [aiModel, setAiModel] = useState("");
  const [managerCanRun, setManagerCanRun] = useState(true);
  const [userCanRun, setUserCanRun] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [serviceType, setServiceType] = useState<AgentCategory | "">("");
  const [workflowType, setWorkflowType] = useState<WorkflowType | "">("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserIsActive, setNewUserIsActive] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [step1FieldErrors, setStep1FieldErrors] = useState<Step1FieldErrors>(
    {},
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizeCategory = (value: string): AgentCategory => {
    const key = String(value || "").toLowerCase();
    if (key === "gmail") return "gmail";
    if (key === "crm") return "crm";
    if (key === "support") return "support";
    if (key === "calendar") return "calendar";
    if (key === "knowledge") return "knowledge";
    if (key === "automation") return "automation";
    return "general";
  };

  useEffect(() => {
    setWorkingAgentId(editingAgentId);
  }, [editingAgentId]);

  useEffect(() => {
    if (!isEditMode) {
      setCurrentStep(1);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (currentStep > 2) {
      setCurrentStep(2);
    }
  }, [currentStep]);

  const syncAgentIdInUrl = (agentId: string) => {
    const normalizedAgentId = String(agentId || "").trim();
    if (!normalizedAgentId) return;

    const currentPath = String(pathname || "/tenant/agents/create");
    const queryText = searchParams ? searchParams.toString() : "";
    const params = new URLSearchParams(queryText);
    params.set("agentId", normalizedAgentId);

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${currentPath}?${nextQuery}` : currentPath;
    router.replace(nextUrl, { scroll: false });
  };

  const loadUsers = async (options?: { forceRefresh?: boolean }) => {
    const key = tenantCacheKey(tenantId);
    const cached = USERS_CACHE.get(key);
    if (cached && !options?.forceRefresh) {
      setUsers(cached);
      return;
    }

    setLoadingUsers(true);
    const pending = USERS_IN_FLIGHT.get(key);

    try {
      const rows = pending
        ? await pending
        : await (() => {
            const request = (
              dispatch(fetchTenantUsers()) as Promise<unknown>
            ).then((result) =>
              Array.isArray(result) ? (result as TenantUser[]) : [],
            );
            USERS_IN_FLIGHT.set(key, request);
            return request;
          })();

      USERS_CACHE.set(key, rows);
      setUsers(rows);
    } finally {
      setLoadingUsers(false);
      USERS_IN_FLIGHT.delete(key);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadUsers();
    };

    void run();
  }, [dispatch, tenantId]);

  useEffect(() => {
    if (!isEditMode || !editingAgentId) return;

    const loadEditData = async () => {
      setLoadingEditData(true);
      try {
        const [agent, assignment] = await Promise.all([
          dispatch(fetchTenantAgent(editingAgentId)) as Promise<Record<
            string,
            unknown
          > | null>,
          dispatch(
            fetchTenantAgentAssignment(editingAgentId),
          ) as Promise<Record<string, unknown> | null>,
        ]);

        const assignmentRow = assignment || {};

        setName(String(agent?.name || assignmentRow.agentName || ""));
        setSystemPrompt(String(agent?.systemPrompt || ""));
        setIsActive(
          Number(assignmentRow.isActive ?? agent?.isActive ?? 1) !== 0,
        );

        const aiProviderValue =
          assignmentRow.aiProvider === "openrouter" ? "openrouter" : "";
        setAiProvider(aiProviderValue);
        setAiModel(String(assignmentRow.aiModel || ""));
        setManagerCanRun(Boolean(assignmentRow.managerCanRun ?? true));
        setUserCanRun(
          Boolean(
            assignmentRow.userCanRun ?? assignmentRow.memberCanRun ?? false,
          ),
        );
        setServiceType(
          normalizeCategory(String(agent?.serviceType || "general")),
        );
        setWorkflowType("mastra");
        setAssignedUserIds(
          Array.isArray(assignmentRow.assignedUserIds)
            ? assignmentRow.assignedUserIds
                .map((value: unknown) => String(value || ""))
                .filter(Boolean)
            : [],
        );
      } catch {
        console.error("Failed to load agent details for editing.");
      } finally {
        setLoadingEditData(false);
      }
    };

    void loadEditData();
  }, [dispatch, editingAgentId, isEditMode]);

  const activeUsers = users.filter((user) => Boolean(user.isActive ?? true));

  const filteredUsers = (() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return activeUsers;

    return activeUsers.filter((user) => {
      const nameText = formatUserName(user).toLowerCase();
      const emailText = String(user.email || "").toLowerCase();
      return nameText.includes(q) || emailText.includes(q);
    });
  })();

  const isActiveToggleDisabled = !tenantId || loadingEditData || loadingUsers;

  const toggleAssigned = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleSelectAllFiltered = () => {
    const ids = filteredUsers.map((user) => String(user.id));
    const allSelected =
      ids.length > 0 && ids.every((id) => assignedUserIds.includes(id));

    if (allSelected) {
      setAssignedUserIds((prev) => prev.filter((id) => !ids.includes(id)));
      return;
    }

    setAssignedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const resetAddUserForm = () => {
    setNewUserFirstName("");
    setNewUserLastName("");
    setNewUserEmail("");
    setNewUserIsActive(true);
    setAddUserError(null);
  };

  const handleAddUserDialogChange = (open: boolean) => {
    setAddUserModalOpen(open);
    if (!open) {
      resetAddUserForm();
      void loadUsers({ forceRefresh: true });
    }
  };

  const handleAddUserSubmit = async () => {
    const email = newUserEmail.trim();
    const firstName = newUserFirstName.trim();
    const lastName = newUserLastName.trim();

    if (!firstName) {
      setAddUserError("First name is required.");
      return;
    }

    if (!lastName) {
      setAddUserError("Last name is required.");
      return;
    }

    if (!email) {
      setAddUserError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddUserError("Enter a valid email address.");
      return;
    }

    setAddingUser(true);
    setAddUserError(null);

    try {
      await dispatch(
        addTenantUser({
          email,
          firstName,
          lastName,
          isActive: newUserIsActive ? 1 : 0,
        }),
      );

      handleAddUserDialogChange(false);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message || "")
          : "";
      setAddUserError(message || "Failed to add user.");
    } finally {
      setAddingUser(false);
    }
  };

  const onProviderChange = (value: string) => {
    const provider = value === "openrouter" ? "openrouter" : "";
    setAiProvider(provider);
    setAiModel(provider ? AI_MODEL_OPTIONS[provider][0] : "");
  };

  const buildFinalPrompt = () => {
    const selectedCategory = serviceType || "general";
    const selectedWorkflow = workflowType || "mastra";
    const providerText = aiProvider || "openrouter";
    const modelText = aiModel.trim() || AI_MODEL_OPTIONS[providerText][0];

    return (
      systemPrompt.trim() ||
      [
        `You are a tenant AI agent for ${CATEGORY_LABEL[selectedCategory]}.`,
        `Tenant scope: ${tenantId}`,
        `Workflow: ${selectedWorkflow}`,
        `AI provider: ${providerText}`,
        `AI model: ${modelText}`,
      ].join("\n")
    );
  };

  const createAgent = async () => {
    setSaveError(null);
    setSuccess(null);
    setStep1FieldErrors({});

    if (!tenantId) {
      return;
    }

    const step1FieldValidationErrors = validateStep1Fields({
      name,
      aiProvider,
      aiModel,
      serviceType,
      workflowType,
    });

    if (Object.values(step1FieldValidationErrors).some(Boolean)) {
      setStep1FieldErrors(step1FieldValidationErrors);
      return;
    }

    const safeName = name.trim();

    setSaving(true);
    try {
      const provider = (aiProvider || "openrouter") as "openrouter";
      const model = aiModel.trim() || AI_MODEL_OPTIONS[provider][0];
      if (!aiProvider) setAiProvider(provider);
      if (!aiModel.trim()) setAiModel(model);

      const existingWorkingAgentId = String(workingAgentId || "").trim();
      let agentId = existingWorkingAgentId;
      let backendMessage = "";

      if (!agentId) {
        const createResp = await (dispatch(
          createTenantAgent({
            name: safeName,
            systemPrompt: buildFinalPrompt(),
            topK: 6,
            isActive: isActive ? 1 : 0,
            allowedCollections: [],
          }),
        ) as Promise<{ agent?: { id?: string } }>);

        agentId = String(createResp?.agent?.id || "").trim();
        if (!agentId) {
          throw new Error("Agent id missing from create response.");
        }

        setWorkingAgentId(agentId);
        syncAgentIdInUrl(agentId);
        backendMessage = extractBackendMessage(createResp);
      }

      const coreResp = await (dispatch(
        updateTenantAgent({
          agentId,
          name: safeName,
          systemPrompt: buildFinalPrompt(),
          isActive: isActive ? 1 : 0,
          topK: 6,
          allowedCollections: [],
        }),
      ) as Promise<unknown>);
      const coreMessage = extractBackendMessage(coreResp);

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
      ) as Promise<unknown>);
      const assignmentMessage = extractBackendMessage(assignmentResp);

      const fallbackMessage = existingWorkingAgentId
        ? "Agent updated and saved to database."
        : "Agent created and saved to database.";

      setSuccess(
        assignmentMessage || coreMessage || backendMessage || fallbackMessage,
      );
    } catch (err: unknown) {
      setSaveError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = workingAgentId ? "Edit Agent" : "Create Agent";
  const pageDescription =
    "Use the two-step wizard to define the agent identity, configure its AI behavior, and assign access before saving.";
  const finalButtonLabel = workingAgentId ? "Save Agent" : "Create Agent";
  const currentStepMeta = wizardSteps[currentStep - 1];
  const CurrentIcon = currentStepMeta.icon;
  const selectedCategory = serviceType || "general";
  const selectedWorkflow = workflowType || "mastra";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_24px_80px_rgba(109,74,255,0.08)] backdrop-blur">
        <div className="border-b border-border bg-linear-to-r from-primary/10 via-background to-background px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Add Agent
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Build your agent in two focused steps
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    The canvas has been replaced with a guided form flow so the
                    full agent definition stays easy to review, edit, and save.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/5 px-3 py-1.5 text-primary"
              >
                <CurrentIcon className="mr-1.5 h-3.5 w-3.5" />
                {currentStepMeta.title}
              </Badge>
              {workingAgentId ? (
                <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                  Editing
                </Badge>
              ) : (
                <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">
                  New
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="relative">
              <div className="absolute left-6 right-6 top-6 hidden h-0.5 bg-border sm:block" />

              <div
                className="absolute left-6 top-6 hidden h-0.5 bg-linear-to-r from-primary via-primary-light to-primary transition-all duration-700 ease-out sm:block"
                style={{
                  width:
                    wizardSteps.length > 1
                      ? `calc(${((currentStep - 1) / (wizardSteps.length - 1)) * 100}% - 48px)`
                      : "0%",
                }}
              />

              <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                {wizardSteps.map((step, index) => {
                  const Icon = step.icon;
                  const active = currentStep === step.id;
                  const complete = currentStep > step.id;
                  const upcoming = currentStep < step.id;

                  return (
                    <div
                      key={step.id}
                      className="flex flex-1 items-center sm:block"
                    >
                      <div className="flex items-center gap-4 sm:flex-col sm:gap-3 sm:text-center">
                        <div
                          className={cn(
                            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500",
                            active &&
                              "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(109,74,255,0.12),0_10px_24px_rgba(109,74,255,0.18)]",
                            complete &&
                              "border-primary bg-primary text-primary shadow-[0_0_0_4px_rgba(109,74,255,0.08)]",
                            upcoming &&
                              "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {complete ? (
                            <CheckCircle2 className="relative z-10 h-5 w-5 text-white" />
                          ) : (
                            <Icon
                              className={cn(
                                "relative z-10 h-5 w-5 transition-transform duration-300",
                                active && "scale-110",
                              )}
                            />
                          )}

                          {active && (
                            <span className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/10 blur-xl" />
                          )}
                        </div>

                        <div className="min-w-0 sm:min-w-37.5">
                          <div className="flex items-center gap-2 sm:justify-center">
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-[0.16em]",
                                active && "text-primary",
                                complete && "text-primary",
                                upcoming && "text-muted-foreground",
                              )}
                            >
                              Step {step.id}
                            </span>

                            {/* {active && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                                Current
                              </span>
                            )}

                            {complete && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                                Done
                              </span>
                            )} */}
                          </div>

                          <p
                            className={cn(
                              "mt-1 text-sm font-semibold transition-colors duration-300",
                              active && "text-foreground",
                              complete && "text-foreground",
                              upcoming && "text-muted-foreground",
                            )}
                          >
                            {step.title}
                          </p>

                          <p
                            className={cn(
                              "mt-1 hidden text-xs leading-5 transition-colors duration-300 sm:block",
                              active && "text-muted-foreground",
                              complete && "text-muted-foreground",
                              upcoming && "text-muted-foreground",
                            )}
                          >
                            {step.description}
                          </p>
                        </div>
                      </div>

                      {index < wizardSteps.length - 1 && (
                        <div className="ml-4 h-8 w-px bg-border sm:hidden" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-none">
          <CardHeader className="border-b border-border bg-background px-5 py-4 sm:px-6">
            <div>
              <div>
                <CardTitle className="text-base sm:text-lg">
                  Step {currentStep}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {currentStepMeta.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-5 py-6 sm:px-6">
            {saveError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                {success}
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="grid gap-6 grid-cols-1">
                <div className="space-y-5 rounded-2xl border border-border bg-muted/30 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Agent Name
                      </Label>
                      <Input
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value);
                          setStep1FieldErrors((prev) => ({
                            ...prev,
                            name: "",
                          }));
                        }}
                        className="h-11 bg-background"
                        placeholder="Enter agent name"
                      />
                      {step1FieldErrors.name ? (
                        <p className="text-xs text-red-600">
                          {step1FieldErrors.name}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        AI Provider
                      </Label>
                      <Select
                        value={aiProvider || "none"}
                        onValueChange={(value) => {
                          onProviderChange(value === "none" ? "" : value);
                          setStep1FieldErrors((prev) => ({
                            ...prev,
                            aiProvider: "",
                            aiModel: "",
                          }));
                        }}
                      >
                        <SelectTrigger className="h-11 w-full bg-background">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="w-(--radix-select-trigger-width)"
                        >
                          <SelectItem value="none">Select provider</SelectItem>
                          <SelectItem value="openrouter">OpenRouter</SelectItem>
                        </SelectContent>
                      </Select>
                      {step1FieldErrors.aiProvider ? (
                        <p className="text-xs text-red-600">
                          {step1FieldErrors.aiProvider}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Model
                      </Label>
                      <Select
                        value={aiModel || "none"}
                        onValueChange={(value) => {
                          setAiModel(value === "none" ? "" : value);
                          setStep1FieldErrors((prev) => ({
                            ...prev,
                            aiModel: "",
                          }));
                        }}
                      >
                        <SelectTrigger className="h-11 w-full bg-background">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="w-(--radix-select-trigger-width)"
                        >
                          <SelectItem value="none">Select model</SelectItem>
                          {(aiProvider ? AI_MODEL_OPTIONS[aiProvider] : []).map(
                            (model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      {step1FieldErrors.aiModel ? (
                        <p className="text-xs text-red-600">
                          {step1FieldErrors.aiModel}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Tools
                      </Label>
                      <Select
                        value={serviceType || "none"}
                        onValueChange={(value) => {
                          setServiceType(
                            value === "none" ? "" : normalizeCategory(value),
                          );
                          setStep1FieldErrors((prev) => ({
                            ...prev,
                            serviceType: "",
                          }));
                        }}
                      >
                        <SelectTrigger className="h-11 w-full bg-background">
                          <SelectValue placeholder="Select tool" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="w-(--radix-select-trigger-width)"
                        >
                          <SelectItem value="none">Select tool</SelectItem>
                          {Object.entries(CATEGORY_LABEL).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      {step1FieldErrors.serviceType ? (
                        <p className="text-xs text-red-600">
                          {step1FieldErrors.serviceType}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Connector
                      </Label>
                      <Select
                        value={workflowType || "none"}
                        onValueChange={(value) => {
                          setWorkflowType(
                            value === "none" ? "" : (value as WorkflowType),
                          );
                          setStep1FieldErrors((prev) => ({
                            ...prev,
                            workflowType: "",
                          }));
                        }}
                      >
                        <SelectTrigger className="h-11 w-full bg-background">
                          <SelectValue placeholder="Select connector" />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="w-(--radix-select-trigger-width)"
                        >
                          <SelectItem value="none">Select workflow</SelectItem>
                          <SelectItem value="mastra">Mastra</SelectItem>
                        </SelectContent>
                      </Select>
                      {step1FieldErrors.workflowType ? (
                        <p className="text-xs text-red-600">
                          {step1FieldErrors.workflowType}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="grid gap-6 grid-cols-1">
                <div className="space-y-5 rounded-2xl border border-border bg-muted/30 p-5">
                  <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Permissions
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Define who can run the agent.
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-primary/10 text-primary"
                      >
                        <Shield className="mr-1 h-3.5 w-3.5" />
                        Access
                      </Badge>
                    </div>

                    <div className="flex items-center gap-6 rounded-xl border border-border px-4 py-3">
                      <div className="flex flex-1 items-center justify-between gap-3">
                        <Label className="text-sm text-foreground">
                          Manager can run
                        </Label>
                        <Switch
                          checked={managerCanRun}
                          onCheckedChange={(value) =>
                            setManagerCanRun(Boolean(value))
                          }
                        />
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-3 border-l border-border pl-6">
                        <Label className="text-sm text-foreground">
                          User can run
                        </Label>
                        <Switch
                          checked={userCanRun}
                          onCheckedChange={(value) =>
                            setUserCanRun(Boolean(value))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          User assignment
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pick the users that should see this agent.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={toggleSelectAllFiltered}
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="cursor-pointer bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setAddUserModalOpen(true);
                            setAddUserError(null);
                          }}
                        >
                          Add User
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Input
                        placeholder="Search users by name/email"
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                      />
                      <Badge
                        variant="outline"
                        className="justify-center rounded-full border-border bg-background px-3 py-1.5 text-foreground"
                      >
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        {assignedUserIds.length} assigned
                      </Badge>
                    </div>

                    <div className="max-h-80 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-2">
                      {loadingUsers ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Loading users...
                        </p>
                      ) : null}
                      {!loadingUsers && filteredUsers.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No active users found.
                        </p>
                      ) : null}
                      {!loadingUsers
                        ? filteredUsers.map((user) => {
                            const id = String(user.id);
                            const checked = assignedUserIds.includes(id);

                            return (
                              <label
                                key={id}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-transparent bg-background px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {formatUserName(user)}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {user.email}
                                  </p>
                                </div>
                                <Switch
                                  checked={checked}
                                  onCheckedChange={() => toggleAssigned(id)}
                                />
                              </label>
                            );
                          })
                        : null}
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Agent active
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Controls whether this agent is enabled when saved.
                        </p>
                      </div>
                      <Switch
                        checked={isActive}
                        disabled={isActiveToggleDisabled}
                        onCheckedChange={(value) => setIsActive(Boolean(value))}
                      />
                    </div>

                    {isActiveToggleDisabled ? (
                      <p className="text-xs text-muted-foreground">
                        Active status is disabled until tenant details finish
                        loading.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
          <div className="flex flex-col-reverse gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-muted-foreground">
              {currentStep === 1
                ? "Complete the required fields to continue."
                : "Review access settings before saving."}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer py-5 px-6"
                onClick={() =>
                  setCurrentStep((value) => Math.max(1, value - 1))
                }
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {currentStep < 2 ? (
                <Button
                  type="button"
                  className="cursor-pointer bg-primary hover:bg-primary/90 py-5 px-6"
                  onClick={() => {
                    const step1FieldValidationErrors = validateStep1Fields({
                      name,
                      aiProvider,
                      aiModel,
                      serviceType,
                      workflowType,
                    });

                    if (
                      Object.values(step1FieldValidationErrors).some(Boolean)
                    ) {
                      setStep1FieldErrors(step1FieldValidationErrors);
                      return;
                    }
                    setStep1FieldErrors({});
                    setCurrentStep(2);
                  }}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="cursor-pointer bg-primary hover:bg-primary/90 py-5 px-6"
                  disabled={saving || loadingEditData}
                  onClick={createAgent}
                >
                  {saving ? "Saving..." : finalButtonLabel}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>

      <Dialog open={addUserModalOpen} onOpenChange={handleAddUserDialogChange}>
        <DialogContent className="sm:max-w-xl rounded-2xl border border-border bg-background p-0">
          <div className="p-6">
            <DialogHeader className="space-y-2">
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>
                Create a user from the assignment step, then close this modal to
                refresh the list.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              {addUserError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {addUserError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    First name
                  </Label>
                  <Input
                    value={newUserFirstName}
                    onChange={(event) =>
                      setNewUserFirstName(event.target.value)
                    }
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Last name
                  </Label>
                  <Input
                    value={newUserLastName}
                    onChange={(event) => setNewUserLastName(event.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="Enter email address"
                    type="email"
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Active
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enable this user immediately after creation.
                    </p>
                  </div>
                  <Switch
                    checked={newUserIsActive}
                    onCheckedChange={(value) =>
                      setNewUserIsActive(Boolean(value))
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 px-0 pb-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddUserDialogChange(false)}
                disabled={addingUser}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90"
                onClick={handleAddUserSubmit}
                disabled={addingUser}
              >
                {addingUser ? "Saving..." : "Add User"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
