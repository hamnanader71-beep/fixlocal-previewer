import { Outlet } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold">GetFixLocal</span>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-semibold leading-tight">GetFixLocal — AI Operating System for Home Services.</h1>
          <p className="mt-4 text-primary-foreground/70 max-w-md">
            Discover, qualify, price, and route home service leads and build your contractor network across the USA, Lithuania, Latvia, and UAE.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
            {[
              { k: "12,482", v: "Leads / mo" },
              { k: "94%", v: "AI accuracy" },
              { k: "$2.1M", v: "Pipeline" },
            ].map((s) => (
              <div key={s.v} className="rounded-lg bg-primary-foreground/10 p-3">
                <div className="text-lg font-semibold">{s.k}</div>
                <div className="text-[11px] text-primary-foreground/60">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 space-y-1 text-xs text-primary-foreground/70">
            <div>Contact: <a className="underline" href="mailto:infogetfixlocal@gmail.com">infogetfixlocal@gmail.com</a></div>
            <div>Phone: <a className="underline" href="tel:+13129727489">+1 (312) 972-7489</a></div>
          </div>
        </div>
        <div className="text-xs text-primary-foreground/60">© Evocraft LLC · GetFixLocal AI Operating System for Home Services</div>
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6 bg-background">
        <Outlet />
      </div>
    </div>
  );
}
