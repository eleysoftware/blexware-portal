import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/PageHero";
import { PasswordField } from "@/components/PasswordField";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getViewerRole, signUpUser } from "@/lib/auth.functions";
import { failedPasswordRules, signUpSchema } from "@/lib/password";

const title = "Sign in — BLEXware";
const description =
  "Sign in to the BLEXware portal to track your quote requests, review proposals, and manage your project.";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const viewer = useServerFn(getViewerRole);

  const routeAfterSignIn = async () => {
    try {
      const role = await viewer({ data: {} });
      navigate({ to: role.isStaff ? "/admin" : "/portal" });
    } catch {
      navigate({ to: "/portal" });
    }
  };

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void routeAfterSignIn();
    });
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) void routeAfterSignIn();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHero
        eyebrow="BLEXware portal"
        title="Sign in"
        description="Track your quote requests and review proposals in one place."
      />
      <Section tone="surface">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8 shadow-card">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <SignInForm onSignedIn={routeAfterSignIn} />
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-xs leading-relaxed text-slate">
            BLEXware team accounts are created by an administrator. Client accounts see only the
            quotes and proposals tied to their own email address.
          </p>
        </div>
      </Section>
    </>
  );
}

function SignInForm({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void onSignedIn();
  };

  return (
    <form onSubmit={signIn} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full shadow-cta" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const createAccount = useServerFn(signUpUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);

    const missing = failedPasswordRules(password);
    if (missing.length > 0) {
      setErrors(missing.map((rule) => `Password is missing: ${rule.toLowerCase()}`));
      return;
    }
    if (password !== confirm) {
      setErrors(["Passwords don't match"]);
      return;
    }
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    setBusy(true);
    try {
      await createAccount({ data: { email: parsed.data.email, password: parsed.data.password } });
      // Supabase sends the confirmation email for the pending account.
      await supabase.auth.resend({ type: "signup", email: parsed.data.email });
      setDone(true);
    } catch (error) {
      setErrors([(error as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="text-sm font-semibold text-foreground">Check your email</h2>
        <p className="text-sm text-slate">
          We sent a confirmation link to <span className="font-medium">{email}</span>. Confirm your
          address, then come back and sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-xs text-slate">
          Use the same address you submitted your quote request with.
        </p>
      </div>

      <PasswordField id="signup-password" value={password} onChange={setPassword} disabled={busy} />

      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <Input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

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

      <Button type="submit" className="w-full shadow-cta" disabled={busy}>
        {busy ? "Checking password safety…" : "Create account"}
      </Button>
      <p className="text-xs text-slate">
        Every password is screened against known breach data before an account is created.
      </p>
    </form>
  );
}
