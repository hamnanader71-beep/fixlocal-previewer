import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";

type Stage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
interface Deal {
  id: string; name: string; stage: Stage; value: number; currency: string;
  probability: number; expected_close_date: string | null;
  contact_id: string | null; company_id: string | null;
}

const stages: { key: Stage; label: string; color: string }[] = [
  { key: "new", label: "New", color: "bg-slate-500" },
  { key: "qualified", label: "Qualified", color: "bg-blue-500" },
  { key: "proposal", label: "Proposal", color: "bg-indigo-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-purple-500" },
  { key: "won", label: "Won", color: "bg-emerald-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
];

export default function DealsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", value: "", stage: "new" as Stage, contact_id: "", company_id: "", expected_close_date: "" });

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [d, co, ct] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id,name").order("name"),
      supabase.from("contacts").select("id,full_name").order("full_name"),
    ]);
    setLoading(false);
    if (d.error) { toast.error(d.error.message); return; }
    setDeals((d.data ?? []) as Deal[]);
    setCompanies((co.data ?? []) as { id: string; name: string }[]);
    setContacts((ct.data ?? []) as { id: string; full_name: string }[]);
  }

  async function create() {
    if (!form.name.trim()) { toast.error("Deal name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("deals").insert({
      name: form.name.trim(),
      value: Number(form.value) || 0,
      stage: form.stage,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      expected_close_date: form.expected_close_date || null,
      created_by: user?.id ?? null,
      owner_id: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deal created");
    setForm({ name: "", value: "", stage: "new", contact_id: "", company_id: "", expected_close_date: "" });
    setOpen(false);
    void load();
  }

  async function moveStage(dealId: string, stage: Stage) {
    const prev = deals;
    setDeals((ds) => ds.map((d) => d.id === dealId ? { ...d, stage } : d));
    const { error } = await supabase.from("deals").update({ stage }).eq("id", dealId);
    if (error) { setDeals(prev); toast.error(error.message); }
  }

  const grouped = useMemo(() => {
    const m = new Map<Stage, Deal[]>();
    stages.forEach((s) => m.set(s.key, []));
    deals.forEach((d) => m.get(d.stage)?.push(d));
    return m;
  }, [deals]);

  const totals = useMemo(() => {
    const m = new Map<Stage, number>();
    stages.forEach((s) => m.set(s.key, 0));
    deals.forEach((d) => m.set(d.stage, (m.get(d.stage) ?? 0) + Number(d.value)));
    return m;
  }, [deals]);

  return (
    <div className="p-6">
      <PageHeader title="Deals" description="Sales pipeline — drag stages to move deals through your funnel." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New deal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New deal</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5"><Label>Deal name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Value ($)</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Stage</Label>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>
                    {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Company</Label>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                    <option value="">—</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid gap-1.5"><Label>Contact</Label>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
                    <option value="">—</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5"><Label>Expected close date</Label><Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {stages.map((s) => (
            <div
              key={s.key}
              className="flex flex-col min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("deal"); if (id) void moveStage(id, s.key); }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  <span className="text-sm font-medium">{s.label}</span>
                  <Badge variant="secondary" className="h-5 text-[10px]">{grouped.get(s.key)?.length ?? 0}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">${Math.round(totals.get(s.key) ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex-1 space-y-2 bg-muted/30 rounded-lg p-2">
                {grouped.get(s.key)?.map((d) => (
                  <Card
                    key={d.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("deal", d.id)}
                    onClick={() => navigate(`/deals/${d.id}`)}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-3">
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">${Number(d.value).toLocaleString()}</div>
                      {d.expected_close_date && <div className="text-[10px] text-muted-foreground mt-1">Close {d.expected_close_date}</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
