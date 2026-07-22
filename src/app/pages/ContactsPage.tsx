import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Mail, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";

interface Contact {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  company_id: string | null;
  lifecycle_stage: string;
  created_at: string;
}

interface Company { id: string; name: string }

export default function ContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", title: "", email: "", phone: "", whatsapp: "", telegram: "", company_id: "" });

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const [c, co] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("id,name").order("name"),
    ]);
    setLoading(false);
    if (c.error) { toast.error(c.error.message); return; }
    setRows((c.data ?? []) as Contact[]);
    setCompanies((co.data ?? []) as Company[]);
  }

  async function create() {
    if (!form.full_name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({
      full_name: form.full_name.trim(),
      title: form.title || null,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      telegram: form.telegram || null,
      company_id: form.company_id || null,
      created_by: user?.id ?? null,
      owner_id: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact created");
    setForm({ full_name: "", title: "", email: "", phone: "", whatsapp: "", telegram: "", company_id: "" });
    setOpen(false);
    void load();
  }

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase();
    return !s || r.full_name.toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s) || (r.title ?? "").toLowerCase().includes(s);
  });
  const cMap = new Map(companies.map((c) => [c.id, c.name]));

  const cols: Column<Contact>[] = [
    { key: "name", header: "Name", render: (r) => (
      <div>
        <div className="font-medium">{r.full_name}</div>
        <div className="text-xs text-muted-foreground">{r.title ?? "—"}</div>
      </div>
    ) },
    { key: "company", header: "Company", render: (r) => r.company_id ? (cMap.get(r.company_id) ?? "—") : "—" },
    { key: "channels", header: "Channels", render: (r) => (
      <div className="flex gap-1.5 text-muted-foreground">
        {r.email && <Mail className="h-3.5 w-3.5" />}
        {r.phone && <Phone className="h-3.5 w-3.5" />}
        {r.whatsapp && <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />}
      </div>
    ) },
    { key: "stage", header: "Stage", render: (r) => <Badge variant="secondary" className="capitalize">{r.lifecycle_stage}</Badge> },
    { key: "email", header: "Email", render: (r) => <span className="text-muted-foreground">{r.email ?? "—"}</span> },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Contacts" description="People at the companies you're working with." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New contact</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid gap-1.5">
                  <Label>Company</Label>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                    <option value="">—</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Telegram</Label><Input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <DataTable columns={cols} rows={filtered} onRowClick={(r) => navigate(`/contacts/${r.id}`)} />
      )}
    </div>
  );
}
