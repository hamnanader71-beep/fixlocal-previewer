import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Globe, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ActivityTimeline } from "../components/ActivityTimeline";

interface Company {
  id: string; name: string; domain: string | null; industry: string | null; size: string | null;
  website: string | null; phone: string | null; city: string | null; country: string | null;
  address: string | null; annual_revenue: number | null; description: string | null;
}

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<{ id: string; full_name: string; title: string | null }[]>([]);
  const [deals, setDeals] = useState<{ id: string; name: string; value: number; stage: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) void load(id); }, [id]);
  async function load(cid: string) {
    setLoading(true);
    const [c, ct, dl] = await Promise.all([
      supabase.from("companies").select("*").eq("id", cid).maybeSingle(),
      supabase.from("contacts").select("id,full_name,title").eq("company_id", cid),
      supabase.from("deals").select("id,name,value,stage").eq("company_id", cid),
    ]);
    setLoading(false);
    if (c.error) { toast.error(c.error.message); return; }
    setCompany(c.data as Company | null);
    setContacts((ct.data ?? []) as { id: string; full_name: string; title: string | null }[]);
    setDeals((dl.data ?? []) as { id: string; name: string; value: number; stage: string }[]);
  }

  if (loading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!company) return <div className="p-6">Company not found.</div>;

  return (
    <div className="p-6 max-w-6xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <div className="text-sm text-muted-foreground mt-1">{company.industry ?? "—"}{company.size && ` · ${company.size}`}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityTimeline target={{ company_id: company.id }} defaultToAddress={{ phone: company.phone ?? undefined }} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row icon={<Globe className="h-3.5 w-3.5" />} v={company.website ?? company.domain ?? "—"} />
              <Row icon={<Phone className="h-3.5 w-3.5" />} v={company.phone ?? "—"} />
              <Row icon={<MapPin className="h-3.5 w-3.5" />} v={[company.city, company.country].filter(Boolean).join(", ") || "—"} />
              {company.description && <div className="pt-2 border-t text-muted-foreground">{company.description}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contacts ({contacts.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contacts.length === 0 ? <div className="text-muted-foreground">No contacts yet.</div> : contacts.map((c) => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 hover:text-primary">
                  <span className="font-medium">{c.full_name}</span>
                  <span className="text-xs text-muted-foreground">{c.title ?? ""}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Deals ({deals.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {deals.length === 0 ? <div className="text-muted-foreground">No deals yet.</div> : deals.map((d) => (
                <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 hover:text-primary">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">${Number(d.value).toLocaleString()}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, v }: { icon: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center gap-2"><span className="text-muted-foreground">{icon}</span><span className="flex-1 truncate">{v}</span></div>;
}
