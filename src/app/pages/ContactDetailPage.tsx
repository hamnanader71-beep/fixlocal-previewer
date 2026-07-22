import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Mail, Phone, MessageCircle, Send, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { relativeTime } from "../data/types";

interface Contact {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;
  telegram: string | null;
  linkedin_url: string | null;
  company_id: string | null;
  lifecycle_stage: string;
  city: string | null; state: string | null; country: string | null;
  source: string | null;
  created_at: string;
}

interface Deal { id: string; name: string; value: number; stage: string }

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) void load(id); }, [id]);
  async function load(cid: string) {
    setLoading(true);
    const { data, error } = await supabase.from("contacts").select("*").eq("id", cid).maybeSingle();
    if (error) { toast.error(error.message); setLoading(false); return; }
    setContact(data as Contact | null);
    if (data?.company_id) {
      const { data: co } = await supabase.from("companies").select("id,name").eq("id", data.company_id).maybeSingle();
      setCompany(co as { id: string; name: string } | null);
    }
    const { data: d } = await supabase.from("deals").select("id,name,value,stage").eq("contact_id", cid);
    setDeals((d ?? []) as Deal[]);
    setLoading(false);
  }

  if (loading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!contact) return <div className="p-6">Contact not found.</div>;

  return (
    <div className="p-6 max-w-6xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{contact.full_name}</h1>
        <div className="text-sm text-muted-foreground mt-1">
          {contact.title ?? "—"}{company && <> · <Link to={`/companies/${company.id}`} className="hover:underline">{company.name}</Link></>}
        </div>
        <div className="mt-2"><Badge variant="secondary" className="capitalize">{contact.lifecycle_stage}</Badge></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityTimeline target={{ contact_id: contact.id }} defaultToAddress={{ email: contact.email ?? undefined, phone: contact.phone ?? contact.whatsapp ?? undefined }} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contact info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row icon={<Mail className="h-3.5 w-3.5" />} k="Email" v={contact.email ?? "—"} />
              <Row icon={<Phone className="h-3.5 w-3.5" />} k="Phone" v={contact.phone ?? "—"} />
              <Row icon={<MessageCircle className="h-3.5 w-3.5 text-emerald-600" />} k="WhatsApp" v={contact.whatsapp ?? "—"} />
              <Row icon={<Send className="h-3.5 w-3.5 text-sky-600" />} k="Telegram" v={contact.telegram ?? "—"} />
              <Row icon={<Building2 className="h-3.5 w-3.5" />} k="Company" v={company?.name ?? "—"} />
              <div className="pt-2 border-t text-xs text-muted-foreground">Added {relativeTime(contact.created_at)}</div>
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

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-20">{k}</span>
      <span className="flex-1 truncate">{v}</span>
    </div>
  );
}
