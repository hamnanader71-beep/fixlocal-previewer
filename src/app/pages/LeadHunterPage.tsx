import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Radar, Sparkles, Loader2, MapPin, Clock, DollarSign, ExternalLink, Save, Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";

interface HuntedLead {
  customer_name: string;
  service: string;
  description?: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  source?: string;
  source_url?: string;
  source_url_hint?: string;
  customer_email?: string;
  customer_phone?: string;
  posted_ago_hours?: number;
  segment?: "residential" | "commercial";
  priority?: "hot" | "good" | "medium" | "low";
  urgency?: "high" | "medium" | "low";
  estimated_value_low?: number;
  estimated_value_high?: number;
  recommended_sale_price?: number;
  ai_score?: number;
  ai_confidence?: number;
  suggested_reply?: string;
  reasoning?: string;
}

const priorityColor: Record<string, string> = {
  hot: "bg-red-500/10 text-red-600 border-red-500/20",
  good: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  low: "bg-muted text-muted-foreground border-transparent",
};

const quickCategories = [
  "Plumbing", "Electrical", "Roofing", "Remodeling", "Cleaning", "Landscaping",
  "Junk Removal", "Moving", "HVAC", "Painting", "Handyman", "Property Preservation",
  "Commercial Maintenance", "Pest Control", "Flooring",
];

const platforms = ["Any", "Craigslist", "Facebook", "Nextdoor", "Reddit", "Thumbtack", "Angi", "HomeAdvisor", "Yelp", "Google", "Referral"];

