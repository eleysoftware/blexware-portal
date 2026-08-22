import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { PageHero } from "@/components/PageHero";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getViewerRole } from "@/lib/auth.functions";

const title = "Confirming your email — BLEXware";
const description = "Finish confirming your BLEXware portal account.";

export const Route = createFileRoute("/auth/callback")({
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
  component: AuthCallbackPage,
});

type State = { phase: "working" } | { phase: "error"; message: string };

function readHashParams(): URLSearchParams {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return new URLSearchParams(hash);
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const viewer = useServerFn(getViewerRole);
  const [state, setState] = useState<State>({ phase: "working" });

  useEffect(() => {
    let cancelled = false;

    const routeOnward = async () => {
      try {
        const role = await viewer({ data: {} });
        navigate({ to: role.isStaff ? "/admin" : "/portal" });
      } catch {
        navigate({ to: "/portal" });
      }
    };

    const run = async () => {
      const url = new URL(window.location.href);
      const hashParams = readHashParams();

      const errorDescription =
        url.searchParams.get("error_description") ?? hashParams.get("error_description");
      if (errorDescription) {
        if (!cancelled) setState({ phase: "error", message: errorDescription.replace(/\+/g, " ") });
        return;
      }

      // Modern PKCE / token-hash flow.
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setState({ phase: "error", message: error.message });
          return;
        }
        if (!cancelled) void routeOnward();
        return;
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: (type as "signup" | "recovery" | "invite" | "email_change" | "magiclink") ?? "signup",
          token_hash: tokenHash,
        });
        if (error) {
          if (!cancelled) setState({ phase: "error", message: error.message });
          return;
        }
        if (!cancelled) void routeOnward();
        return;
      }

      // Legacy implicit flow: tokens arrive in the URL fragment.
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (!cancelled) setState({ phase: "error", message: error.message });
          return;
        }
        if (!cancelled) void routeOnward();
        return;
      }

      // Nothing usable in the URL — maybe the session is already live.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) void routeOnward();
        return;
      }

      if (!cancelled) {
        setState({
          phase: "error",
          message: "This confirmation link is invalid or has already been used.",
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHero
        eyebrow="BLEXware portal"
        title="Confirming your email"
        description="Hang tight while we finish setting up your account."
      />
      <Section tone="surface">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8 shadow-card">
          {state.phase === "working" ? (
            <p className="text-sm text-slate">Verifying your confirmation link…</p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  We couldn't confirm your email
                </h2>
                <p className="text-xs text-destructive">{state.message}</p>
              </div>
              <p className="text-sm text-slate">
                Confirmation links expire and can only be used once. Enter your email below and
                we'll send a fresh one.
              </p>
              <ResendForm />
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth" })}>
                Back to sign in
              </Button>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

function ResendForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <p className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
        A new confirmation link is on its way to {email}.
      </p>
    );
  }

  return (
    <form onSubmit={resend} className="space-y-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor="resend-email">Email</Label>
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full shadow-cta" disabled={busy}>
        {busy ? "Sending…" : "Send a new confirmation link"}
      </Button>
    </form>
  );
}
