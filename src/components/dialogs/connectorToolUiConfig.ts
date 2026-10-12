type AuthTypeConfig = {
  label?: string;
  hint?: string;
  hiddenCredentialFields?: string[];
};

type ConnectorToolUiConfig = {
  authType?: Record<string, AuthTypeConfig>;
  hiddenCredentialFields?: string[];
};

const TOOL_UI_CONFIG: Record<string, ConnectorToolUiConfig> = {
  hubspot: {
    authType: {
      oauth2: {
        label: "Private App Token (Recommended)",
        hint: "Create a Private App in HubSpot (Settings > Integrations > Private Apps), select the CRM scopes, then paste its access token.",
      },
    },
  },
  "azure-devops": {
    authType: {
      oauth2: {
        label: "Microsoft Entra OAuth (Recommended)",
        hint: "",
      },
    },
  },
  "microsoft-dynamics-365-business-central": {
    hiddenCredentialFields: ["company_id"],
  },
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/_/g, "-");

const getConnectorConfig = (connectorKey: string): ConnectorToolUiConfig | null => {
  const key = normalize(String(connectorKey || ""));
  if (!key) return null;
  return TOOL_UI_CONFIG[key] || null;
};

const getAuthTypeConfig = (
  connectorKey: string,
  authType: string,
): AuthTypeConfig | null => {
  const connectorConfig = getConnectorConfig(connectorKey);
  if (!connectorConfig?.authType) return null;

  const normalizedAuthType = normalize(String(authType || ""));
  if (!normalizedAuthType) return null;
  return connectorConfig.authType[normalizedAuthType] || null;
};

export const getToolAuthLabelOverride = (
  connectorKey: string,
  authType: string,
): string => {
  return getAuthTypeConfig(connectorKey, authType)?.label || "";
};

export const getToolAuthHintOverride = (
  connectorKey: string,
  authType: string,
): string => {
  return getAuthTypeConfig(connectorKey, authType)?.hint || "";
};

export const isToolCredentialFieldHidden = (
  connectorKey: string,
  authType: string,
  fieldName: string,
): boolean => {
  const normalizedFieldName = String(fieldName || "").trim();
  if (!normalizedFieldName) return false;

  const connectorConfig = getConnectorConfig(connectorKey);
  if (!connectorConfig) return false;

  const connectorLevelHidden = new Set(
    (connectorConfig.hiddenCredentialFields || []).map((value) =>
      String(value || "").trim(),
    ),
  );
  if (connectorLevelHidden.has(normalizedFieldName)) return true;

  const authTypeHidden = new Set(
    (getAuthTypeConfig(connectorKey, authType)?.hiddenCredentialFields || []).map(
      (value) => String(value || "").trim(),
    ),
  );
  return authTypeHidden.has(normalizedFieldName);
};

export { TOOL_UI_CONFIG };
