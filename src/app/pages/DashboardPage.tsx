import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Target, DollarSign, CheckCircle2, Users, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime, type LeadRow } from "../data/types";

export default function DashboardPage() {
  const [rows, setRows] = useState<LeadRow[]>([]);

  useEffect(() => {
    supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows((data ?? []) as LeadRow[]));
  }, []);

  const total = rows.length;
  const last24 = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000).length;
  const qualified = rows.filter((r) => r.status === "qualified" || r.status === "sold" || r.status === "assigned").length;
  const qualifiedRate = total ? Math.round((qualified / total) * 1000) / 10 : 0;
  const pipeline = rows.reduce((acc, r) => acc + Number(r.estimated_value_high ?? 0), 0);
  const hot = [...rows].filter((r) => r.priority === "hot" || r.priority === "good").slice(0, 5);

  const kpis = [
    { label: "New leads (24h)", value: String(last24), icon: Target },
    { label: "Qualified rate", value: `${qualifiedRate}%`, icon: CheckCircle2 },
    { label: "Pipeline value", value: `$${Math.round(pipeline).toLocaleString()}`, icon: DollarSign },
    { label: "Total leads", value: String(total), icon: Users },
  ];

  return (
    <div className="p-6 max-w-[1600px]">
      <PageHeader
        title="Executive dashboard"
        description="Real-time view of lead flow, AI quality, and pipeline value."
        actions={
          <Button size="sm" asChild><Link to="/leads/new"><Plus className="h-4 w-4 mr-1.5" /> Add lead</Link></Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className="text-2xl font-semibold mt-1">{k.value}</div>
                </div>
                <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <k.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Live from your workspace
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Hottest leads</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/leads">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {hot.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No leads yet. <Link to="/leads/new" className="text-primary hover:underline">Add your first lead →</Link>
              </div>
            ) : (
              <div className="divide-y">
                {hot.map((l) => (
                  <Link to={`/leads/${l.id}`} key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {l.customer_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.service}</div>
                      <div className="text-xs text-muted-foreground">{l.customer_name} · {l.city ?? "—"} · {relativeTime(l.created_at)}</div>
                    </div>
                    {l.priority && <Badge variant={l.priority === "hot" ? "destructive" : "secondary"} className="text-[10px]">
                      {l.priority.toUpperCase()} · {l.ai_score ?? "—"}
                    </Badge>}
                    <div className="text-sm font-medium tabular-nums w-28 text-right">
                      {l.estimated_value_low != null ? `$${Number(l.estimated_value_low).toLocaleString()}–$${Number(l.estimated_value_high ?? 0).toLocaleString()}` : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Get started</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="font-medium">1. Add a lead</div>
              <div className="text-xs text-muted-foreground">AI will score, prioritise, and price it instantly.</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="font-medium">2. Review & route</div>
              <div className="text-xs text-muted-foreground">Keep, assign, or publish to marketplace.</div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30">
              <div className="font-medium">3. Track pipeline</div>
              <div className="text-xs text-muted-foreground">Watch KPIs update live as your team works.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
