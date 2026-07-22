import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Sparkles, Loader2, Plus, Mail, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";

interface Campaign {
  id: string; name: string; channel: string; status: string; subject: string | null; body: string | null;
  sent_count: number; open_count: number; reply_count: number; created_at: string;
}

const channelIcon: Record<string, any> = { email: Mail, sms: MessageSquare, whatsapp: MessageSquare, telegram: Send };

export default function CampaignsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [c, setC] = useState({
    name: "", channel: "email", subject: "", body: "",
    goal: "", audience: "", offer: "", tone: "friendly professional",
  });
  const up = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((p) => ({ ...p, [k]: v }));

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Campaign[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function draft() {
    if (!c.goal.trim()) return toast.error("Describe the campaign goal");
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-draft-campaign", {
        body: { goal: c.goal, audience: c.audience, channel: c.channel, tone: c.tone, offer: c.offer },
      });
      if (error) throw error;
      up("subject", data?.subject ?? "");
      up("body", data?.body ?? "");
      if (!c.name) up("name", (c.goal.slice(0, 50)) || "Untitled campaign");
      toast.success("AI drafted your copy");
    } catch (e) { toast.error((e as Error).message); }
    finally { setDrafting(false); }
  }

  async function save() {
    if (!c.name.trim() || !c.body.trim()) return toast.error("Name and body required");
    setSaving(true);
    const { error } = await supabase.from("campaigns").insert({
      name: c.name, channel: c.channel, subject: c.subject || null, body: c.body,
      status: "draft", ai_generated: !!c.goal, created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Campaign saved");
    setOpen(false);
    setC({ name: "", channel: "email", subject: "", body: "", goal: "", audience: "", offer: "", tone: "friendly professional" });
    load();
  }

  async function setStatus(id: string, status: string) {
    const patch: any = { status };
    if (status === "running") patch.sent_count = (rows.find(r=>r.id===id)?.sent_count ?? 0);
    const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Campaign ${status}`);
    load();
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader
        title="Marketing Campaigns"
        description="AI-drafted outreach across email, SMS, WhatsApp & Telegram with reply and open tracking."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New campaign</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create campaign</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={c.name} onChange={(e) => up("name", e.target.value)} /></div>
                  <div><Label>Channel</Label>
                    <Select value={c.channel} onValueChange={(v) => up("channel", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="text-xs font-semibold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AI copy drafter</div>
                  <Input placeholder="Goal — e.g. re-engage cold leads with a 10% offer" value={c.goal} onChange={(e) => up("goal", e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Audience — e.g. residential customers" value={c.audience} onChange={(e) => up("audience", e.target.value)} />
                    <Input placeholder="Offer / value" value={c.offer} onChange={(e) => up("offer", e.target.value)} />
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={draft} disabled={drafting}>
                    {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                    Draft with AI
                  </Button>
                </div>
                {c.channel === "email" && (
                  <div><Label>Subject</Label><Input value={c.subject} onChange={(e) => up("subject", e.target.value)} /></div>
                )}
                <div><Label>Body</Label>
                  <Textarea rows={8} value={c.body} onChange={(e) => up("body", e.target.value)} placeholder="Write or generate with AI…" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Save draft</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-base font-semibold">No campaigns yet</div>
          <div className="text-sm text-muted-foreground mt-1">Click "New campaign" to draft your first with AI.</div>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const Icon = channelIcon[r.channel] ?? Mail;
            return (
              <Card key={r.id}><CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{r.name}</span>
                  </div>
                  <Badge variant={r.status === "running" ? "default" : "secondary"} className="text-[10px] capitalize">{r.status}</Badge>
                </div>
                {r.subject && <div className="text-xs text-muted-foreground mb-1">{r.subject}</div>}
                <p className="text-xs text-muted-foreground line-clamp-3">{r.body}</p>
                <div className="flex gap-4 mt-3 text-xs">
                  <span>📤 {r.sent_count}</span>
                  <span>👁 {r.open_count}</span>
                  <span>💬 {r.reply_count}</span>
                </div>
                <div className="flex gap-1.5 mt-3">
                  {r.status === "draft" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "running")}>Start</Button>}
                  {r.status === "running" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "paused")}>Pause</Button>}
                  {r.status === "paused" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "running")}>Resume</Button>}
                  {r.status !== "completed" && <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "completed")}>Complete</Button>}
                </div>
              </CardContent></Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
