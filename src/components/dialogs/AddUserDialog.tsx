"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
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
import { addTenantUser } from "../../../actions/auth";
import type { AppDispatch } from "../../../redux/store";

type AddUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserSaved?: () => Promise<void> | void;
};

export default function AddUserDialog({
  open,
  onOpenChange,
  onUserSaved,
}: AddUserDialogProps) {
  const dispatch = useDispatch<AppDispatch>();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;

    setFirstName("");
    setLastName("");
    setEmail("");
    setIsActive(true);
    setAddUserError(null);
    setAddingUser(false);
  }, [open]);

  const closeDialog = () => {
    onOpenChange(false);
  };

  const handleAddUserSubmit = async () => {
    const safeEmail = email.trim();
    const safeFirstName = firstName.trim();
    const safeLastName = lastName.trim();

    if (!safeFirstName) {
      setAddUserError("First name is required.");
      return;
    }

    if (!safeLastName) {
      setAddUserError("Last name is required.");
      return;
    }

    if (!safeEmail) {
      setAddUserError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      setAddUserError("Enter a valid email address.");
      return;
    }

    setAddingUser(true);
    setAddUserError(null);

    try {
      await dispatch(
        addTenantUser({
          email: safeEmail,
          firstName: safeFirstName,
          lastName: safeLastName,
          isActive: isActive ? 1 : 0,
        }),
      );

      if (onUserSaved) {
        await onUserSaved();
      }

      closeDialog();
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-xl overflow-hidden rounded-2xl border border-border bg-background p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 text-left">
          <DialogTitle className="text-lg">Add User</DialogTitle>
          {/* <DialogDescription className="pt-1">
            Create a user from the assignment step, then close this modal to
            refresh the list.
          </DialogDescription> */}
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="space-y-4">
            {addUserError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {addUserError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  First name
                </Label>
                <Input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Last name
                </Label>
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                  checked={isActive}
                  onCheckedChange={(value) => setIsActive(Boolean(value))}
                />
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
              onClick={closeDialog}
              disabled={addingUser}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90 cursor-pointer"
              onClick={() => void handleAddUserSubmit()}
              disabled={addingUser}
            >
              {addingUser ? "Saving..." : "Add User"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}