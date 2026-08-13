import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordField } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeamMember } from "@/lib/auth.functions";
import { failedPasswordRules, signUpSchema } from "@/lib/password";

export function CreateTeamMemberCard() {
  const create = useServerFn(createTeamMember);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);

    const missing = failedPasswordRules(password);
    if (missing.length > 0) {
      setErrors(missing.map((rule) => `Password is missing: ${rule.toLowerCase()}`));
      return;
    }
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    setBusy(true);
    try {
      await create({ data: { email: parsed.data.email, password: parsed.data.password, role } });
      toast.success(`${role === "admin" ? "Admin" : "Staff"} account created for ${email}`);
      setEmail("");
      setPassword("");
      setOpen(false);
    } catch (error) {
      setErrors([(error as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-border bg-background p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Team accounts</h2>
          <p className="mt-1 text-xs text-slate">
            Create a BLEXware staff or admin account. Passwords are screened against known breach
            data before the account is created.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Create team member"}
        </Button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-6 max-w-md space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="member-email">Work email</Label>
            <Input
              id="member-email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <PasswordField
            id="member-password"
            label="Temporary password"
            value={password}
            onChange={setPassword}
            disabled={busy}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Role</legend>
            <div className="flex gap-4 text-sm text-slate">
              {(["staff", "admin"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="member-role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  {value === "staff" ? "Staff" : "Admin"}
                </label>
              ))}
            </div>
          </fieldset>

          {errors.length > 0 ? (
            <ul
              className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
              role="alert"
            >
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}

          <Button type="submit" disabled={busy} className="shadow-cta">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
