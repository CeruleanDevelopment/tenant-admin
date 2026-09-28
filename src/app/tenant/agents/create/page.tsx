"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  createTenantAgent,
  fetchConnectorCatalog,
  fetchConnectorActions,
  fetchTenantConnectors,
  fetchTenantAgent,
  fetchTenantAgentAssignment,
  fetchTenantUsers,
  fetchTenantRoleUserActions,
  saveTenantRole,
  updateTenantAgent,
  updateTenantUserActions,
  upsertTenantAgentAssignment,
  type ConnectorCatalogItem,
  type TenantConnectorItem,
} from "../../../../../actions/auth";
import type { AppDispatch } from "../../../../../redux/store";
import type { RootState } from "../../../../../redux/reducers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AddUserDialog,
  ConnectorDialog,
  RoleDialog,
} from "@/components/dialogs";
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
import { Checkbox } from "@/components/ui/checkbox";

type TenantUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean | null;
};

type AiProvider = "" | "openrouter";
type AgentCategory = string;

const AGENT_NAME_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9 ]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

const AI_MODEL_OPTIONS: Record<"openrouter", string[]> = {
  openrouter: [
    "openrouter/auto",
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.5-flash",    
  ],
};

type Step1FieldErrors = {
  name?: string;
  aiProvider?: string;
  aiModel?: string;
  serviceType?: string;
  tenantConnectorId?: string;
};

type RoleBootstrapAction = {
  id: string;
  connector_id: string;
  connector_key: string;
  connector_display_name: string;
  action_key: string;
  display_name: string;
  description?: string | null;
  status?: string | null;
  is_active?: number | boolean | null;
};

