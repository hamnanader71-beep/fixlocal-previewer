import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
}

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", industry: "", size: "", city: "", country: "", website: "", phone: "" });

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Company[]);
  }

  async function create() {
    if (!form.name.trim()) { toast.error("Company name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("companies").insert({
      name: form.name.trim(),
      domain: form.domain || null,
      industry: form.industry || null,
      size: form.size || null,
      city: form.city || null,
      country: form.country || null,
      website: form.website || null,
      phone: form.phone || null,
      created_by: user?.id ?? null,
      owner_id: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Company created");
    setForm({ name: "", domain: "", industry: "", size: "", city: "", country: "", website: "", phone: "" });
    setOpen(false);
    void load();
  }

  const filtered = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.domain ?? "").toLowerCase().includes(q.toLowerCase()));

  const cols: Column<Company>[] = [
    { key: "name", header: "Company", render: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        {r.domain && <div className="text-xs text-muted-foreground">{r.domain}</div>}
      </div>
    ) },
    { key: "industry", header: "Industry", render: (r) => r.industry ?? "—" },
    { key: "size", header: "Size", render: (r) => r.size ?? "—" },
    { key: "location", header: "Location", render: (r) => [r.city, r.country].filter(Boolean).join(", ") || "—" },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Companies" description="Organizations you're selling to." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New company</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New company</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Domain</Label><Input placeholder="acme.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Size</Label>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
                    <option value="">—</option>
                    <option>1-10</option><option>11-50</option><option>51-200</option><option>201-1000</option><option>1000+</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search companies…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <DataTable columns={cols} rows={filtered} onRowClick={(r) => navigate(`/companies/${r.id}`)} />
      )}
    </div>
  );
}
