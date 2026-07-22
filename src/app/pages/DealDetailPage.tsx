import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActivityTimeline } from "../components/ActivityTimeline";

type Stage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
const stageList: Stage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

interface Deal {
  id: string; name: string; stage: Stage; value: number; currency: string; probability: number;
  expected_close_date: string | null; description: string | null;
  contact_id: string | null; company_id: string | null;
}

export default function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [contact, setContact] = useState<{ id: string; full_name: string; email: string | null; phone: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) void load(id); }, [id]);
  async function load(did: string) {
    setLoading(true);
    const { data, error } = await supabase.from("deals").select("*").eq("id", did).maybeSingle();
    if (error) { toast.error(error.message); setLoading(false); return; }
    setDeal(data as Deal | null);
    if (data?.company_id) {
      const { data: co } = await supabase.from("companies").select("id,name").eq("id", data.company_id).maybeSingle();
      setCompany(co as { id: string; name: string } | null);
    } else setCompany(null);
    if (data?.contact_id) {
      const { data: ct } = await supabase.from("contacts").select("id,full_name,email,phone").eq("id", data.contact_id).maybeSingle();
      setContact(ct as { id: string; full_name: string; email: string | null; phone: string | null } | null);
    } else setContact(null);
    setLoading(false);
  }

  async function setStage(stage: Stage) {
    if (!deal) return;
    const { error } = await supabase.from("deals").update({ stage }).eq("id", deal.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${stage}`);
    void load(deal.id);
  }

  if (loading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!deal) return <div className="p-6">Deal not found.</div>;

  return (
    <div className="p-6 max-w-6xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{deal.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            ${Number(deal.value).toLocaleString()} {deal.currency}{deal.expected_close_date && ` · Close ${deal.expected_close_date}`}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {stageList.map((s) => (
            <button key={s} onClick={() => setStage(s)} className={`text-xs px-2.5 py-1 rounded-md border capitalize ${deal.stage === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityTimeline target={{ deal_id: deal.id }} defaultToAddress={{ email: contact?.email ?? undefined, phone: contact?.phone ?? undefined }} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Deal info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="Stage" v={<Badge variant="secondary" className="capitalize">{deal.stage}</Badge>} />
              <Row k="Value" v={`$${Number(deal.value).toLocaleString()}`} />
              <Row k="Probability" v={`${deal.probability}%`} />
              <Row k="Company" v={company ? <Link to={`/companies/${company.id}`} className="text-primary hover:underline">{company.name}</Link> : "—"} />
              <Row k="Contact" v={contact ? <Link to={`/contacts/${contact.id}`} className="text-primary hover:underline">{contact.full_name}</Link> : "—"} />
              {deal.description && <div className="pt-2 border-t text-muted-foreground">{deal.description}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
}
