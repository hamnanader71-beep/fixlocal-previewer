import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake, Sparkles, Loader2, MapPin, Save, Building2, Globe, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";

interface Partner {
  id?: string; name: string; category?: string; website?: string; email?: string; phone?: string;
  city?: string; state?: string; country?: string; size?: string;
  fit_score?: number; ai_reasoning?: string; suggested_pitch?: string; status?: string;
}

export default function PartnerHunterPage() {
  const { user } = useAuth();
  const [hunting, setHunting] = useState(false);
  const [saved, setSaved] = useState<Partner[]>([]);
  const [results, setResults] = useState<Partner[]>([]);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [f, setF] = useState({
    keyword: "", category: "", city: "", state: "", country: "USA",
    partner_type: "any", size: "any", limit: "8",
  });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function load() {
    const { data } = await supabase.from("partners").select("*").order("created_at", { ascending: false }).limit(50);
    setSaved((data ?? []) as Partner[]);
  }
  useEffect(() => { load(); }, []);

  async function hunt(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.keyword.trim() && !f.category.trim()) { toast.error("Enter a keyword or category."); return; }
    setHunting(true); setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-hunt-partners", {
        body: { ...f, limit: Number(f.limit) },
      });
      if (error) throw error;
      setResults((data?.partners ?? []) as Partner[]);
      toast.success(`Found ${data?.partners?.length ?? 0} partner prospects`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setHunting(false); }
  }

  async function savePartner(i: number) {
    const p = results[i]; setSavingIdx(i);
    const { error } = await supabase.from("partners").insert({
      ...p, created_by: user?.id ?? null, status: "prospect",
    });
    setSavingIdx(null);
    if (error) return toast.error(error.message);
    toast.success("Partner added");
    setResults((prev) => prev.filter((_, idx) => idx !== i));
    load();
  }

  return (
    <div className="p-6 max-w-[1600px]">
      <PageHeader
        title="AI Business Development"
        description="Find strategic partners — property managers, insurance adjusters, GCs, realtors, HOAs, corporate facility teams — with AI-scored fit and ready-to-send pitch."
        actions={<Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> AI-powered</Badge>}
      />

      <Card className="mb-6">
        <CardContent className="p-5">
          <form onSubmit={hunt} className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder='Industry / keyword — e.g. "property management", "insurance adjuster", "hospitality"'
                className="flex-1 h-11" value={f.keyword} onChange={(e) => up("keyword", e.target.value)} />
              <Button type="submit" disabled={hunting} className="h-11 min-w-[140px]">
                {hunting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {hunting ? "Hunting…" : "Hunt partners"}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="space-y-1"><Label className="text-xs">Category</Label>
                <Input value={f.category} onChange={(e) => up("category", e.target.value)} className="h-9" placeholder="Auto" /></div>
              <div className="space-y-1"><Label className="text-xs">City</Label>
                <Input value={f.city} onChange={(e) => up("city", e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">State</Label>
                <Input value={f.state} onChange={(e) => up("state", e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Country</Label>
                <Input value={f.country} onChange={(e) => up("country", e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Size</Label>
                <Select value={f.size} onValueChange={(v) => up("size", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Results</Label>
                <Select value={f.limit} onValueChange={(v) => up("limit", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{["5","8","10","15"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="mb-8">
          <div className="text-xs text-muted-foreground mb-2">AI-generated prospects — save the ones worth pursuing</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {results.map((p, i) => (
              <Card key={i}><CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{p.name}</span>
                      {p.size && <Badge variant="outline" className="text-[10px] capitalize">{p.size}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.category}</div>
                  </div>
                  {p.fit_score != null && (
                    <div className="text-right shrink-0">
                      <div className="text-lg font-semibold tabular-nums leading-none">{p.fit_score}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Fit</div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
                  {(p.city || p.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[p.city,p.state].filter(Boolean).join(", ")}</span>}
                  {p.website && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{p.website}</span>}
                  {p.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                  {p.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                </div>
                {p.suggested_pitch && (
                  <div className="rounded-md bg-muted/40 border p-2.5 text-xs mb-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">AI pitch</div>
                    {p.suggested_pitch}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => savePartner(i)} disabled={savingIdx === i}>
                    {savingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Add to pipeline
                  </Button>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Handshake className="h-4 w-4" /> Saved partners ({saved.length})</div>
        {saved.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No partners yet — run a hunt above.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((p) => (
              <Card key={p.id}><CardContent className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <div className="font-semibold text-sm">{p.name}</div>
                  <Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{p.category}</div>
                <div className="text-xs text-muted-foreground mt-1">{[p.city, p.state, p.country].filter(Boolean).join(", ")}</div>
                {p.fit_score != null && <div className="mt-2 text-xs">Fit: <span className="font-semibold">{p.fit_score}</span></div>}
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
