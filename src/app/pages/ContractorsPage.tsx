import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, HardHat } from "lucide-react";

export default function ContractorsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("partners").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);
  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader title="Contractors" description="Vetted contractors receiving assigned leads." />
      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      : rows.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <HardHat className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-lg font-semibold">No contractors yet</div>
          <p className="text-sm text-muted-foreground mt-1">Add partners from the Partner Hunter or Growth section.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(p => (
            <Card key={p.id}><CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold">{p.name ?? p.company_name}</div>
                {p.status && <Badge variant="secondary" className="text-[10px] capitalize">{p.status}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">{p.category ?? "—"} · {p.city ?? ""} {p.state ?? ""}</div>
              {p.email && <div className="text-xs mt-2">{p.email}</div>}
              {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
