"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ConnectorAuthSchemeItem,
  ConnectorCatalogItem,
  ConnectorVersionItem,
} from "../../../actions/auth";
import {
  fetchConnectorAuthSchemes,
  fetchConnectorVersions,
  saveTenantConnectorBundle as saveConnectorBundle,
  testTenantConnectorCredentials,
} from "../../../actions/auth";
import type { AppDispatch } from "../../../redux/store";
import {
  getToolAuthHintOverride,
  getToolAuthLabelOverride,
  isToolCredentialFieldHidden,
} from "@/components/dialogs/connectorToolUiConfig";

export type ConnectorCredentialField = {
  name: string;
  label: string;
  type: string;
  format?: string;
  description?: string;
  required: boolean;
  options?: string[];
};

type ConnectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCatalogConnector: ConnectorCatalogItem | null;
  onConnectorSaved?: (payload: {
    tenantConnectorId: string;
    connectorId: string;
  }) => Promise<void> | void;
};

export default function ConnectorDialog({
  open,
  onOpenChange,
  selectedCatalogConnector,
  onConnectorSaved,
}: ConnectorDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const [connectorModalLoading, setConnectorModalLoading] = useState(false);
  const [connectorModalError, setConnectorModalError] = useState<string | null>(
    null,
  );
  const [connectorModalSuccess, setConnectorModalSuccess] = useState<
    string | null
  >(null);
  const [connectorModalSaving, setConnectorModalSaving] = useState(false);
  const [connectorModalTesting, setConnectorModalTesting] = useState(false);
  const [selectedConnectorVersionId, setSelectedConnectorVersionId] =
    useState("");
  const [connectorVersions, setConnectorVersions] = useState<
    ConnectorVersionItem[]
  >([]);
  const [selectedConnectorAuthSchemeId, setSelectedConnectorAuthSchemeId] =
    useState("");
  const [connectorAuthSchemes, setConnectorAuthSchemes] = useState<
    ConnectorAuthSchemeItem[]
  >([]);
  const [connectorCredentialValues, setConnectorCredentialValues] = useState<
    Record<string, string>
  >({});

  const toTitleCase = (value: string) =>
    value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const getObjectString = (
    source: Record<string, unknown> | null | undefined,
    keys: string[],
  ): string => {
    if (!source) return "";
    for (const key of keys) {
      const candidate = source[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return "";
  };

  const selectedConnectorAuthScheme = useMemo(
    () =>
      connectorAuthSchemes.find(
        (scheme) => scheme.id === selectedConnectorAuthSchemeId,
      ) || null,
    [connectorAuthSchemes, selectedConnectorAuthSchemeId],
  );

  const formatConnectorAuthSchemeLabel = (scheme: ConnectorAuthSchemeItem) => {
    const connectorKey = String(selectedCatalogConnector?.key || "");
    const authType = String(scheme.auth_type || "").trim().toLowerCase();
    const toolOverrideLabel = getToolAuthLabelOverride(connectorKey, authType);
    if (toolOverrideLabel) return toolOverrideLabel;

    const config =
      scheme.config && typeof scheme.config === "object"
        ? (scheme.config as Record<string, unknown>)
        : null;
    const configLabel = getObjectString(config, [
      "display_name",
      "label",
      "auth_label",
      "ui_label",
    ]);
    if (configLabel) return configLabel;

    if (!authType) return "Authentication";
    return toTitleCase(authType);
  };

  const getConnectorAuthMethodHint = () => {
    const connectorKey = String(selectedCatalogConnector?.key || "");
    const authType = String(selectedConnectorAuthScheme?.auth_type || "");
    const toolOverrideHint = getToolAuthHintOverride(connectorKey, authType);
    if (toolOverrideHint) return toolOverrideHint;

    const config =
      selectedConnectorAuthScheme?.config &&
      typeof selectedConnectorAuthScheme.config === "object"
        ? (selectedConnectorAuthScheme.config as Record<string, unknown>)
        : null;
    return getObjectString(config, [
      "instructions",
      "help_text",
      "auth_hint",
      "hint",
    ]);
  };

  const buildCredentialFields = (schema: unknown): ConnectorCredentialField[] => {
    const schemaRecord =
      schema && typeof schema === "object"
        ? (schema as Record<string, unknown>)
        : {};
    const properties =
      schemaRecord.properties && typeof schemaRecord.properties === "object"
        ? (schemaRecord.properties as Record<string, Record<string, unknown>>)
        : {};
    const required = new Set(
      Array.isArray(schemaRecord.required)
        ? schemaRecord.required
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        : [],
    );

    const connectorKey = String(selectedCatalogConnector?.key || "");
    const authType = String(selectedConnectorAuthScheme?.auth_type || "");

    return Object.entries(properties)
      .filter(([name, definition]) => {
        const xHidden = definition["x-hidden"];
        const xHiddenAlt = definition["x_hidden"];
        if (xHidden === true || xHiddenAlt === true) return false;
        if (isToolCredentialFieldHidden(connectorKey, authType, name)) {
          return false;
        }
        return true;
      })
      .map(([name, definition]) => ({
        name,
        label: String(definition.title || name.replace(/_/g, " ")).replace(
          /^./,
          (char) => char.toUpperCase(),
        ),
        type: String(definition.type || "string"),
        format: String(definition.format || "").trim() || undefined,
        description: String(definition.description || "").trim(),
        required: required.has(name),
        options: Array.isArray(definition.enum)
          ? definition.enum.map((value) => String(value || ""))
          : undefined,
      }));
  };

  const getDefaultCredentialValues = (fields: ConnectorCredentialField[]) => {
    const nextValues: Record<string, string> = {};
    fields.forEach((field) => {
      nextValues[field.name] = field.type === "boolean" ? "false" : "";
    });
    return nextValues;
  };

  const selectedConnectorFields = useMemo(() => {
    return buildCredentialFields(
      selectedConnectorAuthScheme?.credential_schema || {},
    );
  }, [selectedConnectorAuthScheme]);

  const resetState = () => {
    setConnectorModalLoading(false);
    setConnectorModalError(null);
    setConnectorModalSuccess(null);
    setConnectorModalSaving(false);
    setConnectorModalTesting(false);
    setSelectedConnectorVersionId("");
    setConnectorVersions([]);
    setSelectedConnectorAuthSchemeId("");
    setConnectorAuthSchemes([]);
    setConnectorCredentialValues({});
  };

  const loadConnectorMetadata = async () => {
    const connectorId = String(selectedCatalogConnector?.id || "").trim();
    if (!connectorId || !open) return;

    setConnectorModalLoading(true);
    setConnectorModalError(null);
    try {
      const versions = (await dispatch(
        fetchConnectorVersions(connectorId),
      )) as ConnectorVersionItem[];
      setConnectorVersions(versions);

      const preferredVersion =
        versions.find(
          (version) =>
            String(version.status || "").toLowerCase() === "published",
        ) ||
        versions[0] ||
        null;
      const versionId = preferredVersion?.id || "";
      setSelectedConnectorVersionId(versionId);

      const authSchemes = versionId
        ? ((await dispatch(
            fetchConnectorAuthSchemes(versionId),
          )) as ConnectorAuthSchemeItem[])
        : [];
      setConnectorAuthSchemes(authSchemes);

      const preferredAuthScheme =
        authSchemes.find((scheme) => Boolean(scheme.is_default)) ||
        authSchemes[0] ||
        null;
      const authSchemeId = preferredAuthScheme?.id || "";
      setSelectedConnectorAuthSchemeId(authSchemeId);

      const fields = buildCredentialFields(
        preferredAuthScheme?.credential_schema || {},
      );
      setConnectorCredentialValues(getDefaultCredentialValues(fields));
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? String((error as { message?: string }).message || "")
          : "";
      setConnectorModalError(message || "Failed to load connector metadata.");
    } finally {
      setConnectorModalLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    void loadConnectorMetadata();
  }, [open, selectedCatalogConnector?.id]);

  const handleConnectorVersionSelection = async (versionId: string) => {
    const nextVersionId = String(versionId || "").trim();
    setSelectedConnectorVersionId(nextVersionId);
    setConnectorModalError(null);
    setConnectorModalSuccess(null);

    if (!nextVersionId) {
      setConnectorAuthSchemes([]);
      setSelectedConnectorAuthSchemeId("");
      setConnectorCredentialValues({});
      return;
    }

    try {
      const authSchemes = await (dispatch(
        fetchConnectorAuthSchemes(nextVersionId),
      ) as Promise<ConnectorAuthSchemeItem[]>);
      setConnectorAuthSchemes(authSchemes);
      const preferredAuthScheme =
        authSchemes.find((scheme) => Boolean(scheme.is_default)) ||
        authSchemes[0] ||
        null;
      const authSchemeId = preferredAuthScheme?.id || "";
      setSelectedConnectorAuthSchemeId(authSchemeId);
      const fields = buildCredentialFields(
        preferredAuthScheme?.credential_schema || {},
      );
      setConnectorCredentialValues(getDefaultCredentialValues(fields));
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? String((error as { message?: string }).message || "")
          : "";
      setConnectorModalError(message || "Failed to load auth schemes.");
    }
  };

  const handleConnectorAuthSchemeSelection = (authSchemeId: string) => {
    const nextAuthSchemeId = String(authSchemeId || "").trim();
    setSelectedConnectorAuthSchemeId(nextAuthSchemeId);

    const authScheme =
      connectorAuthSchemes.find((scheme) => scheme.id === nextAuthSchemeId) ||
      null;
    const fields = buildCredentialFields(authScheme?.credential_schema || {});
    setConnectorCredentialValues(getDefaultCredentialValues(fields));
  };

  const handleConnectorFieldChange = (fieldName: string, value: string) => {
    setConnectorCredentialValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const buildConnectorDraft = () => {
    const connector = selectedCatalogConnector;
    const authScheme =
      connectorAuthSchemes.find(
        (scheme) => scheme.id === selectedConnectorAuthSchemeId,
      ) || null;

    if (!connector) {
      return { error: "Select a connector first." } as const;
    }

    if (!selectedConnectorVersionId) {
      return { error: "Connector version is required." } as const;
    }

    if (!authScheme) {
      return { error: "Connector auth scheme is required." } as const;
    }

    const credentials: Record<string, unknown> = {};
    for (const field of selectedConnectorFields) {
      const rawValue = String(
        connectorCredentialValues[field.name] || "",
      ).trim();
      if (field.required && !rawValue) {
        return { error: `${field.label} is required.` } as const;
      }

      if (!rawValue) {
        continue;
      }

      if (field.type === "number") {
        const parsed = Number(rawValue);
        credentials[field.name] = Number.isFinite(parsed) ? parsed : rawValue;
      } else if (field.type === "boolean") {
        credentials[field.name] = rawValue === "true" || rawValue === "1";
      } else {
        credentials[field.name] = rawValue;
      }
    }

    return {
      connector,
      authScheme,
      credentials,
    } as const;
  };

  const handleConnectorTest = async () => {
    setConnectorModalTesting(true);
    const draft = buildConnectorDraft();
    if ("error" in draft) {
      setConnectorModalError(draft.error || "Failed to prepare connector.");
      setConnectorModalSuccess(null);
      setConnectorModalTesting(false);
      return;
    }

    try {
      const testResult = await dispatch(
        testTenantConnectorCredentials({
          connectorId: draft.connector.id,
          connectorVersionId: selectedConnectorVersionId,
          connectorAuthSchemeId: draft.authScheme.id,
          credentials: draft.credentials,
        }),
      );

      setConnectorModalError(null);
      setConnectorModalSuccess(
        testResult?.message ||
          `Credentials for ${draft.connector.display_name} look valid. Save to persist this connector for the tenant.`,
      );
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? String((error as { message?: string }).message || "")
          : "";
      setConnectorModalError(message || "Connector test failed.");
      setConnectorModalSuccess(null);
    } finally {
      setConnectorModalTesting(false);
    }
  };

  const handleConnectorSave = async () => {
    const draft = buildConnectorDraft();
    if ("error" in draft) {
      setConnectorModalError(draft.error || "Failed to prepare connector.");
      setConnectorModalSuccess(null);
      return;
    }

    setConnectorModalSaving(true);
    setConnectorModalError(null);
    try {
      const result = await dispatch(
        saveConnectorBundle({
          connectorId: draft.connector.id,
          connectorVersionId: selectedConnectorVersionId,
          connectorAuthSchemeId: draft.authScheme.id,
          connectorType: draft.connector.key,
          connectorDisplayName: draft.connector.display_name,
          authMode: draft.authScheme.auth_type,
          credentials: draft.credentials,
          refreshMetadata: {},
          status: "active",
        }),
      );

      const tenantConnectorId = String(
        (result as { tenantConnector?: { id?: string } })?.tenantConnector
          ?.id || "",
      ).trim();

      if (tenantConnectorId && onConnectorSaved) {
        await onConnectorSaved({
          tenantConnectorId,
          connectorId: draft.connector.id,
        });
      }

      setConnectorModalSuccess("Connector saved for this tenant.");
      setTimeout(() => {
        onOpenChange(false);
      }, 400);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? String((error as { message?: string }).message || "")
          : "";
      setConnectorModalError(message || "Failed to save connector.");
    } finally {
      setConnectorModalSaving(false);
    }
  };

  const closeConnectorModal = () => {
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        closeConnectorModal();
      }}
    >
      <DialogContent className="sm:max-w-4xl overflow-hidden rounded-2xl border border-border bg-background p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 text-left">
          <DialogTitle className="text-lg">Create Connector</DialogTitle>
          {/* <DialogDescription className="pt-1">
            Choose a connector from the catalog, enter the tenant credentials,
            then test and save it for future use.
          </DialogDescription> */}
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="space-y-4">
            {connectorModalError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {connectorModalError}
              </div>
            ) : null}
            {connectorModalSuccess ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                {connectorModalSuccess}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 lg:col-span-2 rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Connector
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedCatalogConnector
                        ? `${selectedCatalogConnector.display_name} is the active tool connector.`
                        : "Select a tool first to create a connector."}
                    </p>
                  </div>
                  {connectorModalLoading ? (
                    <Badge className="rounded-full bg-primary/10 text-primary">
                      Loading
                    </Badge>
                  ) : null}
                </div>
                {selectedCatalogConnector ? (
                  <div className="mt-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {selectedCatalogConnector.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCatalogConnector.key}
                        </p>
                      </div>
                      {getConnectorAuthMethodHint() ? (
                        <Badge variant="secondary" className="rounded-full">
                          Microsoft Entra OAuth
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Version
                </Label>
                <Select
                  value={selectedConnectorVersionId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value === "none" ? "" : value;
                    if (nextValue) {
                      void handleConnectorVersionSelection(nextValue);
                    }
                  }}
                >
                  <SelectTrigger className="h-11 w-full bg-background">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="w-(--radix-select-trigger-width)"
                  >
                    <SelectItem value="none">Select version</SelectItem>
                    {connectorVersions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Auth Scheme
                </Label>
                <Select
                  value={selectedConnectorAuthSchemeId || "none"}
                  onValueChange={(value) => {
                    const nextValue = value === "none" ? "" : value;
                    if (nextValue) {
                      handleConnectorAuthSchemeSelection(nextValue);
                    }
                  }}
                >
                  <SelectTrigger className="h-11 w-full bg-background">
                    <SelectValue placeholder="Select auth scheme" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="w-(--radix-select-trigger-width)"
                  >
                    <SelectItem value="none">Select auth scheme</SelectItem>
                    {connectorAuthSchemes.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {formatConnectorAuthSchemeLabel(scheme)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getConnectorAuthMethodHint() ? (
                  <p className="text-xs text-muted-foreground">
                    {getConnectorAuthMethodHint()}
                  </p>
                ) : null}
              </div>

              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedCatalogConnector?.display_name ||
                          "Connector details"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCatalogConnector?.key ||
                          "Select a connector to continue."}
                      </p>
                    </div>
                    {connectorModalLoading ? (
                      <Badge className="rounded-full bg-primary/10 text-primary">
                        Loading
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {selectedConnectorFields.map((field) => {
                      const value = connectorCredentialValues[field.name] || "";

                      return (
                        <div
                          key={field.name}
                          className={
                            field.type === "object" || field.type === "array"
                              ? "sm:col-span-2"
                              : ""
                          }
                        >
                          <Label className="text-xs font-medium text-muted-foreground">
                            {field.label}
                            {field.required ? " *" : ""}
                          </Label>
                          {field.options && field.options.length > 0 ? (
                            <Select
                              value={value || "__none__"}
                              onValueChange={(nextValue) =>
                                handleConnectorFieldChange(
                                  field.name,
                                  nextValue === "__none__" ? "" : nextValue,
                                )
                              }
                            >
                              <SelectTrigger className="mt-2 h-11 w-full bg-background">
                                <SelectValue placeholder={`Select ${field.label}`} />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                className="w-(--radix-select-trigger-width)"
                              >
                                <SelectItem value="__none__">
                                  Select {field.label}
                                </SelectItem>
                                {field.options.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === "boolean" ? (
                            <Select
                              value={value || "false"}
                              onValueChange={(nextValue) =>
                                handleConnectorFieldChange(field.name, nextValue)
                              }
                            >
                              <SelectTrigger className="mt-2 h-11 w-full bg-background">
                                <SelectValue placeholder={`Select ${field.label}`} />
                              </SelectTrigger>
                              <SelectContent
                                position="popper"
                                className="w-(--radix-select-trigger-width)"
                              >
                                <SelectItem value="true">True</SelectItem>
                                <SelectItem value="false">False</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : field.type === "object" || field.type === "array" ? (
                            <textarea
                              className="mt-2 min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                              value={value}
                              onChange={(event) =>
                                handleConnectorFieldChange(
                                  field.name,
                                  event.target.value,
                                )
                              }
                              placeholder={field.description || `Enter ${field.label}`}
                            />
                          ) : (
                            <Input
                              className="mt-2 h-11 bg-background"
                              type={
                                field.type === "number"
                                  ? "number"
                                  : field.format === "password"
                                    ? "password"
                                  : /secret|token|password/i.test(field.name)
                                    ? "password"
                                    : "text"
                              }
                              value={value}
                              onChange={(event) =>
                                handleConnectorFieldChange(
                                  field.name,
                                  event.target.value,
                                )
                              }
                              placeholder={field.description || `Enter ${field.label}`}
                            />
                          )}
                          {field.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {field.description}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}

                    {selectedConnectorFields.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
                        Select a connector version and auth scheme to load
                        credential fields.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="min-h-20 border-t border-border bg-muted/20 px-6 py-0">
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={closeConnectorModal}
              disabled={connectorModalSaving || connectorModalTesting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
                    onClick={() => void handleConnectorTest()}
              disabled={connectorModalSaving || connectorModalTesting}
            >
              {connectorModalTesting ? "Testing..." : "Test Connector"}
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90 cursor-pointer"
              onClick={() => void handleConnectorSave()}
              disabled={connectorModalSaving || connectorModalLoading}
            >
              {connectorModalSaving ? "Saving..." : "Save Connector"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}