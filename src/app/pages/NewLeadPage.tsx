import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export default function NewLeadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    service: "",
    category: "",
    description: "",
    city: "",
    state: "",
    country: "USA",
    source: "Manual entry",
  });

  function up<K extends keyof typeof f>(k: K, v: string) { setF((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.customer_name || !f.service) { toast.error("Customer name and service are required"); return; }
    setSaving(true);

    // 1. AI qualify
    let ai: Record<string, unknown> = {};
    try {
      const { data, error } = await supabase.functions.invoke("ai-qualify-lead", {
        body: {
          service: f.service, description: f.description, city: f.city,
          state: f.state, country: f.country, category: f.category, source: f.source,
        },
      });
      if (error) throw error;
      ai = data ?? {};
    } catch (err) {
      console.error(err);
      toast.warning("AI qualification skipped — saving lead without score.");
    }

    // 2. Insert lead with AI fields
    const { data, error } = await supabase.from("leads").insert({
      customer_name: f.customer_name,
      customer_email: f.customer_email || null,
      customer_phone: f.customer_phone || null,
      service: f.service,
      category: (ai.category as string) || f.category || null,
      description: f.description || null,
      city: f.city || null,
      state: f.state || null,
      country: f.country || null,
      source: f.source || null,
      created_by: user?.id ?? null,
      ai_score: (ai.score as number) ?? null,
      ai_confidence: (ai.confidence as number) ?? null,
      ai_reasoning: (ai.reasoning as string) ?? null,
      priority: (ai.priority as "hot" | "good" | "medium" | "low") ?? null,
      urgency: (ai.urgency as string) ?? null,
      estimated_value_low: (ai.estimated_value_low as number) ?? null,
      estimated_value_high: (ai.estimated_value_high as number) ?? null,
      recommended_sale_price: (ai.recommended_sale_price as number) ?? null,
      suggested_reply: (ai.suggested_reply as string) ?? null,
      is_spam: (ai.is_spam as boolean) ?? false,
      status: (ai.is_spam ? "rejected" : ((ai.score as number) >= 70 ? "qualified" : "new")) as "qualified" | "new" | "rejected",
    }).select("id").single();

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    if (user && data) {
      await supabase.from("lead_activities").insert({
        lead_id: data.id, actor: user.id,
        action: "created", detail: `Lead created and AI-qualified with score ${ai.score ?? "n/a"}`,
      });
    }

    toast.success("Lead created and qualified by AI");
    navigate(`/leads/${data!.id}`);
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Add lead" description="New leads are auto-qualified, scored, and priced by AI on save." />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Customer name *" value={f.customer_name} onChange={(v) => up("customer_name", v)} />
              <Field label="Service requested *" value={f.service} onChange={(v) => up("service", v)} placeholder="e.g. Fix leaking kitchen sink" />
              <Field label="Email" value={f.customer_email} onChange={(v) => up("customer_email", v)} type="email" />
              <Field label="Phone" value={f.customer_phone} onChange={(v) => up("customer_phone", v)} />
              <Field label="City" value={f.city} onChange={(v) => up("city", v)} />
              <Field label="State/Region" value={f.state} onChange={(v) => up("state", v)} />
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={f.country} onValueChange={(v) => up("country", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USA">United States</SelectItem>
                    <SelectItem value="Lithuania">Lithuania</SelectItem>
                    <SelectItem value="UAE">UAE</SelectItem>
                    <SelectItem value="India">India</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Source" value={f.source} onChange={(v) => up("source", v)} placeholder="Facebook, Google, Referral…" />
              <Field label="Category (optional)" value={f.category} onChange={(v) => up("category", v)} placeholder="AI will detect if empty" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={4} value={f.description} onChange={(e) => up("description", e.target.value)} placeholder="What does the customer need? Any specifics on urgency, budget, or scope…" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Save & AI-qualify
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
