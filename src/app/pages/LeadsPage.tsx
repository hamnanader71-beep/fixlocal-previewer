import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Plus, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { relativeTime, type LeadRow } from "../data/types";

const priorityColor: Record<string, string> = {
  hot: "bg-red-500/10 text-red-600 border-red-500/20",
  good: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  low: "bg-muted text-muted-foreground",
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as LeadRow[]);
  }

  const filtered = useMemo(() => rows.filter((l) => {
    if (country !== "all" && l.country !== country) return false;
    if (status !== "all" && l.status !== status) return false;
    if (q && !`${l.customer_name} ${l.service} ${l.city ?? ""} ${l.lead_code ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, country, status]);

  return (
    <div className="p-6 max-w-[1600px]">
      <PageHeader
        title="Leads"
        description="Every discovered lead across all sources, ranked by AI score and buying intent."
        actions={
          <Button size="sm" asChild><Link to="/leads/new"><Plus className="h-4 w-4 mr-1.5" /> Add lead</Link></Button>
        }
      />

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by customer, service, city, code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            <SelectItem value="USA">United States</SelectItem>
            <SelectItem value="Lithuania">Lithuania</SelectItem>
            <SelectItem value="UAE">UAE</SelectItem>
            <SelectItem value="India">India</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="review">Needs review</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9"><Filter className="h-4 w-4 mr-1.5" /> More filters</Button>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} leads</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading leads…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <div className="text-lg font-medium">No leads yet</div>
          <p className="text-sm text-muted-foreground mt-1">Add your first lead and let the AI qualify it instantly.</p>
          <Button className="mt-4" asChild><Link to="/leads/new"><Plus className="h-4 w-4 mr-1.5" /> Add lead</Link></Button>
        </div>
      ) : (
        <DataTable<LeadRow>
          onRowClick={(r) => navigate(`/leads/${r.id}`)}
          columns={[
            { key: "code", header: "Lead ID", render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.lead_code}</span> },
            { key: "customer", header: "Customer", render: (l) => (
              <div>
                <div className="font-medium">{l.customer_name}</div>
                <div className="text-xs text-muted-foreground">{l.service}</div>
              </div>
            )},
            { key: "loc", header: "Location", render: (l) => <div className="text-xs">{l.city ?? "—"}, {l.state ?? ""}<div className="text-muted-foreground">{l.country ?? ""}</div></div> },
            { key: "cat", header: "Category", render: (l) => l.category ? <Badge variant="outline">{l.category}</Badge> : <span className="text-xs text-muted-foreground">—</span> },
            { key: "source", header: "Source", render: (l) => <span className="text-xs">{l.source ?? "—"}</span> },
            { key: "score", header: "AI Score", render: (l) => l.ai_score != null ? (
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${l.ai_score}%` }} />
                </div>
                <span className="font-medium text-xs tabular-nums">{l.ai_score}</span>
              </div>
            ) : <span className="text-xs text-muted-foreground">—</span> },
            { key: "pri", header: "Priority", render: (l) => l.priority ? <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${priorityColor[l.priority]}`}>{l.priority}</span> : <span className="text-xs text-muted-foreground">—</span> },
            { key: "val", header: "Est. value", render: (l) => l.estimated_value_low != null ? <span className="text-xs tabular-nums font-medium">${Number(l.estimated_value_low).toLocaleString()}–${Number(l.estimated_value_high ?? 0).toLocaleString()}</span> : <span className="text-xs text-muted-foreground">—</span> },
            { key: "status", header: "Status", render: (l) => <Badge variant="secondary" className="capitalize">{l.status}</Badge> },
            { key: "age", header: "Age", render: (l) => <span className="text-xs text-muted-foreground">{relativeTime(l.created_at)}</span> },
          ]}
          rows={filtered}
        />
      )}
    </div>
  );
}