export default function LeadHunterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hunting, setHunting] = useState(false);
  const [results, setResults] = useState<HuntedLead[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [countries, setCountries] = useState<{ name: string; code: string }[]>([]);

  useEffect(() => {
    supabase.from("countries").select("name,code").order("name").then(({ data }) => {
      setCountries((data ?? []) as { name: string; code: string }[]);
    });
  }, []);

  const [f, setF] = useState({
    keyword: "",
    category: "",
    city: "",
    state: "",
    country: "USA",
    radius_km: "",
    platform: "Any",
    budget_min: "",
    budget_max: "",
    posted_within_days: "7",
    segment: "any" as "any" | "residential" | "commercial",
    priority: "any" as "any" | "urgent" | "normal",
    limit: "8",
  });

  function up<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function hunt(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.keyword.trim()) { toast.error("Enter a keyword to hunt for."); return; }
    setHunting(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-hunt-leads", {
        body: {
          keyword: f.keyword.trim(),
          category: f.category || undefined,
          city: f.city || undefined,
          state: f.state || undefined,
          country: f.country || undefined,
          radius_km: f.radius_km ? Number(f.radius_km) : undefined,
          platform: f.platform !== "Any" ? f.platform : undefined,
          budget_min: f.budget_min ? Number(f.budget_min) : undefined,
          budget_max: f.budget_max ? Number(f.budget_max) : undefined,
          posted_within_days: f.posted_within_days ? Number(f.posted_within_days) : undefined,
          segment: f.segment,
          priority: f.priority === "urgent" ? "urgent" : f.priority === "normal" ? "normal" : "any",
          limit: Number(f.limit),
        },
      });
      if (error) throw error;
      const leads = (data?.leads ?? []) as HuntedLead[];
      setResults(leads);
      toast.success(`Found ${leads.length} potential leads for "${f.keyword}"`);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message ?? "Lead hunt failed");
    } finally {
      setHunting(false);
    }
  }

  async function saveLead(idx: number) {
    const l = results[idx];
    setSavingIdx(idx);
    const { data, error } = await supabase.from("leads").insert({
      customer_name: l.customer_name,
      service: l.service,
      description: l.description ?? null,
      category: l.category ?? null,
      city: l.city ?? null,
      state: l.state ?? null,
      country: l.country ?? f.country,
      source: l.source ?? "AI Lead Hunter",
      created_by: user?.id ?? null,
      ai_score: l.ai_score ?? null,
      ai_confidence: l.ai_confidence ?? null,
      ai_reasoning: l.reasoning ?? null,
      priority: l.priority ?? null,
      urgency: l.urgency ?? null,
      estimated_value_low: l.estimated_value_low ?? null,
      estimated_value_high: l.estimated_value_high ?? null,
      recommended_sale_price: l.recommended_sale_price ?? null,
      suggested_reply: l.suggested_reply ?? null,
      is_spam: false,
      status: (l.ai_score ?? 0) >= 70 ? "qualified" : "new",
    }).select("id").single();
    setSavingIdx(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead saved to your pipeline");
    navigate(`/leads/${data!.id}`);
  }

  return (
    <div className="p-6 max-w-[1600px]">
      <PageHeader
        title="AI Lead Hunter"
        description="Universal search — enter any keyword, service, or industry and let AI surface real customer requests across every platform."
        actions={<Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> AI-powered</Badge>}
      />

      <Card className="mb-6">
        <CardContent className="p-5">
          <form onSubmit={hunt} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Radar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder='Any keyword — e.g. "leaking roof", "commercial janitorial", "junk removal", "property preservation"…'
                  className="pl-9 h-11 text-base"
                  value={f.keyword}
                  onChange={(e) => up("keyword", e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" disabled={hunting} className="h-11 min-w-[140px]">
                {hunting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {hunting ? "Hunting…" : "Hunt leads"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground self-center mr-1">Quick:</span>
              {quickCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { up("keyword", c); }}
                  className="text-xs px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-accent transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Input value={f.category} onChange={(e) => up("category", e.target.value)} placeholder="Auto" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={f.city} onChange={(e) => up("city", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input value={f.state} onChange={(e) => up("state", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Select value={f.country} onValueChange={(v) => up("country", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {countries.length === 0 ? (
                      <>
                        <SelectItem value="USA">United States</SelectItem>
                        <SelectItem value="Lithuania">Lithuania</SelectItem>
                        <SelectItem value="Latvia">Latvia</SelectItem>
                        <SelectItem value="UAE">UAE</SelectItem>
                      </>
                    ) : countries.map((c) => (
                      <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Radius (km)</Label>
                <Input type="number" value={f.radius_km} onChange={(e) => up("radius_km", e.target.value)} placeholder="Any" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Platform</Label>
                <Select value={f.platform} onValueChange={(v) => up("platform", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min budget ($)</Label>
                <Input type="number" value={f.budget_min} onChange={(e) => up("budget_min", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max budget ($)</Label>
                <Input type="number" value={f.budget_max} onChange={(e) => up("budget_max", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posted within (days)</Label>
                <Input type="number" value={f.posted_within_days} onChange={(e) => up("posted_within_days", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Segment</Label>
                <Select value={f.segment} onValueChange={(v) => up("segment", v as typeof f.segment)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={f.priority} onValueChange={(v) => up("priority", v as typeof f.priority)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="urgent">Urgent only</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Results</Label>
                <Select value={f.limit} onValueChange={(v) => up("limit", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {hunting && (
        <div className="rounded-lg border bg-card p-12 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-3" />
          <div className="text-sm">Scanning platforms and qualifying prospects…</div>
        </div>
      )}

      {!hunting && results.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Radar className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-base font-medium">Ready to hunt</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Enter any keyword — a service, industry, or job type — apply filters, and AI will surface realistic prospective leads you can save into your pipeline.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {results.length} prospects for <span className="font-medium text-foreground">"{f.keyword}"</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {results.map((l, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{l.customer_name}</span>
                        {l.priority && (
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${priorityColor[l.priority]}`}>
                            {l.priority}
                          </span>
                        )}
                        {l.segment && <Badge variant="outline" className="text-[10px] capitalize">{l.segment}</Badge>}
                      </div>
                      <div className="text-sm mt-0.5">{l.service}</div>
                    </div>
                    {l.ai_score != null && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-semibold tabular-nums leading-none">{l.ai_score}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">AI score</div>
                      </div>
                    )}
                  </div>

                  {l.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{l.description}</p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-3">
                    {(l.city || l.state) && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[l.city, l.state].filter(Boolean).join(", ")}</span>
                    )}
                    {l.posted_ago_hours != null && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{l.posted_ago_hours < 24 ? `${l.posted_ago_hours}h ago` : `${Math.round(l.posted_ago_hours / 24)}d ago`}</span>
                    )}
                    {l.estimated_value_low != null && (
                      <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />${Number(l.estimated_value_low).toLocaleString()}–${Number(l.estimated_value_high ?? 0).toLocaleString()}</span>
                    )}
                    {l.source && (
                      <span className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />{l.source}</span>
                    )}
                    {l.category && <Badge variant="outline" className="text-[10px]">{l.category}</Badge>}
                  </div>

                  {l.suggested_reply && (
                    <div className="rounded-md bg-muted/40 border p-2.5 text-xs mb-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">AI suggested outreach</div>
                      {l.suggested_reply}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {l.recommended_sale_price != null && (
                        <>Sell at <span className="font-semibold text-foreground">${Number(l.recommended_sale_price).toLocaleString()}</span></>
                      )}
                    </div>
                    <Button size="sm" onClick={() => saveLead(i)} disabled={savingIdx === i}>
                      {savingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Save to leads
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="pt-2 text-[11px] text-muted-foreground text-center">
            AI-synthesized prospects for review. Human approval required before any outreach — per compliance policy.
          </div>
        </div>
      )}
    </div>
  );
}
