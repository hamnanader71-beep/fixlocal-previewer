// AI Business Development / Partner Hunter
// Generates realistic partner prospects (property mgmt firms, insurance adjusters,
// realtors, GCs, corporate facility teams) with fit score + suggested pitch.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const {
      keyword = "", category = "", city = "", state = "", country = "USA",
      partner_type = "any", size = "any", limit = 8,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sys = `You are an AI Business Development scout for GetFixLocal, a home-services lead marketplace.
Generate ${limit} realistic B2B partner prospects (companies that could send us referral work OR that we could serve as a vendor).
Categories to consider: property management, real estate brokerages, insurance adjusters, general contractors, HOAs,
facility management, corporate real estate, hospitality chains, retail chains, senior living, universities.
For each partner return: name, category, website (realistic domain), email (info@ style), phone (realistic format for the country),
city, state, country, size (small/mid/enterprise), fit_score (0-100), ai_reasoning (why they're a fit),
suggested_pitch (2-3 sentence outreach opening).
Return JSON: { "partners": [ ... ] } — no prose, no code fences.`;

    const user = `Filters:
- keyword/industry: ${keyword || "any"}
- category focus: ${category || "any"}
- location: ${[city, state, country].filter(Boolean).join(", ")}
- partner_type: ${partner_type}
- company size: ${size}
Return ${limit} high-quality prospects.`;

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
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = { partners: [] }; }
    return new Response(JSON.stringify({ partners: parsed.partners ?? [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
