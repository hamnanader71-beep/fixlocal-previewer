import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, MessageSquare, Send, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";

type Provider = "twilio" | "telegram" | "resend";

interface IntegRow { provider: string; config: Record<string, string>; enabled: boolean; }

const providers: {
  id: Provider; name: string; icon: any; description: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
}[] = [
  { id: "twilio", name: "Twilio (SMS & Calls)", icon: MessageSquare,
    description: "Send SMS and receive calls using your own Twilio account.",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxx" },
      { key: "auth_token", label: "Auth Token", type: "password" },
      { key: "from_number", label: "From number (E.164)", placeholder: "+15551234567" },
    ]},
  { id: "telegram", name: "Telegram Bot", icon: Send,
    description: "Send Telegram messages from your bot. Create one via @BotFather.",
    fields: [
      { key: "bot_token", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF..." },
    ]},
  { id: "resend", name: "Resend (Email)", icon: Mail,
    description: "Send transactional emails using your own Resend account.",
    fields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "re_..." },
      { key: "from_email", label: "From email", placeholder: "hello@yourdomain.com" },
    ]},
];

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Record<string, IntegRow>>({});
  const [saving, setSaving] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<Provider | null>(null);
  const [testTo, setTestTo] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("integrations").select("provider, config, enabled");
    const map: Record<string, IntegRow> = {};
    (data ?? []).forEach((r: any) => { map[r.provider] = { provider: r.provider, config: r.config || {}, enabled: r.enabled }; });
    setState(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function setField(p: Provider, key: string, val: string) {
    setState((prev) => ({ ...prev, [p]: {
      provider: p,
      config: { ...(prev[p]?.config ?? {}), [key]: val },
      enabled: prev[p]?.enabled ?? true,
    }}));
  }
  function setEnabled(p: Provider, v: boolean) {
    setState((prev) => ({ ...prev, [p]: { provider: p, config: prev[p]?.config ?? {}, enabled: v }}));
  }

  async function save(p: Provider) {
    if (!user) return;
    setSaving(p);
    const row = state[p] ?? { provider: p, config: {}, enabled: true };
    const { error } = await supabase.from("integrations").upsert({
      user_id: user.id, provider: p, config: row.config, enabled: row.enabled,
    }, { onConflict: "user_id,provider" });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`${p} saved`);
    load();
  }

  async function test(p: Provider) {
    const to = testTo[p];
    if (!to) return toast.error("Enter a test destination");
    setTesting(p);
    try {
      const channel = p === "twilio" ? "sms" : p === "telegram" ? "telegram" : "email";
      const { data, error } = await supabase.functions.invoke("send-communication", {
        body: { channel, to, subject: "GetFixLocal test", body: "Test message from GetFixLocal integrations." },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Send failed");
      toast.success("Test sent!");
    } catch (e) { toast.error((e as Error).message); }
    finally { setTesting(null); }
  }

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Integrations" description="Connect your Twilio, Telegram, and Resend accounts to send real messages. Keys are stored securely per user." />

      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : (
        <div className="grid gap-4">
          {providers.map((prov) => {
            const row = state[prov.id];
            const configured = row && Object.values(row.config).some(Boolean);
            const Icon = prov.icon;
            return (
              <Card key={prov.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">{prov.name}
                          {configured && <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" /> Configured</Badge>}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground mt-1">{prov.description}</div>
                      </div>
                    </div>
                    <Switch checked={row?.enabled ?? true} onCheckedChange={(v) => setEnabled(prov.id, v)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    {prov.fields.map((f) => (
                      <div key={f.key}>
                        <Label className="text-xs">{f.label}</Label>
                        <Input
                          type={f.type ?? "text"}
                          placeholder={f.placeholder}
                          value={row?.config?.[f.key] ?? ""}
                          onChange={(e) => setField(prov.id, f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button onClick={() => save(prov.id)} disabled={saving === prov.id}>
                      {saving === prov.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <KeyRound className="h-4 w-4 mr-1.5" />}
                      Save
                    </Button>
                    {configured && (
                      <>
                        <Input placeholder={prov.id === "resend" ? "to@email.com" : prov.id === "telegram" ? "chat id" : "+15551234567"}
                          value={testTo[prov.id] ?? ""} onChange={(e) => setTestTo({...testTo, [prov.id]: e.target.value})}
                          className="max-w-[220px]" />
                        <Button variant="outline" onClick={() => test(prov.id)} disabled={testing === prov.id}>
                          {testing === prov.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                          Send test
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
