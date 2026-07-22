// Unified send helper. Reads the CURRENT USER's integrations row from Supabase
// and dispatches via Twilio (SMS), Telegram Bot, or Resend (email).
// The user enters their own API keys from the frontend Integrations page —
// nothing is hardcoded server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { channel, to, subject, body } = await req.json();
    if (!channel || !to || !body) throw new Error("channel, to and body are required");

    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supa.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const provider = channel === "sms" ? "twilio" : channel === "telegram" ? "telegram" : "resend";
    const { data: integ } = await supa
      .from("integrations")
      .select("config, enabled")
      .eq("user_id", user.id).eq("provider", provider).maybeSingle();

    if (!integ || !integ.enabled) {
      throw new Error(`${provider} not configured. Go to Settings → Integrations to add your API keys.`);
    }
    const cfg = integ.config as Record<string, string>;

    let result: any = {};
    if (channel === "sms") {
      const sid = cfg.account_sid, token = cfg.auth_token, from = cfg.from_number;
      if (!sid || !token || !from) throw new Error("Twilio account_sid, auth_token, from_number required");
      const form = new URLSearchParams({ To: to, From: from, Body: body });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      result = await r.json();
      if (!r.ok) throw new Error(result?.message || "Twilio send failed");
    } else if (channel === "telegram") {
      const botToken = cfg.bot_token;
      if (!botToken) throw new Error("Telegram bot_token required");
      const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: to, text: body, parse_mode: "HTML" }),
      });
      result = await r.json();
      if (!result.ok) throw new Error(result?.description || "Telegram send failed");
    } else if (channel === "email") {
      const apiKey = cfg.api_key, from = cfg.from_email || "onboarding@resend.dev";
      if (!apiKey) throw new Error("Resend api_key required");
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: subject || "(no subject)", html: body }),
      });
      result = await r.json();
      if (!r.ok) throw new Error(result?.message || "Resend send failed");
    } else {
      throw new Error(`Unsupported channel: ${channel}`);
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
