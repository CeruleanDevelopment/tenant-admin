"use client";

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

export type ConnectorCredentialField = {
  name: string;
  label: string;
  type: string;
  description?: string;
  required: boolean;
  options?: string[];
};

type ConnectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCatalogConnector: ConnectorCatalogItem | null;
  connectorModalLoading: boolean;
  connectorModalError: string | null;
  connectorModalSuccess: string | null;
  connectorModalSaving: boolean;
  connectorModalTesting: boolean;
  selectedConnectorVersionId: string;
  connectorVersions: ConnectorVersionItem[];
  selectedConnectorAuthSchemeId: string;
  connectorAuthSchemes: ConnectorAuthSchemeItem[];
  selectedConnectorFields: ConnectorCredentialField[];
  connectorCredentialValues: Record<string, string>;
  closeConnectorModal: () => void;
  handleConnectorVersionSelection: (versionId: string) => Promise<void>;
  handleConnectorAuthSchemeSelection: (authSchemeId: string) => void;
  handleConnectorFieldChange: (fieldName: string, value: string) => void;
  handleConnectorTest: () => void;
  handleConnectorSave: () => Promise<void>;
  formatConnectorAuthSchemeLabel: (scheme: ConnectorAuthSchemeItem) => string;
  getConnectorAuthMethodHint: (
    connector: ConnectorCatalogItem | null,
  ) => string;
};

export default function ConnectorDialog({
  open,
  onOpenChange,
  selectedCatalogConnector,
  connectorModalLoading,
  connectorModalError,
  connectorModalSuccess,
  connectorModalSaving,
  connectorModalTesting,
  selectedConnectorVersionId,
  connectorVersions,
  selectedConnectorAuthSchemeId,
  connectorAuthSchemes,
  selectedConnectorFields,
  connectorCredentialValues,
  closeConnectorModal,
  handleConnectorVersionSelection,
  handleConnectorAuthSchemeSelection,
  handleConnectorFieldChange,
  handleConnectorTest,
  handleConnectorSave,
  formatConnectorAuthSchemeLabel,
  getConnectorAuthMethodHint,
}: ConnectorDialogProps) {
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
      <DialogContent className="sm:max-w-4xl rounded-2xl border border-border bg-background p-0">
        <div className="p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle>Create Connector</DialogTitle>
            <DialogDescription>
              Choose a connector from the catalog, enter the tenant
              credentials, then test and save it for future use.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
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
                    <Label className="text-xs font-medium text-muted-foreground">
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
                      {getConnectorAuthMethodHint(selectedCatalogConnector) ? (
                        <Badge variant="secondary" className="rounded-full">
                          PAT / Basic auth
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
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
                <Label className="text-xs font-medium text-muted-foreground">
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
                {getConnectorAuthMethodHint(selectedCatalogConnector) ? (
                  <p className="text-xs text-muted-foreground">
                    {getConnectorAuthMethodHint(selectedCatalogConnector)}
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
                          {field.type === "object" || field.type === "array" ? (
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
                              type={field.type === "number" ? "number" : "text"}
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

          <DialogFooter className="mt-6 px-0 pb-0">
            <Button
              type="button"
              variant="outline"
              onClick={closeConnectorModal}
              disabled={connectorModalSaving || connectorModalTesting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleConnectorTest}
              disabled={connectorModalSaving || connectorModalTesting}
            >
              {connectorModalTesting ? "Testing..." : "Test Connector"}
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90"
              onClick={() => void handleConnectorSave()}
              disabled={connectorModalSaving || connectorModalLoading}
            >
              {connectorModalSaving ? "Saving..." : "Save Connector"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}