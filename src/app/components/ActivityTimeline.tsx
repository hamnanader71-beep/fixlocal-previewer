import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Phone, MessageCircle, Send, StickyNote, Calendar, CheckSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { relativeTime } from "../data/types";

type ActivityType = "note" | "email" | "call" | "whatsapp" | "telegram" | "meeting" | "task";
type Direction = "inbound" | "outbound" | "internal";

export interface Activity {
  id: string;
  type: ActivityType;
  direction: Direction;
  status: string;
  subject: string | null;
  body: string | null;
  duration_seconds: number | null;
  from_address: string | null;
  to_address: string | null;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
}

export type LinkTarget = {
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  lead_id?: string;
};

const typeMeta: Record<ActivityType, { icon: typeof Mail; label: string; color: string }> = {
  note: { icon: StickyNote, label: "Note", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  email: { icon: Mail, label: "Email", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  call: { icon: Phone, label: "Call", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  telegram: { icon: Send, label: "Telegram", color: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  meeting: { icon: Calendar, label: "Meeting", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  task: { icon: CheckSquare, label: "Task", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
};

export function ActivityTimeline({ target, defaultToAddress }: { target: LinkTarget; defaultToAddress?: { email?: string; phone?: string } }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(target)]);

  async function load() {
    setLoading(true);
    let q = supabase.from("activities").select("*").order("created_at", { ascending: false });
    if (target.contact_id) q = q.eq("contact_id", target.contact_id);
    else if (target.company_id) q = q.eq("company_id", target.company_id);
    else if (target.deal_id) q = q.eq("deal_id", target.deal_id);
    else if (target.lead_id) q = q.eq("lead_id", target.lead_id);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setActivities((data ?? []) as Activity[]);
  }

  function defaultTo(t: ActivityType) {
    if (t === "email") return defaultToAddress?.email ?? "";
    if (t === "call" || t === "whatsapp" || t === "telegram") return defaultToAddress?.phone ?? "";
    return "";
  }

  async function save() {
    if (!body.trim() && type !== "task" && type !== "meeting") {
      toast.error("Add some content first");
      return;
    }
    setBusy(true);
    const status: "completed" | "pending" | "sent" =
      type === "note" ? "completed" : type === "task" ? "pending" : "sent";
    const direction: Direction = type === "note" || type === "task" || type === "meeting" ? "internal" : "outbound";
    const { error } = await supabase.from("activities").insert({
      type,
      direction,
      status,
      subject: subject || null,
      body: body || null,
      to_address: to || null,
      created_by: user?.id ?? null,
      owner_id: user?.id ?? null,
      contact_id: target.contact_id ?? null,
      company_id: target.company_id ?? null,
      deal_id: target.deal_id ?? null,
      lead_id: target.lead_id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${typeMeta[type].label} logged`);
    setSubject(""); setBody(""); setTo("");
    void load();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Communications & Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={type} onValueChange={(v) => { setType(v as ActivityType); setTo(defaultTo(v as ActivityType)); }}>
          <TabsList className="grid grid-cols-7 w-full">
            {(Object.keys(typeMeta) as ActivityType[]).map((t) => {
              const M = typeMeta[t];
              return (
                <TabsTrigger key={t} value={t} className="text-xs">
                  <M.icon className="h-3.5 w-3.5" />
                </TabsTrigger>
              );
            })}
          </TabsList>
          {(Object.keys(typeMeta) as ActivityType[]).map((t) => (
            <TabsContent key={t} value={t} className="space-y-2 mt-3">
              {(t === "email" || t === "whatsapp" || t === "telegram" || t === "call") && (
                <Input placeholder={t === "email" ? "To: email@example.com" : "To: phone number"} value={to} onChange={(e) => setTo(e.target.value)} />
              )}
              {t === "email" && (
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              )}
              {(t === "task" || t === "meeting") && (
                <Input placeholder={t === "task" ? "Task title" : "Meeting title"} value={subject} onChange={(e) => setSubject(e.target.value)} />
              )}
              <Textarea
                placeholder={
                  t === "note" ? "Write an internal note…"
                  : t === "call" ? "Call notes / summary…"
                  : t === "task" ? "Task details…"
                  : t === "meeting" ? "Meeting agenda / notes…"
                  : "Message body…"
                }
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t === "email" || t === "whatsapp" || t === "telegram" || t === "call"
                    ? "Logs the communication. Provider send-out is wired in the next phase."
                    : "Saved to timeline."}
                </p>
                <Button size="sm" onClick={save} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Log {typeMeta[t].label}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="pt-4 border-t">
          {loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
          ) : activities.length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity yet. Log your first note or communication above.</div>
          ) : (
            <ol className="space-y-4">
              {activities.map((a) => {
                const M = typeMeta[a.type as ActivityType] ?? typeMeta.note;
                const Icon = M.icon;
                return (
                  <li key={a.id} className="flex gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${M.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{M.label}</span>
                        {a.direction !== "internal" && <Badge variant="outline" className="text-[10px] h-4">{a.direction}</Badge>}
                        <Badge variant="secondary" className="text-[10px] h-4 capitalize">{a.status}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">{relativeTime(a.created_at)}</span>
                      </div>
                      {a.subject && <div className="text-sm mt-0.5 font-medium">{a.subject}</div>}
                      {a.to_address && <div className="text-xs text-muted-foreground">To: {a.to_address}</div>}
                      {a.body && <div className="text-sm mt-1 whitespace-pre-wrap text-foreground/80">{a.body}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
