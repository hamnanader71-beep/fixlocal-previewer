import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "./PageHeader";

export type CrudField = { key: string; label: string; placeholder?: string; required?: boolean };

export function SimpleCrud({
  title,
  description,
  table,
  fields,
  orderBy = "created_at",
}: {
  title: string;
  description: string;
  table: string;
  fields: CrudField[];
  orderBy?: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from(table).select("*").order(orderBy, { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [table]);

  const add = async () => {
    for (const f of fields) if (f.required && !form[f.key]) return toast.error(`${f.label} required`);
    setSaving(true);
    const payload: any = { ...form };
    if (payload.slug === undefined && payload.name && fields.some(f => f.key === "slug")) {
      payload.slug = String(payload.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    const { error } = await (supabase as any).from(table).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({});
    toast.success("Added");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title={title} description={description} />
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {fields.map(f => (
              <Input key={f.key} placeholder={f.placeholder ?? f.label} value={form[f.key] ?? ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            ))}
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
            </Button>
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">No items yet.</div>
      ) : (
        <Card><CardContent className="p-0 divide-y">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {fields.filter(f => f.key !== "name").map(f => r[f.key]).filter(Boolean).join(" · ")}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