type RoleBootstrapRoleAction = {
  id: string;
  tenant_id: string;
  role_id: string;
  connector_id: string;
  action_id: string;
  is_active?: number | boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RoleBootstrapRole = {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  agent_id?: string | null;
  connector_id?: string | null;
  tool_id?: string | null;
  name: string;
  description?: string | null;
  is_active?: number | boolean | null;
};

type RoleBootstrapMember = {
  role_id: string;
  user_id: string;
  is_active?: number | boolean | null;
};

type RoleBootstrapPayload = {
  roles: RoleBootstrapRole[];
  roleMembers: RoleBootstrapMember[];
  roleActions: RoleBootstrapRoleAction[];
  actions: RoleBootstrapAction[];
};

const USERS_CACHE = new Map<string, TenantUser[]>();
const USERS_IN_FLIGHT = new Map<string, Promise<TenantUser[]>>();
const CONNECTORS_CACHE = new Map<string, ConnectorCatalogItem[]>();
const CONNECTORS_IN_FLIGHT = new Map<string, Promise<ConnectorCatalogItem[]>>();
const TENANT_CONNECTORS_CACHE = new Map<string, TenantConnectorItem[]>();
const TENANT_CONNECTORS_IN_FLIGHT = new Map<
  string,
  Promise<TenantConnectorItem[]>
>();

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

const toActive = (value: unknown): boolean => Number(value ?? 1) !== 0;

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
  tenantConnectorId,
}: {
  name: string;
  aiProvider: AiProvider;
  aiModel: string;
  serviceType: AgentCategory | "";
  tenantConnectorId: string;
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

  // if (!tenantConnectorId) {
  //   errors.tenantConnectorId = "Connector is required.";
  // }

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
  const [loadingConnectors, setLoadingConnectors] = useState(false);
  const [loadingTenantConnectors, setLoadingTenantConnectors] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [roleBootstrapRoles, setRoleBootstrapRoles] = useState<RoleBootstrapRole[]>([]);
  const [roleBootstrapMembers, setRoleBootstrapMembers] = useState<RoleBootstrapMember[]>([]);
  const [roleBootstrapActions, setRoleBootstrapActions] = useState<RoleBootstrapRoleAction[]>([]);
  const [roleActionCatalog, setRoleActionCatalog] = useState<RoleBootstrapAction[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedRoleUserIds, setSelectedRoleUserIds] = useState<string[]>([]);
  const [selectedRoleActionIds, setSelectedRoleActionIds] = useState<string[]>([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleViewMode, setRoleViewMode] = useState<"roles" | "users">("roles");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserActions, setSelectedUserActions] = useState<Array<Record<string, unknown>>>([]);
  const [loadingUserActions, setLoadingUserActions] = useState(false);
  const [savingUserAction, setSavingUserAction] = useState(false);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleConnectorId, setRoleConnectorId] = useState("");
  const [roleToolId, setRoleToolId] = useState("");
  const [roleIsActive, setRoleIsActive] = useState(true);

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("");
  const [aiModel, setAiModel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [serviceType, setServiceType] = useState<AgentCategory>("");
  const [selectedTenantConnectorId, setSelectedTenantConnectorId] =
    useState("");
  const [connectors, setConnectors] = useState<ConnectorCatalogItem[]>([]);
  const [tenantConnectors, setTenantConnectors] = useState<
    TenantConnectorItem[]
  >([]);
  const [userSearch, setUserSearch] = useState("");
  const [connectorModalOpen, setConnectorModalOpen] = useState(false);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [step1FieldErrors, setStep1FieldErrors] = useState<Step1FieldErrors>(
    {},
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  

  const getConnectorById = (connectorId: string) =>
    connectors.find((connector) => connector.id === connectorId) || null;

  const getConnectorByKey = (connectorKey: string) =>
    connectors.find((connector) => connector.key === connectorKey) || null;

  const selectedToolConnector = getConnectorByKey(serviceType);

  const loadTenantConnectors = async (options?: {
    forceRefresh?: boolean;
    connectorId?: string;
  }) => {
    const key = tenantCacheKey(
      `${tenantId}:${String(options?.connectorId || "__all__")}`,
    );
    const cached = TENANT_CONNECTORS_CACHE.get(key);
    if (cached && !options?.forceRefresh) {
      setTenantConnectors(cached);
      return;
    }

    setLoadingTenantConnectors(true);
    const pending = TENANT_CONNECTORS_IN_FLIGHT.get(key);

    try {
      const request =
        pending ||
        (dispatch(
          fetchTenantConnectors({
            connectorId: options?.connectorId,
            connectedOnly: true,
          }),
        ) as Promise<TenantConnectorItem[]>);
      TENANT_CONNECTORS_IN_FLIGHT.set(key, request);
      const rows = await request;

      TENANT_CONNECTORS_CACHE.set(key, rows);
      setTenantConnectors(rows);
    } finally {
      setLoadingTenantConnectors(false);
      TENANT_CONNECTORS_IN_FLIGHT.delete(key);
    }
  };

  const loadRoleActions = async (tenantConnectorId: string) => {
    const normalizedTenantConnectorId = String(tenantConnectorId || "").trim();
    if (!normalizedTenantConnectorId) {
      setRoleActionCatalog([]);
      return;
    }

    const selectedTenantConnector =
      tenantConnectors.find((item) => String(item.id) === normalizedTenantConnectorId) ||
      null;

    if (!selectedTenantConnector?.connector_version_id) {
      setRoleActionCatalog([]);
      return;
    }

    try {
      const actions = (await dispatch(
        fetchConnectorActions(selectedTenantConnector.connector_version_id),
      )) as Array<Record<string, unknown>>;
      const catalogConnector =
        connectors.find((item) => item.id === selectedTenantConnector.connector_id) || null;

      setRoleActionCatalog(
        actions
          .map((action) => ({
            id: String(action.id || "").trim(),
            connector_id: String(selectedTenantConnector.connector_id || "").trim(),
            connector_key: String(catalogConnector?.key || selectedTenantConnector.connector_id || "").trim(),
            connector_display_name: String(catalogConnector?.display_name || selectedTenantConnector.connector_display_name || selectedTenantConnector.connector_id || "").trim(),
            action_key: String(action.action_key || "").trim(),
            display_name: String(action.display_name || action.action_key || "").trim(),
            description: String(action.description || "").trim(),
            status: String(action.status || "").trim() || null,
            is_active: action.is_active as number | boolean | null,
          }))
          .filter((item) => Boolean(item.id && item.action_key)),
      );
    } catch (error: unknown) {
      console.error("Failed to load role actions:", extractErrorMessage(error));
      setRoleActionCatalog([]);
    }
  };

  const loadUserActions = async (userId: string) => {
    const normalizedUserId = String(userId || "").trim();
    if (!tenantId || !normalizedUserId) {
      setSelectedUserActions([]);
      return;
    }

    setLoadingUserActions(true);
    try {
      const actions = (await dispatch(
        fetchTenantRoleUserActions(normalizedUserId),
      )) as Array<Record<string, unknown>>;
      const payload = { actions };
      setSelectedUserActions(Array.isArray(payload?.actions) ? payload.actions : []);
    } catch (error: unknown) {
      setUserActionError(extractErrorMessage(error));
      setSelectedUserActions([]);
    } finally {
      setLoadingUserActions(false);
    }
  };

  const openConnectorModal = () => {
    setConnectorModalOpen(true);
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
    // router.replace(nextUrl, { scroll: false });
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

  const loadConnectors = async (options?: { forceRefresh?: boolean }) => {
    const key = tenantCacheKey(tenantId);
    const cached = CONNECTORS_CACHE.get(key);
    if (cached && !options?.forceRefresh) {
      setConnectors(cached);
      return;
    }

    setLoadingConnectors(true);
    const pending = CONNECTORS_IN_FLIGHT.get(key);

    try {
      const rows = pending
        ? await pending
        : await (() => {
            const request = (
              dispatch(fetchConnectorCatalog()) as Promise<unknown>
            ).then((result) =>
              Array.isArray(result) ? (result as ConnectorCatalogItem[]) : [],
            );
            CONNECTORS_IN_FLIGHT.set(key, request);
            return request;
          })();

      CONNECTORS_CACHE.set(key, rows);
      setConnectors(rows);
    } finally {
      setLoadingConnectors(false);
      CONNECTORS_IN_FLIGHT.delete(key);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadUsers();
      await loadConnectors();
    };

    void run();
  }, [dispatch, tenantId]);

  useEffect(() => {
    const connectorId = selectedToolConnector?.id || "";
    void loadTenantConnectors({ connectorId, forceRefresh: true });
  }, [selectedToolConnector?.id, tenantId]);

  useEffect(() => {
    if (!selectedTenantConnectorId) {
      setRoleActionCatalog([]);
      return;
    }

    void loadRoleActions(selectedTenantConnectorId);
  }, [connectors, selectedTenantConnectorId, tenantConnectors]);

  const selectedRole = roleBootstrapRoles.find((role) => role.id === selectedRoleId) || null;

  const currentAgentId = String(workingAgentId || editingAgentId || "").trim() || null;

  const visibleRoleBootstrapRoles = useMemo(
    () =>
      roleBootstrapRoles.filter((role) => {
        const roleAgentId = String(role.agent_id || "").trim();
        if (currentAgentId) {
          return roleAgentId === currentAgentId;
        }

        return !roleAgentId;
      }),
    [currentAgentId, roleBootstrapRoles],
  );

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === selectedUserId) || null,
    [selectedUserId, users],
  );

  const selectedUserLabel = selectedUser ? formatUserName(selectedUser) : "Select a user";
  const selectedUserEmail = selectedUser?.email || "";
  const selectedRoleUsers = useMemo(
    () =>
      selectedRoleUserIds
        .map((userId) => users.find((user) => String(user.id) === String(userId)) || null)
        .filter((user): user is TenantUser => Boolean(user)),
    [selectedRoleUserIds, users],
  );

  const selectedToolActions = useMemo(() => {
    if (!selectedToolConnector?.id) return [];
    return roleActionCatalog.filter(
      (action) => String(action.connector_id) === String(selectedToolConnector.id),
    );
  }, [roleActionCatalog, selectedToolConnector?.id]);

  const buildRoleAutoName = (connectorId: string, toolId: string) => {
    const connector = connectors.find((item) => item.id === connectorId) || null;
    const tool = roleActionCatalog.find((item) => item.id === toolId) || null;
    return (
      String(tool?.display_name || tool?.action_key || "") ||
      String(connector?.display_name || connector?.key || "Role")
    );
  };

  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedRoleUserIds([]);
      setSelectedRoleActionIds([]);
      return;
    }

    setSelectedRoleUserIds(
      roleBootstrapMembers
        .filter((item) => String(item.role_id) === String(selectedRoleId) && Number(item.is_active ?? 1) !== 0)
        .map((item) => String(item.user_id))
        .filter(Boolean),
    );

    setSelectedRoleActionIds(
      roleBootstrapActions
        .filter((item) => String(item.role_id) === String(selectedRoleId) && Number(item.is_active ?? 1) !== 0)
        .map((item) => String(item.action_id))
        .filter(Boolean),
    );
  }, [roleBootstrapActions, roleBootstrapMembers, selectedRoleId]);

  useEffect(() => {
    if (selectedUserId) {
      void loadUserActions(selectedUserId);
    } else {
      setSelectedUserActions([]);
    }
  }, [selectedUserId]);

  const toggleRoleUser = (userId: string) => {
    setSelectedRoleUserIds((current) =>
      current.includes(userId)
        ? current.filter((value) => value !== userId)
        : [...current, userId],
    );
  };

  const toggleRoleAction = (actionId: string) => {
    setSelectedRoleActionIds((current) =>
      current.includes(actionId)
        ? current.filter((value) => value !== actionId)
        : [...current, actionId],
    );
  };

  const handleUserActionToggle = async (action: RoleBootstrapAction, checked: boolean) => {
    const normalizedActionId = String(action.id || "").trim();
    const normalizedConnectorId = String(action.connector_id || "").trim();

    if (!normalizedActionId || !normalizedConnectorId) {
      setUserActionError("Unable to update this action.");
      return;
    }

    if (!selectedUserId) {
      setUserActionError("Select a user first.");
      return;
    }

    setSavingUserAction(true);
    setUserActionError(null);

    try {
      const currentUserActions = selectedUserActions
        .filter(
          (item) =>
            String(item.connector_id || "") === normalizedConnectorId &&
            String(item.grant_source || "") === "user",
        )
        .map((item) => ({ connectorId: String(item.connector_id || ""), actionId: String(item.action_id || "") }))
        .filter((item) => item.connectorId && item.actionId);

      const nextActions = checked
        ? currentUserActions.some(
            (item) => item.connectorId === normalizedConnectorId && item.actionId === normalizedActionId,
          )
          ? currentUserActions
          : [...currentUserActions, { connectorId: normalizedConnectorId, actionId: normalizedActionId }]
        : currentUserActions.filter(
            (item) => !(item.connectorId === normalizedConnectorId && item.actionId === normalizedActionId),
          );

      await dispatch(updateTenantUserActions(selectedUserId, normalizedConnectorId, nextActions));

      if (selectedUserId) {
        await loadUserActions(selectedUserId);
      }
    } catch (error: unknown) {
      setUserActionError(extractErrorMessage(error));
    } finally {
      setSavingUserAction(false);
    }
  };

  const startNewRole = () => {
    setSelectedRoleId("");
    const defaultConnectorId = selectedToolConnector?.id || connectors[0]?.id || "";
    const defaultToolId = roleActionCatalog.find((action) => action.connector_id === defaultConnectorId)?.id || "";
    setRoleConnectorId(defaultConnectorId);
    setRoleToolId(defaultToolId);
    setRoleName("");
    setRoleDescription("");
    setRoleIsActive(true);
    setSelectedRoleUserIds([]);
    setSelectedRoleActionIds([]);
  };

  const openRoleModal = () => {
    startNewRole();
    setRoleModalOpen(true);
  };

  const selectRole = (role: RoleBootstrapRole) => {
    setSelectedRoleId(role.id);
    setRoleName(role.name || "");
    setRoleDescription(role.description || "");
    setRoleConnectorId(role.connector_id || "");
    setRoleToolId(role.tool_id || "");
    setRoleIsActive(toActive(role.is_active));
  };

  const replaceRoleBootstrapState = ({
    previousRoleId,
    roleRecord,
    userIds,
    actions,
  }: {
    previousRoleId: string;
    roleRecord: RoleBootstrapRole;
    userIds: string[];
    actions: Array<{ connectorId: string; actionId: string }>;
  }) => {
    const previousId = String(previousRoleId || "").trim();
    const nextRoleId = String(roleRecord.id || "").trim();

    setRoleBootstrapRoles((current) => {
      const filtered = current.filter(
        (item) => item.id !== previousId && item.id !== nextRoleId,
      );
      return [...filtered, roleRecord];
    });

    setRoleBootstrapMembers((current) => {
      const filtered = current.filter(
        (item) => item.role_id !== previousId && item.role_id !== nextRoleId,
      );
      const nextMembers = userIds.map((userId) => ({
        role_id: nextRoleId,
        user_id: userId,
        is_active: 1,
      }));
      return [...filtered, ...nextMembers];
    });

    setRoleBootstrapActions((current) => {
      const filtered = current.filter(
        (item) => item.role_id !== previousId && item.role_id !== nextRoleId,
      );
      const nextActions = actions.map((item) => ({
        id: `${nextRoleId}:${item.actionId}`,
        tenant_id: tenantId,
        role_id: nextRoleId,
        connector_id: item.connectorId,
        action_id: item.actionId,
        is_active: 1,
        created_at: null,
        updated_at: null,
      }));
      return [...filtered, ...nextActions];
    });

    setSelectedRoleId(nextRoleId);
    selectRole(roleRecord);
  };

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
        setServiceType(
          String(
            agent?.connectorKey ||
              agent?.connector_key ||
              agent?.serviceType ||
              "",
          ).trim(),
        );
        setSelectedTenantConnectorId(
          String(
            agent?.connectorKey ||
              agent?.connector_key ||
              assignmentRow.connectorKey ||
              assignmentRow.connector_key ||
              "",
          ),
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

  const handleConnectorSaved = async (payload: {
    tenantConnectorId: string;
    connectorId: string;
  }) => {
    if (payload.tenantConnectorId) {
      setSelectedTenantConnectorId(payload.tenantConnectorId);
    }

    await loadTenantConnectors({
      forceRefresh: true,
      connectorId: payload.connectorId,
    });
  };

  const handleRoleSaved = (payload: {
    previousRoleId: string;
    roleRecord: RoleBootstrapRole;
    userIds: string[];
    actions: Array<{ connectorId: string; actionId: string }>;
  }) => {
    setRoleName(payload.roleRecord.name || "");
    setRoleDescription(String(payload.roleRecord.description || ""));
    setRoleConnectorId(String(payload.roleRecord.connector_id || ""));
    setRoleToolId(String(payload.roleRecord.tool_id || ""));
    setRoleIsActive(toActive(payload.roleRecord.is_active));

    replaceRoleBootstrapState(payload);
  };


  const visibleCatalogConnectors = connectors;
  const visibleTenantConnectors = tenantConnectors
    .map((tenantConnector) => {
      const catalogConnector =
        connectors.find(
          (connector) => connector.id === tenantConnector.connector_id,
        ) || null;
      return { tenantConnector, catalogConnector };
    })
    .filter(({ catalogConnector }) => {
      if (!serviceType) return false;
      return (
        String(catalogConnector?.key || "").toLowerCase() ===
        String(serviceType || "").toLowerCase()
      );
    });

  const saveValidationErrors = validateStep1Fields({
    name,
    aiProvider,
    aiModel,
    serviceType,
    tenantConnectorId: selectedTenantConnectorId,
  });

  const hasStep1ValidationError = Object.values(saveValidationErrors).some(
    Boolean,
  );

  const selectedTenantConnectorRow =
    tenantConnectors.find(
      (item) =>
        String(item.id || "").trim() ===
        String(selectedTenantConnectorId || "").trim(),
    ) || null;

  const isSelectedConnectorMatchedToTool = Boolean(
    selectedToolConnector?.id &&
      selectedTenantConnectorRow &&
      String(selectedTenantConnectorRow.connector_id || "").trim() ===
        String(selectedToolConnector.id || "").trim(),
  );

  const canEnableSaveAgent =
    !saving &&
    !loadingEditData &&
    !loadingConnectors &&
    !loadingTenantConnectors &&
    Boolean(tenantId) &&
    !hasStep1ValidationError &&
    isSelectedConnectorMatchedToTool;

  const onProviderChange = (value: string) => {
    const provider = value === "openrouter" ? "openrouter" : "";
    setAiProvider(provider);
    setAiModel("");
  };

  const buildFinalPrompt = () => {
    const selectedToolLabel =
      selectedToolConnector?.display_name || serviceType || "general";
    const selectedConnectorLabel = selectedTenantConnectorId || "connector";
    const providerText = aiProvider || "openrouter";
    const modelText = aiModel.trim() || AI_MODEL_OPTIONS[providerText][0];

    return (
      systemPrompt.trim() ||
      [
        `You are a tenant AI agent for ${selectedToolLabel}.`,
        `Tenant scope: ${tenantId}`,
        `Connector: ${selectedConnectorLabel}`,
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
      tenantConnectorId: selectedTenantConnectorId,
    });

    if (Object.values(step1FieldValidationErrors).some(Boolean)) {
      setStep1FieldErrors(step1FieldValidationErrors);
      return;
    }

    if (!selectedToolConnector?.id) {
      setSaveError("Select a tool before saving the agent.");
      return;
    }

    if (!selectedTenantConnectorRow?.id) {
      setSaveError("Select a tenant connector before saving the agent.");
      return;
    }

    if (!isSelectedConnectorMatchedToTool) {
      setSaveError("Selected connector does not match the selected tool.");
      return;
    }

    if (loadingConnectors || loadingTenantConnectors) {
      setSaveError("Please wait until tenant connector details are loaded.");
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
          meetingAutomationEnabled: true,
          meetingCreationMode: "auto",
        }),
      ) as Promise<unknown>);
      const assignmentMessage = extractBackendMessage(assignmentResp);

      const pendingRoles = roleBootstrapRoles.filter(
        (role) => !String(role.agent_id || "").trim(),
      );

      for (const pendingRole of pendingRoles) {
        const pendingRoleUsers = roleBootstrapMembers
          .filter((item) => item.role_id === pendingRole.id && Number(item.is_active ?? 1) !== 0)
          .map((item) => String(item.user_id || "").trim())
          .filter(Boolean);

        const pendingRoleActions = roleBootstrapActions
          .filter((item) => item.role_id === pendingRole.id && Number(item.is_active ?? 1) !== 0)
          .map((item) => ({
            connectorId: String(item.connector_id || "").trim(),
            actionId: String(item.action_id || "").trim(),
          }))
          .filter((item) => item.connectorId && item.actionId);

        const savedRole = await (dispatch(
          saveTenantRole({
            name: pendingRole.name,
            description: String(pendingRole.description || "").trim(),
            agentId,
            connectorId: String(pendingRole.connector_id || "").trim(),
            toolId: String(pendingRole.tool_id || "").trim(),
            isActive: Number(pendingRole.is_active ?? 1) === 0 ? 0 : 1,
            userIds: pendingRoleUsers,
            actions: pendingRoleActions,
          }),
        ) as Promise<{ role?: { id?: string } }>);

        const savedRoleId = String(savedRole?.role?.id || pendingRole.id || "").trim();

        if (!savedRoleId) {
          throw new Error("Role save failed.");
        }

        if (savedRoleId !== pendingRole.id) {
          replaceRoleBootstrapState({
            previousRoleId: pendingRole.id,
            roleRecord: {
              ...pendingRole,
              id: savedRoleId,
              agent_id: agentId,
            },
            userIds: pendingRoleUsers,
            actions: pendingRoleActions,
          });
        } else {
          setRoleBootstrapRoles((current) =>
            current.map((item) =>
              item.id === savedRoleId
                ? {
                    ...item,
                    agent_id: agentId,
                  }
                : item,
            ),
          );
        }
      }

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
  const selectedCategory =
    selectedToolConnector?.display_name || serviceType || "General";
  const selectedTenantConnectorLabel =
    visibleTenantConnectors.find(
      ({ tenantConnector }) =>
        String(tenantConnector.id || "") === String(selectedTenantConnectorId || ""),
    )?.catalogConnector?.display_name || selectedTenantConnectorId || "Not selected";

  return (
    <main className="container mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
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

                          {/* <p
                            className={cn(
                              "mt-1 hidden text-xs leading-5 transition-colors duration-300 sm:block",
                              active && "text-muted-foreground",
                              complete && "text-muted-foreground",
                              upcoming && "text-muted-foreground",
                            )}
                          >
                            {step.description}
                          </p> */}
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
                            const nextValue = value === "none" ? "" : value;
                            setServiceType(nextValue);
                            setSelectedTenantConnectorId("");
                            setStep1FieldErrors((prev) => ({
                              ...prev,
                              serviceType: "",
                              tenantConnectorId: "",
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
                            <SelectItem value="none">
                              Select tool
                            </SelectItem>
                            {loadingConnectors ? (
                              <SelectItem value="loading" disabled>
                                Loading connectors...
                              </SelectItem>
                            ) : null}
                            {!loadingConnectors &&
                            visibleCatalogConnectors.length === 0 ? (
                              <SelectItem value="empty" disabled>
                                No connectors available.
                              </SelectItem>
                            ) : null}
                            {visibleCatalogConnectors.map((connector) => (
                              <SelectItem
                                key={connector.id}
                                value={connector.key}
                              >
                                {connector.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {step1FieldErrors.serviceType ? (
                          <p className="text-xs text-red-600">
                            {step1FieldErrors.serviceType}
                          </p>
                        ) : null}                      
                    </div>
                    <div className="space-y-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">
                              Select connector
                            </Label>
                            <Select
                              value={selectedTenantConnectorId || "none"}
                              onValueChange={(value) => {
                                const nextValue = value === "none" ? "" : value;

                                if (nextValue === "create-new") {
                                  if (selectedToolConnector) {
                                    openConnectorModal();
                                  }
                                  return;
                                }

                                setSelectedTenantConnectorId(nextValue);
                                setStep1FieldErrors((prev) => ({
                                  ...prev,
                                  tenantConnectorId: "",
                                }));
                              }}
                              disabled={!selectedToolConnector}
                            >
                              <SelectTrigger className="h-11 w-full bg-background">
                                <SelectValue placeholder="Select connector" />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                className="w-(--radix-select-trigger-width)"
                              >
                                <SelectItem value="none">
                                  Select connector
                                </SelectItem>
                                {loadingTenantConnectors ? (
                                  <SelectItem value="loading" disabled>
                                    Loading tenant connectors...
                                  </SelectItem>
                                ) : null}
                                {!loadingTenantConnectors &&
                                selectedToolConnector &&
                                visibleTenantConnectors.length === 0 ? (
                                  <SelectItem value="empty" disabled>
                                    No saved connectors yet
                                  </SelectItem>
                                ) : null}
                                {visibleTenantConnectors.map(
                                  ({ tenantConnector, catalogConnector }) => (
                                    <SelectItem
                                      key={tenantConnector.id}
                                      value={tenantConnector.id}
                                    >
                                      {catalogConnector?.display_name ||
                                        tenantConnector.connector_id}
                                      {tenantConnector.status
                                        ? ` · ${tenantConnector.status}`
                                        : ""}
                                    </SelectItem>
                                  ),
                                )}
                                {selectedToolConnector ? (
                                  <SelectItem value="create-new">
                                    Create new connector
                                  </SelectItem>
                                ) : null}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      {step1FieldErrors.tenantConnectorId ? (
                        <p className="text-xs text-red-600">
                          {step1FieldErrors.tenantConnectorId}
                        </p>
                      ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            
            {currentStep === 2 ? (
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="grid min-h-162.5 grid-cols-1 lg:grid-cols-[300px_1fr]">
                  <div className="border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
                    {/* <div className="border-b border-border">
                      <div
                        role="tablist"
                        aria-label="Role management views"
                        className="grid grid-cols-2 gap-1 border border-border bg-background p-1.5 shadow-sm"
                      >
                        <Button
                          type="button"
                          role="tab"
                          aria-selected={roleViewMode === "roles"}
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoleViewMode("roles")}
                          className={cn(
                            "h-10 rounded-xl px-4 text-sm font-semibold transition-all duration-200 cursor-pointer",
                            roleViewMode === "roles"
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                          )}
                        >
                          Roles
                        </Button>
                        <Button
                          type="button"
                          role="tab"
                          aria-selected={roleViewMode === "users"}
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoleViewMode("users")}
                          className={cn(
                            "h-10 rounded-xl px-4 text-sm font-semibold transition-all duration-200 cursor-pointer",
                            roleViewMode === "users"
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                          )}
                        >
                          Users
                        </Button>
                      </div>
                    </div> */}
                    <div className="border-b border-border">
                        <div className="flex w-full rounded-lg bg-muted/40 p-1">
                          <nav
                            className="flex w-full gap-x-1 bg-gray-100 rounded-sm"
                            aria-label="Role management views"
                            role="tablist"
                            aria-orientation="horizontal"
                          >
                            <Button
                              type="button"
                              role="tab"
                              aria-selected={roleViewMode === "roles"}
                              variant="ghost"
                              size="sm"
                              onClick={() => setRoleViewMode("roles")}
                              className={cn(
                                "inline-flex h-10 flex-1 items-center justify-center gap-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                roleViewMode === "roles"
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-transparent text-slate-600 hover:text-primary hover:bg-white/90",
                              )}
                            >
                              Roles
                            </Button>

                            <Button
                              type="button"
                              role="tab"
                              aria-selected={roleViewMode === "users"}
                              variant="ghost"
                              size="sm"
                              onClick={() => setRoleViewMode("users")}
                              className={cn(
                                "inline-flex h-10 flex-1 items-center justify-center gap-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                roleViewMode === "users"
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-transparent text-slate-600 hover:text-primary hover:bg-white/90",
                              )}
                            >
                              Users
                            </Button>
                          </nav>
                        </div>
                    </div>

                    {roleViewMode === "roles" ? (
                      <div className="space-y-3 p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created roles</p>
                          </div>
                          <div className="space-y-2">
                            {!currentAgentId ? (
                              <div className="rounded-xl border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground">
                                Create or update roles after the agent is saved.
                              </div>
                            ) : null}
                            {visibleRoleBootstrapRoles.length === 0 && currentAgentId ? (
                              <div className="rounded-xl border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground">
                                No roles created for this agent yet.
                              </div>
                            ) : null}
                            {visibleRoleBootstrapRoles
                              .map((role) => {
                                const selected = role.id === selectedRoleId;
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => selectRole(role)}
                                    className={cn(
                                      "flex w-full items-start justify-between rounded-xl border px-3 py-3 text-left transition-colors",
                                      selected ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/40",
                                    )}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">{role.name}</p>
                                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{role.description || "No description"}</p>
                                    </div>
                                    <div className="ml-3 flex shrink-0 flex-col items-end gap-1 text-[10px] text-muted-foreground">
                                      <span>{roleBootstrapMembers.filter((item) => item.role_id === role.id && Number(item.is_active ?? 1) !== 0).length} users</span>
                                      <span>{roleBootstrapActions.filter((item) => item.role_id === role.id && Number(item.is_active ?? 1) !== 0).length} actions</span>
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                          <div>
                            <Button type="button" variant="outline" className="w-full cursor-pointer hover:text-primary" size="lg" onClick={openRoleModal}>
                              Add role
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Users
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Search and add tenant users for this agent.
                            </p>
                          </div>
                        </div>
                        <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users..." />
                        <div className="space-y-2 max-h-130 overflow-y-auto pr-1">
                          {filteredUsers.map((user) => {
                            const id = String(user.id);
                            const selected = selectedUserId === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setSelectedUserId(id)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors",
                                  selected ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/40",
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">{formatUserName(user)}</p>
                                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 p-4 sm:p-6">
                    {roleViewMode === "roles" ? (
                      visibleRoleBootstrapRoles.length === 0 ? (
                        <div className="min-h-105 rounded-2xl bg-background" />
                      ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Role details</p>
                            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                              {selectedRole ? selectedRole.name : "Create a role"}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedRole
                                ? "Update members and actions for this role."
                                : "No role is selected by default. Create a new one or select one from the left panel."}
                            </p>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-border">
                          <table className="min-w-full divide-y divide-border text-sm">
                            <tbody className="divide-y divide-border bg-background">
                              <tr>
                                <th className="w-40 bg-muted/30 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope</th>
                                <td className="px-4 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">Agent: {currentAgentId || "Not saved yet"}</Badge>
                                    <Badge variant="outline">Tool: {selectedCategory}</Badge>
                                    <Badge variant="outline">Connector: {selectedTenantConnectorLabel}</Badge>
                                    <Badge variant={roleIsActive ? "outline" : "destructive"}>{roleIsActive ? "Active" : "Inactive"}</Badge>
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <th className="bg-muted/30 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</th>
                                <td className="px-4 py-4">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users..." className="max-w-sm" />
                                      <Badge variant="outline">{selectedRoleUserIds.length} selected</Badge>
                                    </div>

                                    {userSearch.trim().length < 3 ? (
                                      <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                                        Type at least 3 characters to search users.
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {loadingUsers ? <span className="text-sm text-muted-foreground">Loading users...</span> : null}
                                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                          {filteredUsers.map((user) => {
                                            const userId = String(user.id);
                                            const checked = selectedRoleUserIds.includes(userId);
                                            return (
                                              <label key={userId} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors", checked ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/20")}>
                                                <Checkbox checked={checked} onCheckedChange={() => toggleRoleUser(userId)} />
                                                <div className="min-w-0">
                                                  <p className="truncate text-sm font-medium text-foreground">{formatUserName(user)}</p>
                                                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    <div className="space-y-2">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected users</p>
                                      {selectedRoleUsers.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                                          No users selected yet.
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {selectedRoleUsers.map((user) => {
                                            const userId = String(user.id);
                                            return (
                                              <span key={userId} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground">
                                                <span className="max-w-xs truncate">{formatUserName(user)}</span>
                                                <button type="button" onClick={() => toggleRoleUser(userId)} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label={`Remove ${formatUserName(user)}`}>
                                                  ×
                                                </button>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <th className="bg-muted/30 px-4 py-4 align-top text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                                <td className="px-4 py-4">
                                  {!selectedToolConnector ? (
                                    <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                                      Select a tool in step 1 to load tool actions for this role.
                                    </div>
                                  ) : null}
                                  {selectedToolConnector ? (
                                    <div className="space-y-3">
                                      {selectedToolActions.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                                          No actions found for the selected tool.
                                        </div>
                                      ) : null}
                                      <div className="grid gap-3">
                                        {selectedToolActions.map((action) => {
                                          const checked = selectedRoleActionIds.includes(action.id);
                                          return (
                                            <div key={action.id} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors", checked ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/20") }>
                                              <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">{action.display_name}</p>
                                                <p className="truncate text-xs text-muted-foreground">{action.action_key}</p>
                                              </div>
                                              <Switch checked={checked} size="md" onCheckedChange={() => toggleRoleAction(action.id)} />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">User actions</p>
                              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                                {selectedUserLabel}
                              </h2>
                            <p className="mt-1 text-sm text-muted-foreground">Switches update the underlying role actions for roles this user belongs to.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* <Badge variant="outline">{selectedUserActions.length} effective</Badge> */}
                            <Button type="button" variant="outline" onClick={() => selectedUserId ? void loadUserActions(selectedUserId) : null} disabled={!selectedUserId || loadingUserActions || savingUserAction}>Refresh</Button>
                            <Button
                                type="button"
                                variant="outline"
                                className=""
                                onClick={() => {
                                  setAddUserModalOpen(true);
                                }}
                            >
                                Add User
                            </Button>
                          </div>
                        </div>

                        {userActionError ? (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {userActionError}
                          </div>
                        ) : null}

                        <div className="overflow-hidden rounded-2xl border border-border">
                          <table className="min-w-full divide-y divide-border text-sm">
                            <tbody className="divide-y divide-border bg-background">
                              <tr>
                                <th className="w-40 bg-muted/30 px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                                {/* <td className="px-4 py-4">
                                  {selectedUserId ? (
                                    <div>
                                      <p className="font-medium text-foreground">{selectedUserLabel}</p>
                                      <p className="text-xs text-muted-foreground">{selectedUserEmail}</p>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Choose a user from the left list.</span>
                                  )}
                                </td> */}
                              </tr>
                              <tr>
                                <th className="bg-muted/30 px-4 py-4 align-top text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                                <td className="px-4 py-4">
                                  {loadingUserActions ? (
                                    <div className="text-sm text-muted-foreground">Loading actions...</div>
                                  ) : !selectedToolConnector ? (
                                    <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">Select a tool in step 1 to view its actions.</div>
                                  ) : selectedToolActions.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">No actions found for the selected tool.</div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="grid gap-2 md:grid-cols-2">
                                        {selectedToolActions.map((action) => {
                                          const selectedAction = selectedUserActions.find((item) => String(item.action_id || "") === String(action.id));
                                          const assigned = Boolean(selectedAction);
                                          const locked = String(selectedAction?.grant_source || "") === "role";

                                          return (
                                            <div key={action.id} className={cn("rounded-xl border px-3 py-3", assigned ? "border-primary bg-primary/5" : "border-border bg-background") }>
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <p className="text-sm font-medium text-foreground">{action.display_name}</p>
                                                  <p className="text-xs text-muted-foreground">{action.action_key}</p>
                                                </div>
                                                <Switch
                                                  checked={assigned}
                                                  disabled={savingUserAction || locked}
                                                  onCheckedChange={(nextChecked) => {
                                                    if (locked) return;
                                                    void handleUserActionToggle(action, Boolean(nextChecked));
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1 mt-4 flex gap-4">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Active
                      </Label>
                      <Switch checked={isActive} size="md" onCheckedChange={setIsActive} />
                    </div>
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
                      tenantConnectorId: selectedTenantConnectorId,
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
                  disabled={!canEnableSaveAgent}
                  onClick={createAgent}
                >
                  {saving ? "Saving..." : finalButtonLabel}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>

      <ConnectorDialog
        open={connectorModalOpen}
        onOpenChange={setConnectorModalOpen}
        selectedCatalogConnector={selectedToolConnector || connectors[0] || null}
        onConnectorSaved={handleConnectorSaved}
      />

      <RoleDialog
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        tenantId={tenantId}
        selectedRoleId={selectedRoleId}
        initialRoleName={roleName}
        initialRoleIsActive={roleIsActive}
        roleDescription={roleDescription}
        roleConnectorId={roleConnectorId}
        roleToolId={roleToolId}
        fallbackConnectorId={selectedToolConnector?.id || connectors[0]?.id || ""}
        fallbackToolId={
          selectedToolActions[0]?.id ||
          roleActionCatalog.find(
            (item) =>
              item.connector_id ===
              (roleConnectorId || selectedToolConnector?.id || connectors[0]?.id || ""),
          )?.id ||
          ""
        }
        selectedRoleUserIds={selectedRoleUserIds}
        selectedRoleActionIds={selectedRoleActionIds}
        roleActionCatalog={roleActionCatalog}
        buildRoleAutoName={buildRoleAutoName}
        onRoleSaved={handleRoleSaved}
      />

      <AddUserDialog
        open={addUserModalOpen}
        onOpenChange={setAddUserModalOpen}
        onUserSaved={async () => {
          await loadUsers({ forceRefresh: true });
        }}
      />
    </main>
  );
}
