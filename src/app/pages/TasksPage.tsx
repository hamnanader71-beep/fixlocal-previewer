import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ListChecks, Plus, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";

interface Task { id: string; title: string; description: string | null; due_at: string | null; completed_at: string | null; priority: string; }

export default function TasksPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false });
    setRows((data ?? []) as Task[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title, due_at: due || null, created_by: user?.id ?? null, assigned_to: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setDue(""); load();
  }

  async function toggle(t: Task) {
    const { error } = await supabase.from("tasks").update({ completed_at: t.completed_at ? null : new Date().toISOString() }).eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  const open = rows.filter(r => !r.completed_at);
  const done = rows.filter(r => r.completed_at);

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Tasks & Reminders" description="Follow-ups linked to leads, contacts, and deals." />

      <Card className="mb-4"><CardContent className="p-4">
        <form onSubmit={add} className="flex flex-col md:flex-row gap-2">
          <Input placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="md:w-56" />
          <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </form>
      </CardContent></Card>

      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : rows.length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <ListChecks className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-base font-semibold">No tasks yet</div>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">Open ({open.length})</div>
              <div className="space-y-1.5">
                {open.map((t) => (
                  <Card key={t.id}><CardContent className="p-3 flex items-center gap-3">
                    <Checkbox checked={!!t.completed_at} onCheckedChange={() => toggle(t)} />
                    <div className="flex-1"><div className="text-sm">{t.title}</div>
                      {t.due_at && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3" />{new Date(t.due_at).toLocaleString()}</div>}
                    </div>
                  </CardContent></Card>
                ))}
              </div>
            </div>
            {done.length > 0 && (
              <div>
                <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">Done ({done.length})</div>
                <div className="space-y-1.5">
                  {done.map((t) => (
                    <Card key={t.id}><CardContent className="p-3 flex items-center gap-3 opacity-60">
                      <Checkbox checked onCheckedChange={() => toggle(t)} />
                      <div className="flex-1 text-sm line-through">{t.title}</div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
