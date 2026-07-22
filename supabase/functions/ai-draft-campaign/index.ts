// AI campaign copy drafter — email / SMS / WhatsApp / Telegram
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { goal = "", audience = "", channel = "email", tone = "friendly professional", offer = "" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys = `You are a senior B2B marketing copywriter. Draft ${channel} campaign copy for GetFixLocal, a home-services lead platform.
Return strict JSON: { "subject": string (empty for sms/whatsapp/telegram), "body": string, "cta": string, "preview_text": string }.
Keep SMS/WhatsApp/Telegram under 320 chars. Emails 120-220 words, scannable, short paragraphs. Use {{first_name}} placeholder.`;

    const user = `Goal: ${goal}
Audience: ${audience}
Channel: ${channel}
Tone: ${tone}
Offer/value: ${offer}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
    const data = await r.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
    return new Response(JSON.stringify(parsed), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
