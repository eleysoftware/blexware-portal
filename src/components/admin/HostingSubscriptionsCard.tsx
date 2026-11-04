import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatMoney } from "@/lib/documents/types";
import {
  adminSubscriptionActionFn,
  createSubscriptionFn,
  getSubscriptionSettingsFn,
  listSubscriptionsFn,
  saveSubscriptionSettingsFn,
} from "@/lib/subscriptions.functions";

type Settings = {
  enabled: boolean;
  autoRenewEnabled: boolean;
  amountCents: number;
  noticeDays: number;
  serviceName: string;
};

function NewSubscriptionDialog({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (v: boolean) => void; settings: Settings }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createSubscriptionFn);
  const [form, setForm] = useState({ contactName: "", contactEmail: "", company: "", phone: "", smsOptIn: false, startDate: "", sendNow: true });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const mutation = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: (result) => {
      toast.success(
        result.sent
          ? `Subscription created and ${result.invoiceNumber} emailed.`
          : result.deliveryError
            ? `Subscription created, but the email failed: ${result.deliveryError}`
            : `Subscription created with draft ${result.invoiceNumber}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {settings.serviceName} subscription</DialogTitle>
          <DialogDescription>
            {formatMoney(settings.amountCents)} per year. The client gets the first invoice and can choose automatic renewal when paying.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="sub-name">Client name</Label><Input id="sub-name" value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="sub-email">Client email</Label><Input id="sub-email" type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="sub-company">Company (optional)</Label><Input id="sub-company" value={form.company} onChange={(e) => set({ company: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="sub-phone">Mobile number (optional)</Label><Input id="sub-phone" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value, smsOptIn: e.target.value ? form.smsOptIn : false })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.smsOptIn} disabled={!form.phone.trim()} onCheckedChange={(v) => set({ smsOptIn: v === true })} />
            Client agreed to text reminders
          </label>
          <div className="grid gap-1.5"><Label htmlFor="sub-start">Start date</Label><Input id="sub-start" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.sendNow} onCheckedChange={(v) => set({ sendNow: v === true })} />
            Email the first invoice now
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Create subscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admin: yearly subscription settings + active subscriptions list. */
export function HostingSubscriptionsCard() {
  const queryClient = useQueryClient();
  const getSettings = useServerFn(getSubscriptionSettingsFn);
  const saveSettings = useServerFn(saveSubscriptionSettingsFn);
  const list = useServerFn(listSubscriptionsFn);
  const act = useServerFn(adminSubscriptionActionFn);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Settings | null>(null);

  const settings = useQuery({ queryKey: ["subscription-settings"], queryFn: () => getSettings() });
  const subs = useQuery({ queryKey: ["subscriptions"], queryFn: () => list() });

  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data.settings);
  }, [settings.data, draft]);

  const save = useMutation({
    mutationFn: (next: Settings) => saveSettings({ data: next }),
    onSuccess: (result) => {
      setDraft(result);
      void queryClient.invalidateQueries({ queryKey: ["subscription-settings"] });
      toast.success("Subscription settings saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const action = useMutation({
    mutationFn: (input: { id: string; action: "stop_auto_renew" | "cancel" }) => act({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!draft) return null;
  const provider = settings.data?.provider;

  return (
    <section className="rounded-2xl border border-border bg-background p-6 shadow-card" data-testid="hosting-subscriptions-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-headline">
            <RefreshCw className="h-4 w-4 text-primary" aria-hidden /> Yearly subscriptions
          </h2>
          <p className="text-sm text-slate">
            {draft.serviceName} at {formatMoney(draft.amountCents)}/year. Renewal invoices and notices go out {draft.noticeDays} days ahead.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!draft.enabled}>
          <Plus className="h-4 w-4" aria-hidden /> New subscription
        </Button>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          Subscriptions enabled
          <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Offer PayPal auto-renew
          <Switch checked={draft.autoRenewEnabled} onCheckedChange={(v) => setDraft({ ...draft, autoRenewEnabled: v })} />
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor="sub-service">Service name</Label>
          <Input id="sub-service" value={draft.serviceName} onChange={(e) => setDraft({ ...draft, serviceName: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sub-price">Yearly price (USD)</Label>
          <Input id="sub-price" type="number" min={1} step="0.01" value={(draft.amountCents / 100).toString()} onChange={(e) => setDraft({ ...draft, amountCents: Math.round(Number(e.target.value || 0) * 100) })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sub-notice">Notice days before renewal</Label>
          <Input id="sub-notice" type="number" min={1} max={60} value={draft.noticeDays} onChange={(e) => setDraft({ ...draft, noticeDays: Number(e.target.value || 14) })} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => save.mutate(draft)} disabled={save.isPending}>Save settings</Button>
        </div>
      </div>
      {draft.autoRenewEnabled && provider !== "paypal" ? (
        <p className="mt-3 text-sm text-warning">Auto-renew only works while PayPal is the active payment provider. Clients will get manual renewal invoices.</p>
      ) : null}
      <p className="mt-2 text-xs text-slate">Price changes apply to new subscriptions only.</p>

      <div className="mt-5 border-t border-border pt-5">
        {subs.data?.error ? <p className="text-sm text-warning">{subs.data.error}</p> : null}
        {subs.data && !subs.data.subscriptions.length && !subs.data.error ? (
          <p className="text-sm text-slate">No subscriptions yet.</p>
        ) : null}
        <ul className="divide-y divide-border">
          {(subs.data?.subscriptions ?? []).map((sub) => (
            <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-headline">{sub.company ?? sub.clientName} <span className="text-slate">· {sub.clientEmail}</span></p>
                <p className="text-slate">
                  {sub.serviceName} · {formatMoney(sub.amountCents)}/yr · renews {new Date(`${sub.renewalDate}T12:00:00Z`).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{sub.status.replace("_", " ")}</Badge>
                <Badge variant={sub.autoRenew ? "secondary" : "outline"}>{sub.autoRenew ? "Auto-renew" : "Manual"}</Badge>
                {sub.autoRenew ? (
                  <Button size="sm" variant="outline" onClick={() => action.mutate({ id: sub.id, action: "stop_auto_renew" })}>Stop auto-renew</Button>
                ) : null}
                {sub.status !== "cancelled" ? (
                  <Button size="sm" variant="outline" onClick={() => { if (confirm("Cancel this subscription? No more renewal invoices will be sent.")) action.mutate({ id: sub.id, action: "cancel" }); }}>Cancel</Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <NewSubscriptionDialog open={open} onOpenChange={setOpen} settings={draft} />
    </section>
  );
}
