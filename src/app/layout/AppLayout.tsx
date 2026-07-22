import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Target, Store, HardHat, Building2, Users, UserSquare2, Briefcase, Inbox,
  Globe, Map, MapPin, Wrench, Radio, Settings, ChevronRight, Search, Bell, Sparkles, LogOut, Radar,
  Handshake, Megaphone, FileText, ListChecks, Plug, Mail, Phone,
} from "lucide-react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "../auth/AuthProvider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { section: "Workspace", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/inbox", label: "Inbox", icon: Inbox },
    { to: "/tasks", label: "Tasks", icon: ListChecks },
  ]},
  { section: "Growth", items: [
    { to: "/hunter", label: "Lead Hunter", icon: Radar, badge: "AI" },
    { to: "/hunter/contractors", label: "Contractor Hunter", icon: HardHat, badge: "AI" },
    { to: "/partners", label: "Partner Hunter", icon: Handshake, badge: "AI" },
    { to: "/campaigns", label: "Campaigns", icon: Megaphone, badge: "AI" },
    { to: "/marketplace", label: "Marketplace", icon: Store },
  ]},
  { section: "Sales", items: [
    { to: "/leads", label: "Leads", icon: Target },
    { to: "/deals", label: "Deals", icon: Briefcase },
    { to: "/invoices", label: "Invoices", icon: FileText },
    { to: "/contractors", label: "Contractors", icon: HardHat },
  ]},
  { section: "CRM", items: [
    { to: "/contacts", label: "Contacts", icon: UserSquare2 },
    { to: "/companies", label: "Companies", icon: Building2 },
    { to: "/organizations", label: "Organizations", icon: Building2 },
  ]},
  { section: "Team", items: [
    { to: "/users", label: "Users & Roles", icon: Users },
    { to: "/integrations", label: "Integrations", icon: Plug },
  ]},
  { section: "Admin", items: [
    { to: "/admin/countries", label: "Countries", icon: Globe },
    { to: "/admin/states", label: "States", icon: Map },
    { to: "/admin/cities", label: "Cities", icon: MapPin },
    { to: "/admin/service-categories", label: "Service Categories", icon: Wrench },
    { to: "/admin/lead-sources", label: "Lead Sources", icon: Radio },
  ]},
];

export function AppLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, roles, signOut, isAdmin } = useAuth();
  const displayName = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex h-screen bg-muted/30">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">GetFixLocal</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI OS for Home Services</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {nav.map((s) => (
            <div key={s.section}>
              <div className="px-2 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.section}</div>
              <div className="space-y-0.5">
                {s.items.map((it) => (
                  <NavLink key={it.to} to={it.to} className={({ isActive }) => cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-accent hover:text-foreground",
                  )}>
                    <it.icon className="h-4 w-4" />
                    <span className="flex-1">{it.label}</span>
                    {it.badge && <Badge variant="secondary" className="h-5 text-[10px] px-1.5">{it.badge}</Badge>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t">
          <NavLink to="/settings" className={({ isActive }) => cn(
            "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm",
            isActive ? "bg-accent" : "hover:bg-accent",
          )}>
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full mt-3 flex items-center gap-2 p-2 rounded-md bg-accent/50 hover:bg-accent transition-colors text-left">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">{initials}</div>
                <div className="flex-1 leading-tight min-w-0">
                  <div className="text-xs font-medium truncate">{displayName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{isAdmin ? "Admin" : (roles[0] ?? "User")}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-card px-6 flex items-center gap-4">
          <Breadcrumbs path={loc.pathname} />
          <div className="flex-1 max-w-md ml-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads, contacts, companies, deals…" className="pl-9 h-9 bg-muted/40 border-0" />
          </div>
          <LanguageSwitcher />
          <a href="mailto:infogetfixlocal@gmail.com" className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Mail className="h-3.5 w-3.5" /> infogetfixlocal@gmail.com
          </a>
          <a href="tel:+13129727489" className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Phone className="h-3.5 w-3.5" /> +1 (312) 972-7489
          </a>
          <Button variant="ghost" size="icon" className="h-9 w-9"><Bell className="h-4 w-4" /></Button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Breadcrumbs({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">GetFixLocal</span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={i === parts.length - 1 ? "font-medium capitalize" : "text-muted-foreground capitalize"}>
            {p.replace(/-/g, " ")}
          </span>
        </span>
      ))}
    </div>
  );
}
