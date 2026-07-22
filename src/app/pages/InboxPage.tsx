import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MessageCircle, Send, StickyNote, Calendar, CheckSquare, Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { relativeTime } from "../data/types";

const typeIcon: Record<string, typeof Mail> = {
  email: Mail, call: Phone, whatsapp: MessageCircle, telegram: Send,
  note: StickyNote, meeting: Calendar, task: CheckSquare,
};

type Filter = "all" | "email" | "call" | "whatsapp" | "telegram" | "note" | "task";

interface Row {
  id: string;
  type: string;
  direction: string;
  status: string;
  subject: string | null;
  body: string | null;
  to_address: string | null;
  from_address: string | null;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
}

export default function InboxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(200);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Row[]);
  }

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.type === filter), [rows, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "email", label: "Email" }, { key: "call", label: "Calls" },
    { key: "whatsapp", label: "WhatsApp" }, { key: "telegram", label: "Telegram" },
    { key: "note", label: "Notes" }, { key: "task", label: "Tasks" },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Unified Inbox" description="Every email, call, and message across your team — in one timeline." />
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>{f.label}</Button>
        ))}
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <div>No messages yet. Log emails, calls, or notes from a contact, company, or deal to see them here.</div>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const Icon = typeIcon[r.type] ?? Mail;
            const link = r.contact_id ? `/contacts/${r.contact_id}`
              : r.company_id ? `/companies/${r.company_id}`
              : r.deal_id ? `/deals/${r.deal_id}`
              : r.lead_id ? `/leads/${r.lead_id}` : "#";
            return (
              <Link key={r.id} to={link}>
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium capitalize">{r.type}</span>
                        <Badge variant="outline" className="text-[10px] h-4">{r.direction}</Badge>
                        <Badge variant="secondary" className="text-[10px] h-4 capitalize">{r.status}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">{relativeTime(r.created_at)}</span>
                      </div>
                      {r.subject && <div className="text-sm font-medium mt-0.5">{r.subject}</div>}
                      {r.to_address && <div className="text-xs text-muted-foreground">To: {r.to_address}</div>}
                      {r.body && <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.body}</div>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
