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

type AddUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addUserError: string | null;
  newUserFirstName: string;
  onFirstNameChange: (value: string) => void;
  newUserLastName: string;
  onLastNameChange: (value: string) => void;
  newUserEmail: string;
  onEmailChange: (value: string) => void;
  newUserIsActive: boolean;
  onIsActiveChange: (value: boolean) => void;
  addingUser: boolean;
  handleAddUserDialogChange: (open: boolean) => void;
  handleAddUserSubmit: () => Promise<void>;
};

export default function AddUserDialog({
  open,
  onOpenChange,
  addUserError,
  newUserFirstName,
  onFirstNameChange,
  newUserLastName,
  onLastNameChange,
  newUserEmail,
  onEmailChange,
  newUserIsActive,
  onIsActiveChange,
  addingUser,
  handleAddUserDialogChange,
  handleAddUserSubmit,
}: AddUserDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          handleAddUserDialogChange(false);
        }
      }}
    >
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
                  onChange={(event) => onFirstNameChange(event.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Last name
                </Label>
                <Input
                  value={newUserLastName}
                  onChange={(event) => onLastNameChange(event.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Email
                </Label>
                <Input
                  value={newUserEmail}
                  onChange={(event) => onEmailChange(event.target.value)}
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
                  onCheckedChange={(value) => onIsActiveChange(Boolean(value))}
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
              onClick={() => void handleAddUserSubmit()}
              disabled={addingUser}
            >
              {addingUser ? "Saving..." : "Add User"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}