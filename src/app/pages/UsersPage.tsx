import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime } from "../data/types";
import { Loader2 } from "lucide-react";

type UserRow = { id: string; email: string; full_name: string | null; created_at: string; roles: string[] };

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role);
        rolesByUser.set(r.user_id, list);
      });
      setRows((profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader title="Users & Roles" description="Everyone with access to your GetFixLocal workspace." />
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <DataTable<UserRow>
          columns={[
            { key: "name", header: "Name", render: (u) => <span className="font-medium">{u.full_name ?? "—"}</span> },
            { key: "email", header: "Email", render: (u) => <span className="text-sm">{u.email}</span> },
            { key: "roles", header: "Roles", render: (u) => (
              <div className="flex gap-1 flex-wrap">
                {u.roles.length ? u.roles.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize">{r}</Badge>) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            )},
            { key: "created", header: "Joined", render: (u) => <span className="text-xs text-muted-foreground">{relativeTime(u.created_at)}</span> },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
