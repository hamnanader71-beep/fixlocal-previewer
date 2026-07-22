import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, Loader2, Trash2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "sonner";

interface Invoice {
  id: string; invoice_number: string; status: string; total: number; amount_paid: number;
  currency: string; issue_date: string; due_date: string | null; notes: string | null; created_at: string;
}
interface Item { description: string; quantity: number; unit_price: number; }

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  paid: "bg-emerald-500/10 text-emerald-600",
  overdue: "bg-red-500/10 text-red-600",
  void: "bg-muted text-muted-foreground",
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ notes: "", due_date: "", tax_pct: "0", currency: "USD" });
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Invoice[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const tax = subtotal * (Number(form.tax_pct) || 0) / 100;
  const total = subtotal + tax;

  function addItem() { setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0 }]); }
  function updItem(i: number, k: keyof Item, v: any) {
    setItems((p) => p.map((it, idx) => idx === i ? { ...it, [k]: k === "description" ? v : Number(v) } : it));
  }
  function delItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  async function save() {
    if (items.some(i => !i.description.trim())) return toast.error("Fill all line item descriptions");
    setSaving(true);
    const { data: inv, error } = await supabase.from("invoices").insert({
      created_by: user?.id ?? null,
      status: "draft",
      currency: form.currency,
      subtotal, tax, total,
      due_date: form.due_date || null,
      notes: form.notes || null,
    }).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message); }
    const rows = items.map((it, pos) => ({
      invoice_id: inv!.id, description: it.description, quantity: it.quantity, unit_price: it.unit_price, position: pos,
    }));
    const { error: ie } = await supabase.from("invoice_items").insert(rows);
    setSaving(false);
    if (ie) return toast.error(ie.message);
    toast.success("Invoice created");
    setOpen(false);
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    setForm({ notes: "", due_date: "", tax_pct: "0", currency: "USD" });
    load();
  }

  async function markPaid(id: string, total: number) {
    const { error } = await supabase.from("invoices").update({ status: "paid", amount_paid: total }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid"); load();
  }
  async function markSent(id: string) {
    const { error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sent"); load();
  }

  const totals = rows.reduce((acc, r) => {
    acc.total += Number(r.total || 0);
    if (r.status === "paid") acc.paid += Number(r.total || 0);
    else acc.outstanding += Number(r.total || 0) - Number(r.amount_paid || 0);
    return acc;
  }, { total: 0, paid: 0, outstanding: 0 });

  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader
        title="Invoices & Payments"
        description="Create estimates, send invoices, and track payments."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1.5" /> New invoice</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Create invoice</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({...form, currency: e.target.value})} /></div>
                  <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} /></div>
                  <div><Label>Tax %</Label><Input type="number" value={form.tax_pct} onChange={(e) => setForm({...form, tax_pct: e.target.value})} /></div>
                </div>
                <div>
                  <Label>Line items</Label>
                  <div className="space-y-2 mt-1">
                    {items.map((it, i) => (
                      <div key={i} className="grid grid-cols-[1fr,80px,110px,32px] gap-2">
                        <Input placeholder="Description" value={it.description} onChange={(e) => updItem(i, "description", e.target.value)} />
                        <Input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updItem(i, "quantity", e.target.value)} />
                        <Input type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => updItem(i, "unit_price", e.target.value)} />
                        <Button variant="ghost" size="icon" onClick={() => delItem(i)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Add line</Button>
                  </div>
                </div>
                <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
                <div className="text-right space-y-0.5 text-sm border-t pt-2">
                  <div>Subtotal: <span className="font-medium">${subtotal.toFixed(2)}</span></div>
                  <div>Tax: <span className="font-medium">${tax.toFixed(2)}</span></div>
                  <div className="text-base">Total: <span className="font-semibold">${total.toFixed(2)}</span></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total invoiced</div><div className="text-2xl font-semibold">${totals.total.toFixed(0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Paid</div><div className="text-2xl font-semibold text-emerald-600">${totals.paid.toFixed(0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-2xl font-semibold text-amber-600">${totals.outstanding.toFixed(0)}</div></CardContent></Card>
      </div>

      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : rows.length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-base font-semibold">No invoices yet</div>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Number</th><th className="text-left p-3">Status</th><th className="text-left p-3">Issue</th><th className="text-left p-3">Due</th><th className="text-right p-3">Total</th><th className="text-right p-3">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{r.invoice_number}</td>
                    <td className="p-3"><Badge className={statusColor[r.status]}>{r.status}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{r.issue_date}</td>
                    <td className="p-3 text-xs text-muted-foreground">{r.due_date ?? "—"}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{r.currency} {Number(r.total).toFixed(2)}</td>
                    <td className="p-3 text-right space-x-1">
                      {r.status === "draft" && <Button size="sm" variant="outline" onClick={() => markSent(r.id)}>Send</Button>}
                      {r.status !== "paid" && <Button size="sm" onClick={() => markPaid(r.id, r.total)}><DollarSign className="h-3.5 w-3.5 mr-1" />Paid</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
    </div>
  );
}
