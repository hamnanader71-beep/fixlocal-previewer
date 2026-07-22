import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, Send, Store, HardHat, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { relativeTime, type LeadRow } from "../data/types";

type Activity = { id: string; action: string; detail: string | null; created_at: string };

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (id) void load(id); }, [id]);
  async function load(leadId: string) {
    setLoading(true);
    const [leadRes, actRes] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
      supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (leadRes.error) { toast.error(leadRes.error.message); return; }
    setLead(leadRes.data as LeadRow | null);
    setActivities((actRes.data ?? []) as Activity[]);
  }

  async function updateStatus(status: LeadRow["status"], label: string) {
    if (!lead) return;
    setBusy(true);
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (!error && user) {
      await supabase.from("lead_activities").insert({ lead_id: lead.id, actor: user.id, action: label, detail: null });
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(label);
    void load(lead.id);
  }

  async function updateRouting(routing: LeadRow["routing"], label: string) {
    if (!lead) return;
    setBusy(true);
    const { error } = await supabase.from("leads").update({ routing }).eq("id", lead.id);
    if (!error && user) {
      await supabase.from("lead_activities").insert({ lead_id: lead.id, actor: user.id, action: label, detail: null });
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(label);
    void load(lead.id);
  }

  async function requalify() {
    if (!lead) return;
    setBusy(true);
    try {
      const { data: ai, error } = await supabase.functions.invoke("ai-qualify-lead", {
        body: {
          service: lead.service, description: lead.description, city: lead.city,
          state: lead.state, country: lead.country, category: lead.category, source: lead.source,
        },
      });
      if (error) throw error;
      const payload = ai ?? {};
      await supabase.from("leads").update({
        ai_score: payload.score, ai_confidence: payload.confidence, ai_reasoning: payload.reasoning,
        priority: payload.priority, urgency: payload.urgency,
        estimated_value_low: payload.estimated_value_low, estimated_value_high: payload.estimated_value_high,
        recommended_sale_price: payload.recommended_sale_price, suggested_reply: payload.suggested_reply,
        is_spam: payload.is_spam ?? false, category: payload.category ?? lead.category,
      }).eq("id", lead.id);
      if (user) {
        await supabase.from("lead_activities").insert({ lead_id: lead.id, actor: user.id, action: "AI re-qualified", detail: `Score ${payload.score}` });
      }
      toast.success("AI re-qualification complete");
      void load(lead.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading lead…</div>;
  if (!lead) return <div className="p-6">Lead not found.</div>;

  return (
    <div className="p-6 max-w-6xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-xs font-mono text-muted-foreground">{lead.lead_code}</div>
          <h1 className="text-2xl font-semibold mt-1">{lead.service}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {lead.customer_name} · {[lead.city, lead.state, lead.country].filter(Boolean).join(", ")} · via {lead.source ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("rejected", "Rejected lead")}><XCircle className="h-4 w-4 mr-1.5" /> Reject</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => updateRouting("subcontractor", "Assigned to subcontractor")}><HardHat className="h-4 w-4 mr-1.5" /> Assign</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => updateRouting("marketplace", "Published to marketplace")}><Store className="h-4 w-4 mr-1.5" /> Sell</Button>
          <Button size="sm" disabled={busy} onClick={() => updateStatus("qualified", "Approved lead")}><CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Original request</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{lead.description || <span className="text-muted-foreground">No description</span>}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.category && <Badge variant="outline">{lead.category}</Badge>}
                {lead.urgency && <Badge variant="outline">Urgency: {lead.urgency}</Badge>}
                <Badge variant="outline">{relativeTime(lead.created_at)}</Badge>
                <Badge variant="secondary" className="capitalize">{lead.status}</Badge>
                <Badge variant="secondary" className="capitalize">Routing: {lead.routing.replace("_", " ")}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI suggested reply</CardTitle>
              <Button size="sm" variant="ghost" onClick={requalify} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Re-qualify
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {lead.suggested_reply || <span className="text-muted-foreground">No AI reply yet. Click Re-qualify to generate.</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={!lead.suggested_reply}><Send className="h-4 w-4 mr-1.5" /> Send email</Button>
                <Button size="sm" variant="outline" disabled={!lead.suggested_reply}>Send WhatsApp</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Activity</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                <ol className="space-y-3 text-sm">
                  {activities.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                      <div className="flex-1">
                        <div>{a.action}{a.detail ? ` — ${a.detail}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{relativeTime(a.created_at)}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">AI intelligence</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row k="Lead score" v={<span className="font-semibold">{lead.ai_score ?? "—"}/100</span>} />
              <Row k="Confidence" v={`${lead.ai_confidence ?? "—"}${lead.ai_confidence != null ? "%" : ""}`} />
              <Row k="Priority" v={lead.priority ? <Badge variant="secondary" className="capitalize">{lead.priority}</Badge> : "—"} />
              <Row k="Spam check" v={<span className={lead.is_spam ? "text-red-600" : "text-emerald-600"}>{lead.is_spam ? "Flagged" : "Passed"}</span>} />
              {lead.ai_reasoning && <div className="pt-2 text-xs text-muted-foreground border-t">{lead.ai_reasoning}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Job value estimate</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="Low" v={lead.estimated_value_low ? `$${Number(lead.estimated_value_low).toLocaleString()}` : "—"} />
              <Row k="High" v={lead.estimated_value_high ? `$${Number(lead.estimated_value_high).toLocaleString()}` : "—"} />
              <Row k="Recommended sale price" v={lead.recommended_sale_price ? <span className="font-semibold">${Number(lead.recommended_sale_price).toLocaleString()}</span> : "—"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="Email" v={lead.customer_email ?? "—"} />
              <Row k="Phone" v={lead.customer_phone ?? "—"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
