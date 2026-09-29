"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { saveTenantRole } from "../../../actions/auth";
import type { AppDispatch } from "../../../redux/store";
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
import { Switch } from "@/components/ui/switch";

type RoleBootstrapAction = {
  id: string;
  connector_id: string;
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

type RoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  agentId?: string;
  selectedRoleId: string;
  initialRoleName: string;
  initialRoleIsActive: boolean;
  roleDescription: string;
  roleConnectorId: string;
  roleToolId: string;
  fallbackConnectorId: string;
  fallbackToolId: string;
  selectedRoleUserIds: string[];
  selectedRoleActionIds: string[];
  roleActionCatalog: RoleBootstrapAction[];
  buildRoleAutoName: (connectorId: string, toolId: string) => string;
  onRoleSaved: (payload: {
    previousRoleId: string;
    roleRecord: RoleBootstrapRole;
    userIds: string[];
    actions: Array<{ connectorId: string; actionId: string }>;
  }) => void;
};

const createDraftRoleId = () => {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `draft-role-${randomPart}`;
};

export default function RoleDialog({
  tenantId,
  agentId,
  open,
  onOpenChange,
  selectedRoleId,
  initialRoleName,
  initialRoleIsActive,
  roleDescription,
  roleConnectorId,
  roleToolId,
  fallbackConnectorId,
  fallbackToolId,
  selectedRoleUserIds,
  selectedRoleActionIds,
  roleActionCatalog,
  buildRoleAutoName,
  onRoleSaved,
}: RoleDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [roleName, setRoleName] = useState(initialRoleName);
  const [roleIsActive, setRoleIsActive] = useState(initialRoleIsActive);
  const [roleBootstrapError, setRoleBootstrapError] = useState<string | null>(
    null,
  );
  const [savingRoleAccess, setSavingRoleAccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRoleName(initialRoleName);
    setRoleIsActive(initialRoleIsActive);
    setRoleBootstrapError(null);
    setSavingRoleAccess(false);
  }, [initialRoleIsActive, initialRoleName, open]);

  const resolvedConnectorId = useMemo(
    () => roleConnectorId || fallbackConnectorId || "",
    [fallbackConnectorId, roleConnectorId],
  );

  const resolvedToolId = useMemo(
    () =>
      roleToolId ||
      fallbackToolId ||
      roleActionCatalog.find((item) => item.connector_id === resolvedConnectorId)
        ?.id ||
      "",
    [fallbackToolId, resolvedConnectorId, roleActionCatalog, roleToolId],
  );

  const closeRoleModal = () => {
    onOpenChange(false);
  };

  const saveSelectedRoleAccess = async () => {
    const resolvedRoleName =
      roleName.trim() || buildRoleAutoName(resolvedConnectorId, resolvedToolId);

    if (!resolvedConnectorId) {
      setRoleBootstrapError("Unable to determine the connector for this role.");
      return;
    }

    if (!resolvedToolId) {
      setRoleBootstrapError("Unable to determine the tool for this role.");
      return;
    }

    setSavingRoleAccess(true);
    setRoleBootstrapError(null);

    try {
      const actions = selectedRoleActionIds
        .map((actionId) => roleActionCatalog.find((item) => item.id === actionId))
        .filter((item): item is RoleBootstrapAction => Boolean(item))
        .map((item) => ({ connectorId: item.connector_id, actionId: item.id }));

      let nextRoleId = String(selectedRoleId || "").trim();
      if (!nextRoleId || nextRoleId.startsWith("draft-role-")) {
        const created = await dispatch(
          saveTenantRole({
            name: resolvedRoleName,
            description: roleDescription.trim(),
            agentId: agentId || "",
            connectorId: resolvedConnectorId,
            toolId: resolvedToolId,
            isActive: roleIsActive ? 1 : 0,
            userIds: selectedRoleUserIds,
            actions,
          }),
        );
        const createdId = String(created?.role?.id || "").trim();
        nextRoleId = createdId || createDraftRoleId();
      }

      const roleRecord: RoleBootstrapRole = {
        id: nextRoleId,
        tenant_id: tenantId,
        user_id: null,
        agent_id: agentId || null,
        connector_id: resolvedConnectorId,
        tool_id: resolvedToolId,
        name: resolvedRoleName,
        description: roleDescription.trim(),
        is_active: roleIsActive ? 1 : 0,
      };

      onRoleSaved({
        previousRoleId: selectedRoleId,
        roleRecord: {
          ...roleRecord,
          agent_id: agentId || null,
        },
        userIds: selectedRoleUserIds,
        actions,
      });

      closeRoleModal();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? String((error as { message?: string }).message || "")
          : "";
      setRoleBootstrapError(message || "Failed to save role.");
    } finally {
      setSavingRoleAccess(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        closeRoleModal();
      }}
    >
      <DialogContent className="sm:max-w-xl overflow-hidden rounded-2xl border border-border bg-background p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 text-left">
          <DialogTitle className="text-lg">{selectedRoleId ? "Edit Role" : "Add Role"}</DialogTitle>
          {/* <DialogDescription className="pt-1">
            Create a role for the current agent. After saving, the new role
            will appear in the left list.
          </DialogDescription> */}
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="space-y-6">
            {roleBootstrapError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {roleBootstrapError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Role name
              </Label>
              <Input
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder="Enter role name"
                className="py-5"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
              </div>
              <Switch
                checked={roleIsActive}
                size="md"
                onCheckedChange={(value) => setRoleIsActive(Boolean(value))}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="min-h-20 border-t border-border bg-muted/20 px-6 py-0">
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={closeRoleModal}
              disabled={savingRoleAccess}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90 cursor-pointer"
              onClick={() => void saveSelectedRoleAccess()}
              disabled={savingRoleAccess}
            >
              {savingRoleAccess
                ? "Saving..."
                : selectedRoleId
                  ? "Update Role"
                  : "Create Role"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}