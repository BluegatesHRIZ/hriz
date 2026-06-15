"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useChangePassword } from "@/lib/hooks/useEmployeeDetail";
import { useToast } from "@/lib/hooks/use-toast";

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}

function PasswordField({ label, value, onChange, show, onToggle }: FieldProps) {
  return (
    <div className="grid grid-cols-12 items-center gap-3">
      <Label className="col-span-4 text-right text-sm">{label}</Label>
      <div className="col-span-8 relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={5}
          required
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const changePassword = useChangePassword(user?.name ?? "");

  const [oldPswd, setOldPswd] = useState("");
  const [newPswd, setNewPswd] = useState("");
  const [confirmPswd, setConfirmPswd] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!oldPswd) {
      setError("Old password is required.");
      return;
    }
    if (newPswd.length < 5) {
      setError("New password must be at least 5 characters.");
      return;
    }
    if (!confirmPswd) {
      setError("Please confirm your new password.");
      return;
    }
    if (newPswd !== confirmPswd) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        oldPassword: oldPswd,
        newPassword: newPswd,
        confirmPassword: confirmPswd,
      });
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setOldPswd("");
      setNewPswd("");
      setConfirmPswd("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Old Password"
            value={oldPswd}
            onChange={setOldPswd}
            show={showOld}
            onToggle={() => setShowOld((v) => !v)}
          />
          <PasswordField
            label="New Password"
            value={newPswd}
            onChange={setNewPswd}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
          />
          <PasswordField
            label="Confirm Password"
            value={confirmPswd}
            onChange={setConfirmPswd}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOldPswd(""); setNewPswd(""); setConfirmPswd(""); setError(null); }}
            >
              Clear
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
