"use client";

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

type RoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRoleId: string;
  roleBootstrapError: string | null;
  roleName: string;
  onRoleNameChange: (value: string) => void;
  roleIsActive: boolean;
  onRoleIsActiveChange: (value: boolean) => void;
  roleFormDisabled: boolean;
  savingRoleAccess: boolean;
  closeRoleModal: () => void;
  saveSelectedRoleAccess: () => Promise<void>;
};

export default function RoleDialog({
  open,
  onOpenChange,
  selectedRoleId,
  roleBootstrapError,
  roleName,
  onRoleNameChange,
  roleIsActive,
  onRoleIsActiveChange,
  roleFormDisabled,
  savingRoleAccess,
  closeRoleModal,
  saveSelectedRoleAccess,
}: RoleDialogProps) {
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
      <DialogContent className="sm:max-w-xl rounded-2xl border border-border bg-background p-0">
        <div className="p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle>{selectedRoleId ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              Create a role for the current agent. After saving, the new role
              will appear in the left list.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {roleBootstrapError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {roleBootstrapError}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Role name
              </Label>
              <Input
                value={roleName}
                onChange={(event) => onRoleNameChange(event.target.value)}
                placeholder="Enter role name"
                disabled={roleFormDisabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
              </div>
              <Switch
                checked={roleIsActive}
                onCheckedChange={(value) => onRoleIsActiveChange(Boolean(value))}
                disabled={roleFormDisabled}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 px-0 pb-0">
            <Button
              type="button"
              variant="outline"
              onClick={closeRoleModal}
              disabled={savingRoleAccess}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90"
              onClick={() => void saveSelectedRoleAccess()}
              disabled={roleFormDisabled}
            >
              {savingRoleAccess
                ? "Saving..."
                : selectedRoleId
                  ? "Update Role"
                  : "Create Role"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}